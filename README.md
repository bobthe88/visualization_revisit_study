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
compatible with its analysis. Visualization selections, interaction samples, and event/timing
telemetry are not captured as trial data in this flow. Do not infer attention, active time, or which
reports a person selected. Inventory actual host export fields before analysis and define/test a
versioned mapping; none is currently validated.

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
build. The latest reported exact-build browser test observed no ipify or other off-origin calls
among 119 requests. This observation applies to that tested synthetic build, not production or an
undeployed preview; production's external request remains subject to privacy review. Do not claim
that production is fully offline or that the production lookup has been disabled.

An earlier local-browser rehearsal reported in `artifacts/design.md` used the current config served
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

An earlier synthetic preview publication was reported at
`https://bobthe88.github.io/visualization_revisit_study/` (workflow run `42510782417`, commit
`d709c1c2d3d6b90e392febfb182e97055e9268db`). That earlier run's HTTP 200 and bundle check do not
establish the contents of a later publication. For each manual preview dispatch, verify the exact
revision and run outcome, then inspect the served config, visualization document, warning, and
storage mode. Publication may replace the repository's active Pages contents. The separately
selected Supabase collection path remains unverified and is not enabled by this synthetic preview.
Keep using synthetic data only until scientific, governance, privacy, storage, security, recovery,
and release gates are separately reviewed and verified.
