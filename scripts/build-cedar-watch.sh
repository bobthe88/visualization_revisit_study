#!/bin/sh
set -eu

source_repo="https://github.com/curentleaf/adaptive-visualization-recommender.git"
reviewed_source_commit="898f8af4ddc54a09e4a5b8d9a7766b78600b6e7c"
source_commit="${CEDAR_WATCH_SOURCE_COMMIT:-$reviewed_source_commit}"
patch_dir="$(pwd)/scripts"
dependency_patch="$patch_dir/cedar-watch-testing-library.patch"
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
if [ "$source_commit" != "$reviewed_source_commit" ]; then
  printf 'CEDAR_WATCH_SOURCE_COMMIT must match the explicitly reviewed source revision: %s. Review and update the allowlist before changing it.\n' "$reviewed_source_commit" >&2
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
git -C "$checkout" apply --check "$dependency_patch"
git -C "$checkout" apply "$dependency_patch"
git -C "$checkout" diff --check
node "$patch_dir/check-cedar-watch-source.mjs" "$checkout/study"
patch_hash="$(sha256sum "$dependency_patch" | awk '{print $1}')"
source_hash="$(git -C "$checkout" rev-parse 'HEAD^{tree}')"
overlay_hash="$(printf '%s  %s\n' "$source_hash" "$patch_hash" | sha256sum | cut -c1-16)"

NPM_CONFIG_LEGACY_PEER_DEPS=true npm ci --legacy-peer-deps --prefix "$checkout/study"
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" npm --prefix "$checkout/study" run typecheck
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" npm --prefix "$checkout/study" test
VITE_SOURCE_COMMIT="${source_commit}+testing-library-${overlay_hash}" \
VITE_REVISIT_PARENT_ORIGINS="$parent_origins" \
VITE_REVISIT_ALLOW_HTTP_LOOPBACK=false \
  npm --prefix "$checkout/study" run build -- --base "$public_base"
if [ ! -s "$app_output/index.html" ] || [ ! -s "$app_output/visualization.html" ]; then
  printf 'Cedar Watch build did not produce index.html and visualization.html.\n' >&2
  exit 1
fi
rm -rf "$target"
mkdir -p "$target"
cp -R "$app_output"/. "$target"/
if [ ! -s "$target/visualization.html" ]; then
  printf 'Cedar Watch package did not include visualization.html.\n' >&2
  exit 1
fi
mkdir -p "$assets_target"
cp "$checkout/study/revisit/public/cedar-watch-pilot/assets/logo.svg" "$assets_target/logo.svg"
printf 'Built Cedar Watch %s with testing-library patch %s and provenance %s into %s (base %s).\n' "$actual_commit" "$patch_hash" "$overlay_hash" "$target" "$public_base"
