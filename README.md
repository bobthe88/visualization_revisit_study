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

## Cedar Watch synthetic preview: current behavior and limits

### Candidate pin reconciliation

Option #1 reconciled the candidate child pin and its documentation. Option #2 is implemented as an
offline, synthetic-only converter in `scripts/convert-cedar-watch-preview.mjs`, with tests in
`scripts/tests/`. It consumes raw host `ParticipantData` as one object or an analysis-download array
plus the matching stored config. Its only supported config hash is
`80d5196e20bbb0bb176122315bb06619ef0b1aeed87e47ff7a15f4251896d89e`, verified as SHA-256 of UTF-8
`JSON.stringify(parsedConfig)` (the host method). No Supabase work is authorized. The build script specifies child source
`898f8af4ddc54a09e4a5b8d9a7766b78600b6e7c` and only
`scripts/cedar-watch-testing-library.patch`, which pins the child test dependency
`@testing-library/dom` to `10.4.1`. The user reports that the sole patch was applied, the candidate
build passed, child tests passed 27, and root tests passed 90 on rerun. An independent
tester reports a local HTTPS browser run against the exact built `dist`, completing all ten trials
and the survey with no off-origin requests observed. The reported full host suite had 2109 passed,
1 failed and 1 skipped; the failure is reported as a preexisting missing fixture, not a passing
suite. Separate script tests passed. These are reported results, not rerun during this documentation
update. They do not establish production readiness. No candidate live deployment is reported. Earlier
publications and the separately identified older test evidence below remain historical baseline
evidence and must not be attributed to the candidate.

The host-owned, fixed-group synthetic instrument is a scientific change from the earlier
child-owned, four-group standalone baseline, not merely a packaging update or a proven equivalent
instrument. Preserve the historical baseline and review the exact candidate stimuli, behavior and
analysis implications with investigators before any participant use. The source pin change itself
also needs a reviewed comparison against that baseline; the patch's test dependency scope does not
establish equivalence of the upstream source.

The script rejects a source override unless it equals the reviewed SHA, before fetching. A different
revision requires review and an update to the allowlist. Both deployment workflow definitions pin
the reviewed SHA. The source guard checks markers in their designated bridge, contract, visualization,
Vite and test files; `yarn test:cedar-build` checks the guard, workflow pins and override rejection,
and the lint/build CI workflow runs it. The guard CLI now handles paths containing spaces; the user
reports all 4 guard tests passed, including valid and invalid inputs through that CLI. This result
was not rerun for this documentation update. CI configuration is not evidence of a successful remote run.
Marker checks are not behavioral proof.

The script verifies the fetched commit, applies the patch and checks source markers. It hashes the
actual Git `HEAD` tree ID and the patch file's SHA-256 as the exact UTF-8 line
`<tree-id>  <patch-sha256>\n`, SHA-256 hashes that line and takes its first 16 hex characters.
The child build receives `VITE_SOURCE_COMMIT` as
`<commit>+testing-library-<16-character-hash>`. This is not a hash of the commit plus patch, nor
an artifact digest or proof of reproducibility. The reported build's source tree is
`ecedace4ca3ec38fa74ff7fa5d0d3a0a406cb0fe`, patch SHA-256 is
`683451099d37f879ff703da2316a8b3f6e33b40fd9b5923fe34db1f19ffed74f`, and fingerprint is
`898f8af4ddc54a09e4a5b8d9a7766b78600b6e7c+testing-library-72815a6ee6386fcc`. The reported
environment was Linux arm64, Node 24, npm 11 and Yarn 1. The reported origin was
`https://bobthe88.github.io`, host base `/visualization_revisit_study/`, and child base
`/visualization_revisit_study/cedar-watch-pilot/app/`. The temporary candidate artifact assembled
over host `dist` had 272 files and digest
`93abfa3ec2111171b5d74473455bb231dd263b28b2be58b41bc37a7239437250`; its child output had
6 files and digest `fb59158d49e7cd129443afc686aef15d8a4d0cf0dfe3a2972adbd358e9d9b4f6`. Each
digest is SHA-256 of a manifest ordered by lexical relative path, with each line formatted
`<sha256>  <relative path>\n`. The host base commit was reported as `6acb1e3` with dirty non-doc
source digest `7ee5d989b3a5fef3f76190c41f95d6283c01663fe842b612bbaf0e127c102333`, derived from
the base, binary diff and untracked guard files. The reported output digest and exact-dist browser
evidence are historical: the artifact predates the final guard source change and does not exactly
match the final commit. This working-tree build output is not a clean commit, deployed-site digest
or independent reproducibility proof. Host source may have changed after the build, and the final
commit does not have the same identity as this working-tree digest. No new preview was published.
See `artifacts/design.md` for remaining provenance limits.

The inspected visualization source uses a Vega interval brush on applicable time charts, but its
hosted `VisualizationApp` does not pass `onBrush` to `VegaChart`. The brush can be drawn in the
chart without a host-level time-filter callback; selections and brush events are not recorded as
trial data. Confirm behavior against the exact pinned checkout and have investigators review its
scientific implications. This is not evidence of stimulus equivalence.

The current checked-in study is registered as `cedar-watch-pilot` in `public/global.json` and
configured in `public/cedar-watch-pilot/StudyConfig.json`. The host, not the embedded app, owns the
study flow: a fictional practice with feedback, ten trial questions, confidence and perceived-
difficulty ratings, then a usability survey and debrief. Each trial's iframe displays the evidence
visualization only. The question and four answer choices (including `unknown`) and the ratings are
native reVISit sidebar controls. The frame does not own or submit the old complete `pilotSession`
instrument.

This is a synthetic preview with a fixed group 0 and stimulus seed 271828; assignment is neither
randomized nor participant-hashed. The preview requests and records no research consent. An
acknowledgement or preview warning is not consent. Do not use this configuration for participant
data or describe it as an approved collection study.

### Responses, evidence, and missing data

The host records answers and ratings as native responses in its browser-local state. Practice is a
separate response and must not be counted as an experimental trial. Trial identity and the fixed
family/variant/condition assignment come from the study configuration and must be joined to host
records using the appropriate component and configuration version. `unknown` is an answer, not a
missing response. Host exports are not the standalone child's session JSON/CSV and are not directly
compatible with its analysis. The offline converter emits a distinct
`cedar-watch-research-preview/1` schema; it validates the frozen sequence, legal choices and trial
parameters and separates practice, survey and debrief. The raw participant record does not establish
the study namespace: output therefore uses `sourceStudyId: null`, names the value as
`configuredInstrument`, and includes only the hash-verified config identity. Each trial tuple is
nested under `configuredTrial`; it describes config, not observed exposure. `observedExposure` stays
null, including when a response component exists, because the host record does not prove what was
actually rendered. Missing trial entries and answers remain missing. When a StoredAnswer supplies
`optionOrders`, host-rendered labels, values and `infoText` are checked against config while allowing
ordering permutations; unsupported option fields and conflicting tooltip text are rejected. If an
`optionOrders` object is present but omits any configured response entry, the record is quarantined
even though the host may fall back to config options at render time; that incomplete-order fallback
is intentionally excluded because it does not prove the choice set recorded for that component.
Visualization interactions, child timing,
consent and session identity are not captured or fabricated. Host timestamps and window events may
exist in raw exports but are not child interactions or validated active time. The source participant
ID is retained as a pseudonym, but it remains a linkable identifier and is not de-identification;
protect both raw and converted outputs. Raw inputs can contain sensitive metadata. This
synthetic-only mapping is not an approved analysis dataset or evidence of collection readiness.

Run locally with `node scripts/convert-cedar-watch-preview.mjs <participant.json> <stored-config.json> <new-output.json>`.
Run it from a trusted private output directory. The CLI requires a new, non-existing output path,
uses an exclusive link to publish a fully written temporary file, and never logs participant fields.
This does not protect against a hostile actor concurrently changing a writable output directory.
It accepts a raw participant object or an analysis-download array (whose rows may include
`qualitativeCodes`). `cedar-watch-analysis-download.json` is a sanitized, derived fixture captured
from the actual local DownloadButtons JSON download; it is explicitly not a raw exact download. It
contains one participant with all 13 component-answer records, `completed: true`, and the matching
analysis config is `cedar-watch-analysis-config.json`; tests pass the fixture's inner `participants`
array directly to the converter and golden-compare all normalized response values, trial tuples,
completion/rejection status, configured-trial provenance, null exposure, practice/survey/debrief and
non-captured telemetry declarations. The
single-record unit tests derive a raw participant-shaped value from that same sanitized row by
removing only the analysis wrapper in test code; neither form is presented as a raw exact export.
Input files must be regular files and are read through
a bounded stream, capped at 10 MiB; nesting is capped at 64 and arrays at 100 participants. Output is
capped at 10 MiB after serialization; that output check is not itself a memory bound. Duplicate JSON
keys are rejected. Empty arrays produce a valid zero-record envelope. Completion remains
boolean/null/unknown as observed. A valid ended component remains ended if its end timestamp is less
than its start timestamp, with `timingAnomaly: true`; a wall-clock rollback is possible, and no
duration is inferred. Only the host-supported rejected values (`false` or a reason/timestamp object)
are accepted; the object timestamp must be finite. Only explicit validation errors quarantine a
participant row; unexpected converter errors are not silently relabeled as invalid input. The CLI
hashes the exact input bytes; direct calls on parsed objects report a
null source-byte digest and cannot supply one. Invalid participant rows contain only source index and
a safe reason code in diagnostics.

CI runs the converter and parser security suites explicitly with `yarn test:cedar-export`; those
Node-native tests are excluded from Vitest discovery. Latest local checks: this command passed 22
tests, `yarn unittest run src/storage/tests/analysisDownloadFixture.spec.ts` passed 4 tests, and
`yarn lint`, focused ESLint, and `yarn typecheck` passed. The full `yarn unittest run` completed with
152 files passed, 1 failed, 2113 tests passed, 1 failed, and 1 skipped. The one failure is the known
dynamic-fixture expectation in `src/routes/tests/utils.spec.tsx:227` (`HSLColorCodes` expected,
`__dynamicLoading` received); the full suite is not wholly passing.

The preview uses browser `localStorage`, not a verified central durable store. Browser data may be
cleared, unavailable, or lost; a downloaded export is a separate copy. Progress or completion in
the interface is not proof of a durable save, recovery, or successful collection. Supabase
collection is pending: no Supabase configuration, effective permissions/RLS, deployment, durable
acknowledgement, or recovery has been demonstrated for this current flow. Never put a service-role
credential in a browser build. No data-security, durable-save, or production-readiness guarantee is
made.

### Existing evidence and controls

The source configuration and host code provide evidence for the current flow and response controls;
mocked iframe/controller and storage tests provide narrower checks of existing host behavior. In
`src/components/Shell.tsx`, the IP lookup to `https://api.ipify.org?format=json` is skipped in the
`synthetic-preview` mode, but remains in production mode. An earlier local rehearsal identified
that request; it is historical evidence and does not describe the current exact synthetic-preview
build. An earlier reported exact-build browser test observed no ipify or other off-origin calls
among 119 requests. This observation applies to that tested historical synthetic build, not the
candidate, production or an undeployed preview; production's external request remains subject to privacy review. Do not claim
that production is fully offline or that the production lookup has been disabled.

Historical evidence, separate from the candidate reruns above: an earlier local-browser rehearsal reported in `artifacts/design.md` used the current config served
separately from an earlier built artifact, so that run alone was mixed-version evidence. An
independent tester later exercised the exact rebuilt `dist` over local HTTPS in Chromium, completing
practice (including a wrong answer), all ten trials, the survey, and debrief; required-answer gating
and iframe contents were checked. The test observed 119 requests with no off-origin requests and no
browser errors. This is evidence for that tested synthetic artifact and flow, not for production,
Supabase persistence, or whichever artifact is currently published on Pages. The local child suite
passed 27 tests across 5 files; the focused host tests run here passed 40 tests across 4 files, and a
separate tester reports 51 host tests passed with additional suites included. Lint and typecheck
passed. Supabase setup/access tests, export mapping, and other failure-path coverage remain pending.
See `artifacts/design.md`, `artifacts/tasks.md`, and `artifacts/plan.md` for further evidence and open
work.

### Build and local HTTP caveat

`yarn build` packages the child visualization into the host's `public/` tree using
`scripts/build-cedar-watch.sh`; a local build fetches the pinned child source and therefore needs
network access. The production child bridge requires HTTPS and an exact trusted parent origin. Its
HTTP loopback option is restricted to Vite development, with an exact loopback parent allowlist and
explicit opt-in. No end-to-end ReVISit host/dev-server HTTP loopback flow has been verified; do not
assume that serving the production build at `http://localhost` enables the iframe bridge.

The user reported an earlier synthetic preview at
`https://bobthe88.github.io/visualization_revisit_study/` (workflow `42510782417`, commit
`d709c1c2d3d6b90e392febfb182e97055e9268db`), followed by the host-question preview at commit
`69965bfce523f35fe8d6870d56a4df93ed187058` (workflow `42526395126`) and a direct-entry fix at
commit `56f83c87d757e3fa9bc459db483d75b6bfc4ec30` (successful workflow `42527513101`). Root and
direct entry were reported HTTP 200 after the fix. A separate partial live check observed the first
trial and sidebar and 73 same-origin requests, but is not tied here to the fixed deployment. These
reports were not independently rerun; HTTP 200 does not prove rendering, refresh or a complete live
flow. The direct-entry fix is a synthetic-preview deployment claim, not proof that the separate
production workflow has the same behavior.

For each manual preview dispatch, verify the exact revision and run outcome, then inspect the served
config, visualization document, warning, storage mode, rendered direct entry and refresh. Publication
may replace the repository's active Pages contents. The previously proposed Supabase collection path
remains unverified and is not enabled by this synthetic preview; no Supabase work is in the current scope.
Keep using synthetic data only until scientific, governance, privacy, storage, security, recovery,
and release gates are separately reviewed and verified.
