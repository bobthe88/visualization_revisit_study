#!/bin/sh
set -eu

source_repo="https://github.com/curentleaf/adaptive-visualization-recommender.git"
source_commit="${CEDAR_WATCH_SOURCE_COMMIT:-4b6927b12d212f139d003348b79c912a991bdb8b}"
patch_dir="$(pwd)/scripts"
bridge_patches="$patch_dir/cedar-watch-revisit-bridge.patch $patch_dir/cedar-watch-loopback.patch $patch_dir/cedar-watch-tests.patch $patch_dir/cedar-watch-testing-library.patch"
checkout="${RUNNER_TEMP:-/tmp}/cedar-watch-${source_commit}"
app_output="${checkout}/study/dist"
output_root="${CEDAR_WATCH_PUBLIC_DIR:-public}"
target="${output_root}/cedar-watch-pilot/app"
assets_target="${output_root}/cedar-watch-pilot/assets"
public_base="${CEDAR_WATCH_BASE_PATH:-}"
parent_origins="${CEDAR_WATCH_PARENT_ORIGINS:-}"

case "$source_commit" in
  *[!0-9a-f]*|'')
    printf 'CEDAR_WATCH_SOURCE_COMMIT must be a full 40-character commit SHA.\n' >&2
    exit 1
    ;;
esac
if [ "${#source_commit}" -ne 40 ]; then
  printf 'CEDAR_WATCH_SOURCE_COMMIT must be a full 40-character commit SHA.\n' >&2
  exit 1
fi
if [ "${CEDAR_WATCH_REQUIRE_PARENT_ORIGINS:-false}" = "true" ] && [ -z "$parent_origins" ]; then
  printf 'CEDAR_WATCH_PARENT_ORIGINS must contain the approved parent origin(s) for deployment.\n' >&2
  exit 1
fi
if [ -n "$parent_origins" ]; then
  CEDAR_WATCH_PARENT_ORIGINS="$parent_origins" node --input-type=module -e '
    const origins = process.env.CEDAR_WATCH_PARENT_ORIGINS.split(",");
    for (const value of origins) {
      const url = new URL(value);
      if (url.origin !== value || url.protocol !== "https:") {
        throw new Error(`Not an HTTPS origin-only URL: ${value}`);
      }
    }
  '
fi

for marker in \
  VITE_REVISIT_PARENT_ORIGINS \
  'map((origin: string) => origin.trim())' \
  import.meta.env.DEV \
  VITE_REVISIT_ALLOW_HTTP_LOOPBACK \
  isAllowedParentOrigin \
  'trustedParentOrigins: readonly string[] = []' \
  'parsedOrigin === referrerOrigin' \
  canSubmitHostedSession \
  hostedSessionStarted \
  bridgeInitialized \
  hostedRecoveryBlocked \
  resetCompletion \
  'Hosted study data transfer' \
  'session?.responses.length ?? 0' \
  "session.status === 'complete' ? 'debrief' : 'practice'" \
  'allows HTTP only for exact loopback origins under explicit development opt-in' \
  resumeThroughPractice; do
  marker_found=false
  for patch_file in $bridge_patches; do
    if awk -v marker="$marker" 'index($0, marker) { found = 1 } END { exit !found }' "$patch_file"; then
      marker_found=true
      break
    fi
  done
  if [ "$marker_found" != "true" ]; then
    printf 'Bridge/test overlay is stale or incomplete (missing required marker: %s). Regenerate it from the child agent final changes.\n' "$marker" >&2
    exit 1
  fi
done

if [ -z "$public_base" ]; then
  if [ "${CEDAR_WATCH_MATCH_HOST_BASE:-false}" = "true" ]; then
    host_base="${VITE_BASE_PATH:-}"
    if [ -z "$host_base" ] && [ -f .env ]; then
      while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in VITE_BASE_PATH=*) host_base="${line#*=}"; break ;; esac
      done < .env
      host_base="${host_base%\"}"
      host_base="${host_base#\"}"
      host_base="${host_base%\'}"
      host_base="${host_base#\'}"
    fi
    host_base="${host_base:-/}"
    public_base="${host_base%/}/cedar-watch-pilot/app/"
  else
    public_base="/cedar-watch-pilot/app/"
  fi
fi
case "$public_base" in
  /*/) ;;
  *)
    printf 'CEDAR_WATCH_BASE_PATH must be a same-origin absolute path ending in /.\n' >&2
    exit 1
    ;;
esac
case "$public_base" in
  //*|*'?'*|*'#'*)
    printf 'CEDAR_WATCH_BASE_PATH must be a same-origin absolute path ending in /.\n' >&2
    exit 1
    ;;
esac

rm -rf "$checkout"
git clone --no-checkout "$source_repo" "$checkout"
git -C "$checkout" fetch --depth 1 origin "$source_commit"
git -C "$checkout" checkout --detach FETCH_HEAD
actual_commit="$(git -C "$checkout" rev-parse HEAD)"
if [ "$actual_commit" != "$source_commit" ]; then
  printf 'Fetched Cedar Watch revision does not match requested pin.\n' >&2
  exit 1
fi
for patch_file in $bridge_patches; do
  git -C "$checkout" apply --check "$patch_file"
  git -C "$checkout" apply "$patch_file"
done
git -C "$checkout" diff --check
overlay_hash="$(sha256sum $bridge_patches | awk '{print $1}' | sha256sum | cut -c1-16)"

NPM_CONFIG_LEGACY_PEER_DEPS=true npm ci --legacy-peer-deps --prefix "$checkout/study"
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" npm --prefix "$checkout/study" run typecheck
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" npm --prefix "$checkout/study" test
VITE_SOURCE_COMMIT="${source_commit}+bridge-${overlay_hash}" \
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" \
VITE_REVISIT_ALLOW_HTTP_LOOPBACK=false \
  npm --prefix "$checkout/study" run build -- --base "$public_base"
if [ ! -s "$app_output/index.html" ]; then
  printf 'Cedar Watch build did not produce index.html.\n' >&2
  exit 1
fi
rm -rf "$target"
mkdir -p "$target"
cp -R "$app_output"/. "$target"/
mkdir -p "$assets_target"
cp "$checkout/study/revisit/public/cedar-watch-pilot/assets/logo.svg" "$assets_target/logo.svg"
printf 'Built Cedar Watch %s with bridge overlay %s into %s (base %s).\n' "$actual_commit" "$overlay_hash" "$target" "$public_base"
