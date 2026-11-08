# reVISit study – Interactive, Web-Based User Studies.  

Create your own interactive, web-based data online experiment by setting up your own repository based on this template. The template tracks stable releases of revisit, i.e., the main branch of https://github.com/revisit-studies/study/.

To get started with this template, see the instructions on [how to use this template](https://revisit.dev/docs/getting-started/installation/#starting-from-the-template-repository-recommended).

To see anything on the page you'll be serving, you will need to set up a [basic study](https://revisit.dev/docs/getting-started/your-first-study/).

For general tutorials and documentation on reVISit, see the [reVISit website](https://revisit.dev). 

Useful tutorial links:

* [Tutorial guide](https://revisit.dev/docs/tutorial/)
* [Tutorial config reference](https://revisit.dev/docs/tutorial/config.json/)
* [Replication tutorial config reference](https://revisit.dev/docs/tutorial/replication-config.json/)


## Build Instructions

To run your study based on this template locally, you will need to install node on your computer. 

* Clone your repository created based on this template.
* Run `yarn install`. If you don't have yarn installed, run `npm i -g yarn`. 
* To run locally, run `yarn serve`.
* Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes.

## Cedar Watch pilot integration (pilot approval confirmed; deployment not verified)

The draft Cedar Watch study is registered in `public/global.json` as
`cedar-watch-pilot`. Its single `website` component loads the standalone pilot from
`cedar-watch-pilot/app/index.html` and declares the reactive `pilotSession` response. `yarn build`
builds the iframe app before the host and copies the output into `public/`, so the frame is served
from this host's origin. The source checkout is pinned in `scripts/build-cedar-watch.sh` and the
deployment workflow; `CEDAR_WATCH_SOURCE_COMMIT` may override that pin for an explicitly reviewed
build. Do not change the pin for an in-progress study without the protocol's version/recovery review.
The child base path is derived from the actual host base path for `yarn build`; the deployment
workflow derives GitHub Pages project paths from the repository name, uses `/` for an owner site,
and accepts `VITE_BASE_PATH` as an explicit override. For the standalone local UI at `/`, use
`yarn build:cedar-watch` (defaults to `/cedar-watch-pilot/app/`) before `yarn serve`; do not reuse a
production-prefix artifact at the root. This is a production Vite build, so its bridge remains
disabled on HTTP localhost. A production bridge requires HTTPS and an exact approved parent origin.
The child source has a Vite-DEV-only HTTP loopback opt-in: it requires an exact loopback parent in
`VITE_REVISIT_PARENT_ORIGINS` and `VITE_REVISIT_ALLOW_HTTP_LOOPBACK=true`. No end-to-end ReVISit
host/dev-server loopback flow has been verified, so it is not claimed as supported here. Production
builds remain HTTPS-only; the production build script rejects HTTP origins and explicitly sets
`VITE_REVISIT_ALLOW_HTTP_LOOPBACK=false`. A local build needs network access to fetch the source pin.

The upstream pin predates the sibling's iframe bridge changes, so the build applies the checked-in
`scripts/cedar-watch-revisit-bridge.patch`, `scripts/cedar-watch-loopback.patch`, and
`scripts/cedar-watch-tests.patch` in order, checking each against the pin. The overlays include the
final child bridge and its relevant tests. Their combined SHA-256 prefix is included with the source
SHA in each session's `sourceCommit`. The build checks for bridge, recovery, HTTPS/loopback guard,
consent, and test markers; it runs the child typecheck and tests before building. It passes
`VITE_REVISIT_PARENT_ORIGINS` to the production build and explicitly sets the HTTP loopback opt-in
to `false`. The website config sends an empty `parameters` object to start the host/child ready
handshake.

The deployment workflow supplies `CEDAR_WATCH_PARENT_ORIGINS`; by default this is the HTTPS
`github.repository_owner.github.io` origin. Set the GitHub Actions variable
`CEDAR_WATCH_PARENT_ORIGINS` to the exact comma-separated origin-only allowlist when using a custom
approved host. Do not include paths or broad wildcards. The child must compare its configured list
with `parentOrigin` and the referrer and remain disabled if absent or mismatched. The build script
validates configured values, and production deployment requires a non-empty allowlist. Local builds
do not require Supabase or an origin allowlist; without an explicit trusted origin the child bridge
remains disabled for embedding.

This bridge and the host's current completion validator use the Cedar Watch `usability` field and
check the expected ten-trial session shape. The child sends completion to the host, but receives no
durable-write acknowledgment; host acceptance/validation is not proof that data reached persistent
storage. The user confirms applicable certifications and pilot approval. This repository does not
independently establish the certification records, verify a deployed environment, or demonstrate
durable storage. End-to-end host/browser testing, persistence/failure-mode review, and deployment
security review remain outstanding; this source checkout is not a verified collection environment.

The hosted child blocks resuming any session already stored in that browser because it cannot bind
that old local record to the host's participant record. It allows clearing the browser copy but
does not claim to delete a host-side copy. Local standalone sessions can resume through the distinct
practice before returning to trials or the survey.

Validation for the current loopback overlay: all three patches applied to the exact pinned commit,
`git diff --check` passed, and the four overlaid source/test files matched the final child files.
Child typecheck passed and `npm test` passed all 21 tests across 3 files. The production packaging
script passed typecheck/tests and built the artifact using test base
`/visualization_revisit_study/cedar-watch-pilot/app/` and HTTPS origin `https://curentleaf.github.io`;
the bundle's origin, disabled loopback flag, assets, and source/overlay fingerprint
`4b6927b12d212f139d003348b79c912a991bdb8b+bridge-224bc56c6af4a0eb` were verified. This verifies
the scripted artifact build, not an actual host deployment, durable save, RLS policy, or local HTTP
loopback integration. The Vite build emits its existing large-chunk and Zod annotation warnings.

### Storage configuration

The host reads `VITE_STORAGE_ENGINE`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` at build
time. The GitHub Pages deployment always sets `VITE_STORAGE_ENGINE=supabase` and fails unless
`VITE_SUPABASE_URL` (Actions variable) and `VITE_SUPABASE_ANON_KEY` (Actions secret) are configured.
Do not add a Supabase requirement to local builds: local `yarn build` uses the existing checked-in
local-storage setting unless the caller explicitly overrides it. The anonymous key is client-exposed
by design and is not a privileged secret; configure project policies accordingly. Never put a
service-role key in the client or in any `VITE_*` value. The repository does not contain
Cedar-Watch-owned production credentials or a verified project; until the deployment values and
project policies are approved, GitHub deployment intentionally fails instead of silently deploying
with local storage. Pilot deployment requires a study-owned project, verified row-level security
(RLS) policies, and isolated staging tests for access roles, insert/read behavior, retries,
completion persistence, export, deletion, and recovery. Do not treat RLS being enabled or the build
passing as evidence that those policies work. Existing template
`.env` values are not evidence of a study-owned/approved backend. Do not edit unrelated environment
files to enable hosted collection.

No data-security guarantees, durable-save guarantees, or production readiness are claimed by this
packaging. Static hosting itself does not provide data storage.
 
