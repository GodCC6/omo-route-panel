# Open-source Refactoring Plan

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Date: 2026-10-27
Status: P0-P4 local implementation and P5 source preparation/validation completed
on 2026-10-27. Current results and remaining publication decisions are tracked in
[implementation evidence](open-source-implementation.md). Publication acceptance
still requires the maintainer's license/upstream-terms, security-channel and
history decisions. P6 remains sequenced after the first public release;
publication is not authorized by this plan.

## 1. Product goal

OMO Route Panel is a desktop tool for inspecting and safely editing OMO model
routing. It compares upstream recommendations, personal overrides, and effective
candidate chains, and shows configuration and native-resolution changes before
an explicit save.

The first public release should let:

- An OMO user start the panel from public instructions, inspect routing in
  read-only mode, and explicitly enable editing.
- A contributor build the project and run the base test suite without the
  author's machine, personal configuration, or OMO installation.
- A maintainer identify upstream compatibility failures without reproducing
  routing semantics inside the panel.

The initial supported production environment is a verified macOS desktop
environment. Removing machine-specific assumptions does not establish support
for every operating system or OMO installation layout.

## 2. Confirmed scope decisions

### Desktop only

There is no product requirement for phone use. Mobile layouts, phone screenshots,
touch-specific sizing, safe-area handling, and mobile QA are outside this plan.

The desktop UI must work across supported window sizes. Use 1280, 1440, and 1920
CSS-pixel widths for the initial desktop verification matrix. Keep keyboard
navigation, visible focus, readable contrast, and usable browser zoom.

Existing responsive CSS does not need to be deleted merely to remove mobile
support. Change it only where it interferes with the supported desktop behavior.
Update active design and contributor guidance to remove mandatory mobile
requirements; keep historical QA records labeled as historical evidence.

### No standalone demo

Do not add a demo mode, a `--demo` option, demo-specific endpoints, or a public
fake routing engine. Use screenshots and workflow descriptions to explain the
product.

Synthetic configurations, temporary HOME directories, and fake adapters remain
test infrastructure. They are not a user-facing demo feature.

### Language policy

| Surface | Target |
| --- | --- |
| UI and maintained UI translation resources | English and Simplified Chinese; English by default |
| README.md | Complete English section first, Chinese section second |
| CLI help, diagnostics, and error messages | English |
| Other documentation and project instruction files | English |
| Code comments, test descriptions, and maintained synthetic fixture prose | English |

Conversation language is not changed by this repository policy.

Do not translate model IDs, configuration keys, paths, provider names, user
configuration values, or externally supplied text. Do not rewrite Git history
to translate old commit messages.

### Keep the product narrow

This plan does not include a framework migration, a monorepo, multiple routing
backends, a public plugin system, cloud hosting, multiple users, model inference
tests, or Linux/Windows production support.

## 3. Current implementation observations

These observations describe the pre-refactor source at `9e8bd1b`, not the
current implementation. P0 reconfirmed the baseline; see the dated implementation
evidence for fresh test results and subsequent changes.

| Area | Observed constraint | Relevant files |
| --- | --- | --- |
| Node executable | Native and metadata workers default to a Homebrew-specific path | `src/native/index.ts`, `src/metadata.ts` |
| Browser launch | The CLI directly invokes the macOS browser opener | `src/cli.ts` |
| Runtime discovery | Installation discovery depends on launcher and runtime-cache layouts | `src/runtime.ts` |
| Application tests | A fixture references an absolute personal path to OMO 5.1.46 | `test/app.test.ts` |
| Native tests | Some tests require an installed OMO runtime and a fixed Node path | `test/native.test.ts` |
| UI QA fixture | Synthetic configuration is combined with the real native adapter | `test/qa-fixture.ts` |
| Catalog refresh | Application-level refresh requires native inspection before catalog lookup | `src/app.ts` |
| SDK boundary | Package location and selected internal SDK files are assumed | `src/metadata.ts`, `src/metadata-worker.ts` |
| Browser code | Networking, state, editors, and views share a roughly 2,600-line module | `src/web/app.ts` |
| Static assets | Build copying and HTTP serving currently expect one browser script | `scripts/build.mjs`, `src/http.ts` |
| Public onboarding | README starts from a personal machine and remote-service workflow | `README.md` |
| Collaboration | No license, contributor guide, security guide, or CI workflow was found in the inspected public-file locations | Repository root and `.github/` |

The existing application already has useful boundaries: `NativeAdapter`,
catalog-provider injection, the HTTP `Application` contract, and shared API
types. Reuse these before creating new abstractions.

## 4. Invariants to preserve

- Native reports remain the routing oracle; do not implement a second routing
  algorithm in application code, tests, or the UI.
- The panel describes new-task configuration, not active sessions or successful
  model calls.
- Read-only remains the default. A save requires explicit edit mode and a valid
  preview.
- Native and Settings remain separate save groups.
- Configuration or engine changes invalidate dependent snapshots and previews.
  The UI retains unsaved drafts.
- Save and undo operate on permitted nodes and preserve unrelated configuration.
- Preserve single-write locking, dependency checks, and pre-commit checks.
  Do not describe them as atomic compare-and-swap against external editors.
- Unknown catalog availability is not an empty catalog. Previous results may be
  displayed only with their stale state.
- Do not send model probes or start a session to inspect routing or metadata.
- Do not weaken Host, Origin, bearer-token, or remote-identity checks.
- Diagnostics must not expose credentials, raw SDK exceptions, or configuration
  documents. Development and QA use synthetic credentials and temporary files.
- Localization must not alter routing, identifiers, configuration data, or
  authorization decisions.

## 5. Delivery phases

### P0. Establish the behavior baseline

Run the repository's current checks with the existing supported toolchain in an
isolated validation workspace. Start with an empty `dist` directory so removed
or renamed source tests cannot survive as compiled tests. Do not clear or
replace build output used by the running personal service.

```sh
bun run check
bun run lint
bun run build
bun run test
```

Build must precede tests because tests execute compiled files in `dist/test/`.
Record the source revision, lockfile digest, actual Node, Bun, OMO, and SDK
versions, and the clean-build procedure alongside the results. Separate
pre-existing failures from machine-specific assumptions and upstream changes.
Do not weaken assertions to manufacture a green baseline.

Before relying on contributor CI, verify dependency acquisition in a fresh
environment with no personal registry configuration, account credentials, or
pre-populated dependency cache. Install with the committed lockfile using
`bun install --frozen-lockfile`; a lockfile mismatch is a failure, not permission
to regenerate it during validation. Check that installation leaves the lockfile
unchanged. Do not copy credentials to make this check pass.

This early check establishes dependency availability, not distribution rights.
If public acquisition fails, record it as a blocker for P3's contributor CI and
the public release, then resolve the dependency strategy before claiming those
paths reproducible. Final license selection and distribution review remain P5
publication decisions.

Inventory tests by the behavior they protect and whether they need a real OMO
installation. Record the existing save, conflict, undo, shutdown, and
zero-inference evidence.

Acceptance:

- Current results and known failures are recorded without reusing historical
  test counts as current evidence.
- The baseline comes from an empty build output, not an incremental build with
  potentially orphaned compiled tests.
- Account-free frozen-lockfile installation has a recorded result. Any failure
  is an explicit blocker for contributor CI and release readiness.
- Every existing test has a destination in the base or native integration suite.
- The behavior invariants above have identified validation coverage.

### P1. Remove machine-specific startup assumptions

Primary files: `src/cli.ts`, `src/runtime.ts`, `src/native/index.ts`,
`src/metadata.ts`, and their tests.

Resolve runtime inputs at the CLI composition boundary and pass them into
existing modules:

- Use the Node executable running the CLI by default, subject to capability
  validation.
- Add explicit `--node-path` and `--omo-path` overrides.
- Preserve canonical-path and digest checks binding a launcher to its runtime.
- Keep internal report paths and installation-layout assumptions within runtime
  discovery and native adaptation, rather than spreading them into application
  and UI code.
- Isolate browser opening from application startup; implement the supported
  macOS path only.
- Add `--doctor` for static installation and capability diagnostics. It must not
  start an HTTP server, run hooks, inspect real credentials, or issue model calls.
- Replace the exact Node patch requirement with an explicitly tested range only
  after verifying the required permissions and process behavior.

#### Runtime input contract

| Input | Meaning and precedence |
| --- | --- |
| `--node-path` | A Node executable path. The explicit value takes precedence over `process.execPath`; both native and metadata workers receive the selected value. |
| `--omo-path` | An OMO launcher executable path, not a runtime directory. The explicit value takes precedence over the existing `~/.local/bin/omo` default. |

Resolve relative overrides against the CLI's working directory, then retain
both the source path and canonical target for identity checks and change
detection. An invalid explicit override must fail its capability check rather
than silently falling back to another installation.

Keep runtime-root discovery internal. Test a launcher linked directly into a
runtime directory and a copied launcher matched to its runtime-cache binary by
digest. A missing cache must not prevent discovery beside a valid launcher.
Reject directory inputs, unmatched launchers, and dangling links with actionable
diagnostics. Do not select an unrelated or merely newer cached runtime.

`--doctor` reports the selected inputs and sanitized capability failures without
reading personal configuration or importing configuration-consuming runtime
entry points. Native-specific discovery or report failures must remain distinct
from SDK catalog capability; they must not become a global startup gate that
defeats P2's diagnostic and catalog-only behavior.

Acceptance:

- Supported installations work outside the author's username and project path,
  including a non-Homebrew Node path.
- Explicit overrides remain subject to runtime identity and capability checks.
- Tests cover override precedence, relative paths, the supported launcher
  layouts, an absent cache, mismatches, and launcher replacement after startup.
- Missing or incompatible installations produce actionable English diagnostics.
- Read-only startup, shutdown, and child-process cleanup retain their behavior.

### P2. Clarify upstream boundaries and capability states

Primary files: `src/native/`, `src/runtime.ts`, `src/metadata*.ts`,
`src/background.ts`, `src/app.ts`, and `src/types.ts`.

- Keep native report loading, shape validation, installation binding, and
  real/mirror comparison behind the existing native adapter.
- Keep SDK location, internal imports, fingerprinting, and field sanitization
  behind the metadata boundary. Verify package discovery against the intended
  distribution layout.
- Remove native-report compatibility as a prerequisite for catalog refresh.
- Represent catalog availability, native compatibility, snapshot freshness, and
  write eligibility separately. Do not use catalog success as write permission.
- Preserve conservative failure for untrusted routing results.
- Document the basis of manually maintained background defaults. Mark
  unverified semantics unknown rather than silently assuming compatibility.
- Keep the application's preview/save/undo transaction lifecycle together; do
  not split locks and invalidation across new services for organizational symmetry.

#### Background semantic evidence

A valid routing report does not verify background-task defaults or override
rules. Track their verification separately from report shape and real/mirror
equivalence. For each maintained rule, record its upstream implementation or
contract reference, the relevant artifact identity, the verification method,
and the affected output fields.

Cover default switches, the global memory gate, identity overrides, Sync's
global-only settings, Facts' explicit-model and user-quick-chain precedence,
and Dream's relationship to Reflection and dynamic selection. Preserve native
reports as the source of candidate chains; do not introduce a second resolver.

Bind semantic evidence to the relevant installed artifacts, not just a version
string or the routing-report module digest. Missing evidence or changes to those
artifacts invalidate the affected semantic claims. Mark only the dependent
background fields unknown with a reason; do not turn unrelated verified routes
unknown or interpret unknown as disabled.

Synthetic tests protect the panel's mapping but do not establish upstream
agreement. Release evidence must also verify these rules against the supplied
installation through a safe read-only contract check or a recorded source
inspection where no suitable interface exists. Neither method may start a
session, execute hooks, or make inference calls.

#### Capability and transition contract

Define these states in the shared API contract and use the same eligibility
rules in the UI and server. UI-disabled controls are not server authorization.
Catalog refresh and sanitized diagnostics remain available in every row,
subject to authentication and their own capability failures.

| Situation | Native routing state | Catalog state | Snapshot and display | Preview, save, and undo |
| --- | --- | --- | --- | --- |
| First inspection fails, catalog succeeds | Unverified or incompatible | Fresh | Diagnostics and catalog; no trusted routes | Denied |
| Native inspection succeeds, first catalog lookup fails | Inspection alone does not prove route resolution | Unknown | No fabricated empty catalog or trusted effective routes | Denied |
| Refresh fails after a successful catalog lookup | Previous resolution is not current proof | Stale | Previous results explicitly stale; drafts retained | Denied; old previews invalid |
| Configuration or engine changes after a valid snapshot | Revalidation required | Independently fresh, stale, or unknown | Affected snapshot and previews invalidated; drafts retained | Denied until refresh and a new preview |
| Catalog succeeds but native resolution or mirror comparison fails | Incompatible for this result | Fresh | Diagnostics; any retained routes explicitly stale | Denied |
| All required checks succeed | Verified | Fresh, including a successfully queried empty catalog | Current results; empty does not mean unknown | Eligible only in edit mode and subject to operation validation |
| Recovery after failure or invalidation | Newly verified | Fresh | New snapshot; drafts retained | Old previews stay invalid; new preview required |

Undo requires the same trust, freshness, and dependency checks as other writes:
prepare a new undo preview, then explicitly save it. A journal's existence is
not write eligibility. Read-only mode denies all write preparation and commit
paths regardless of the other states. A fresh empty catalog does not bypass
model validation or imply that every operation can be saved.

Acceptance:

- Catalog lookup remains usable when native-report adaptation fails.
- Native adaptation failure prevents preview/save/undo without preventing
  diagnostics.
- Unknown and stale catalog states retain their distinct behavior.
- Tests cover the capability table, including failure after success, recovery,
  read-only mode, a fresh empty catalog, and undo.
- A changed background-semantic artifact with an otherwise unchanged valid
  report invalidates affected claims without hiding independently trusted data.
- Background semantic evidence identifies which rules have upstream validation
  and which remain unknown; synthetic coverage is labeled separately.
- Upstream interface changes can be addressed within the relevant boundary.
- Existing configuration fidelity and zero-inference checks remain intact.

### P3. Make validation reproducible for contributors

Primary areas: `test/`, `package.json`, test helpers, and CI workflows.

Provide explicit test entry points:

| Suite | Required environment | Coverage |
| --- | --- | --- |
| Base tests | No installed OMO and no personal account | Node editing, application transactions, HTTP boundaries, synthetic worker contracts, and UI state |
| Native integration tests | An explicitly supplied supported OMO installation | Native resolution, real/mirror equivalence, report contracts, and launcher changes |

Use the existing adapter-injection boundary for application tests. Keep real
native integration assertions; replacing all of them with fake responses would
lose the project's most important correctness evidence.

- Remove absolute personal paths and fixed runtime-cache versions from fixtures.
- Run base checks on ordinary pull requests without personal secrets or a
  private machine.
- Use frozen-lockfile installation in CI, recording the source revision,
  lockfile digest, and Bun version. Resolve P0's dependency-acquisition blockers
  before treating this path as supported.
- Build validation artifacts from an empty output directory in an isolated
  workspace. Give each suite an explicit, non-overlapping set of current test
  artifacts; do not keep scanning a mixed output directory after moving tests.
  Document the clean-build step used by contributors and CI.
- Require native integration results for release validation in a controlled
  environment. Run them automatically only where installation provisioning has
  been verified.
- A requested integration run without its required environment must fail
  explicitly, not silently skip and report success.
- Keep metadata SDK tests using synthetic configuration separate from personal
  account availability.
- Verify P2's background semantic evidence against the supplied installation.
  Report safe upstream contract checks and recorded source inspections
  separately from synthetic assertions; missing evidence cannot count as a
  passing upstream semantic check.
- Subscribe to async state changes before triggering them, with bounded
  timeouts; do not introduce fixed sleeps or timing-luck assertions.

Acceptance:

- A fresh checkout can build and run the base suite without OMO installed.
- An explicit supported installation is sufficient for the integration suite.
- Suite names and CI reports distinguish synthetic coverage from native evidence.
- Moving or renaming a test cannot leave a runnable orphan in either suite.
  Suite discovery agrees with the P0 inventory, including shared helpers that
  must not execute tests from the other suite.
- No existing behavior assertion is discarded just to remove an environment
  dependency.

### P4. Apply repository language policy and bilingual desktop UI

Primary areas: `src/web/`, user-visible server messages, `src/cli.ts`, maintained
fixtures, tests, `docs/`, `DESIGN.md`, and project guidance.

Use a small typed translation dictionary and formatting helper. Do not introduce
a general internationalization framework for two languages.

- Provide an `English / Chinese` language selector.
- Default to English on first use, regardless of browser language.
- Persist an explicit selection locally. Store only the language preference,
  never access tokens, configuration content, or drafts.
- Switch language without reloading or issuing save operations.
- Preserve drafts, active editors, filters, navigation, valid previews, and focus
  through a language switch.
- Translate controls, errors, notices, loading and empty states, accessibility
  labels, and explanatory UI content.
- Update document language and language-sensitive formatting when switching.
- For application-owned explanations supplied by the backend, expose stable
  message identifiers and parameters where needed so the UI can translate them.
  Keep CLI and non-UI diagnostics English; do not translate arbitrary external
  text or broaden raw diagnostic exposure.
- Migrate cached application-owned presentation text as part of P4, not P6.
  Draft summaries and details, editor errors, preview invalidation reasons,
  save errors, and notices must retain message identifiers and parameters or be
  derived from their underlying operations at render time. Do not store only
  the already translated string.
- Translate existing state and newly arriving async results in the currently
  selected language. Switching must not rebuild operations, refresh the
  snapshot, or regenerate a valid preview merely to update its explanations.
- Convert non-README documentation, comments, test descriptions, and synthetic
  prose to English.
- Make README a complete English-first, Chinese-second document. Keep install
  steps, support boundaries, and examples equivalent in both sections.
- Update active design requirements to desktop-only bilingual verification.

Acceptance:

- Both UI languages cover normal, read-only, incompatible, stale, conflict,
  disconnected, and empty states.
- First-use English and persistence of an explicit language choice are verified.
- Switching preserves drafts and previews and does not change model identifiers.
- Create drafts, a valid preview, and an application-owned notice or error
  before switching in both directions. Existing explanations update while
  operation payloads, draft fingerprints, snapshot IDs, and preview IDs remain
  unchanged; switching initiates no API request. Separately cover invalidated
  previews and a response arriving after the language switch.
- A behavioral test checks translation-key parity and relevant language/state
  values without pinning whole paragraphs of prose.
- Source scanning is a review aid for unintended Chinese outside the allowed
  bilingual surfaces, not a ban on Chinese user input or external values.
- Actual desktop interaction and screenshots cover both languages and themes.

### P5. Prepare public onboarding and a source release

Primary areas: `README.md`, `docs/`, license and collaboration files, package
metadata, and public deployment instructions.

Recommended README order:

1. Product purpose and desktop screenshots.
2. Prerequisites and real read-only quick start.
3. Explicit edit mode and the preview/save/undo workflow.
4. Supported environments and compatibility boundaries.
5. Development and validation.
6. Optional remote deployment.

Additional work:

- Add a maintainer-approved license, contributor guide, and security-reporting
  instructions.
- Confirm upstream dependency availability and applicable distribution terms.
  Do not bundle an installed OMO runtime without resolving those conditions.
- Repeat P0's account-free frozen-lockfile installation against the release
  candidate and its committed lockfile; do not defer its first feasibility
  check until this phase.
- Separate personal operational information from reusable deployment guidance.
- Keep launchd and Tailscale optional. Preserve current entry points or update
  their references and migration instructions together.
- Review current public files and the proposed publication history for private
  operational information. Resolve any history issue separately; do not rewrite
  history as part of routine documentation cleanup.
- Update the public documentation index and README links to the final structure.

Start with a source release. Publishing an npm package is not a prerequisite:
`private: true` may remain until registry distribution is a deliberate decision.

Acceptance:

- A reader can install dependencies and start real read-only inspection using
  only the English README; the Chinese section provides equivalent instructions.
- The release does not depend on personal paths, private registry access, or
  mandatory background services.
- License, dependency distribution, publication contents, and optional service
  migration have been reviewed.
- Release evidence identifies exactly which checks ran, the source revision
  and lockfile digest, the actual toolchain versions, and the environment.

### P6. Reduce frontend maintenance cost after the first release

Primary areas: `src/web/`, `scripts/build.mjs`, and `src/http.ts`.

P6 is not a first-release prerequisite. P4 includes its small translation module
and the cached presentation-state changes required for language switching,
without undertaking the broader frontend split.

Keep native DOM rendering and the existing visual design. Extract coherent
responsibilities incrementally, starting with transport and state logic:

```text
src/web/
  app.ts           # Initialization and view coordination
  api.ts           # Requests, session renewal, and SSE
  state.ts         # Draft, preview, and snapshot transitions
  i18n.ts          # Translation lookup and language preference
  dom.ts           # DOM and focus helpers
  components/      # Model picker, candidate chain, and diff display
  views/           # Navigation sections
```

This is a boundary guide, not a requirement to create every directory or extract
every helper. Avoid circular imports and modules that merely share unrestricted
mutable global state.

If browser modules are served separately, copy their compiled assets in the
build and extend the explicit HTTP resource allowlist. Do not expose arbitrary
compiled server files or introduce a general filesystem-serving route.

Acceptance:

- Every browser module loads under the existing content-security policy.
- No server-only module or configuration file becomes a public asset.
- Preview invalidation, cross-group draft retention, conflict handling, SSE
  renewal, language switching, and focus restoration retain their behavior.
- Changed desktop surfaces pass the verification matrix below.

## 6. Dependency order and change discipline

```text
P0: Clean behavior baseline and public dependency acquisition
  -> P1: Runtime inputs and machine independence
  -> P2: Native/metadata boundaries and capability states
  -> P3: Reproducible validation
  -> P4: English repository and bilingual desktop UI
  -> P5: Public onboarding and release validation
  -> First public source release
  -> P6: Incremental frontend modularization
```

Documentation drafting can proceed alongside implementation. Final commands,
screenshots, supported versions, and compatibility claims must be verified
against the release candidate.

P0's account-free dependency acquisition is a prerequisite for P3's contributor
CI claim and is repeated in P5 against the release candidate. A failed probe
does not prevent independent local work, but must not be hidden behind a later
publication-only checklist.

Use independently reviewable increments. Keep path resolution, capability-state
changes, test restructuring, localization, and documentation changes separable.
Preserve a passing supported path at each increment; do not combine behavior
changes with broad file moves unnecessarily.

## 7. Verification and release gate

### Automated checks

- Type checking, lint, and build succeed.
- Validation builds start from empty output in an isolated workspace; no
  removed, renamed, or other-suite test artifacts can enter the run.
- CI and release-candidate dependency installation use the committed frozen
  lockfile without personal registry credentials. Record the source revision,
  lockfile digest, and Bun version, and reject lockfile drift.
- The base suite passes in a clean environment without OMO installed.
- The native integration suite passes against the explicitly recorded supported
  installation.
- Synthetic SDK tests continue to demonstrate no hooks or inference requests.
- Tests exercise P2's capability transitions and server-side preview/save/undo
  gates, including failure after success and recovery without reviving previews.
- Background semantic invalidation is tested independently of report-shape
  compatibility; current upstream semantic evidence is reported separately
  from synthetic tests.
- Language-key coverage and state-preserving switching are checked without
  brittle full-prose assertions, including cached explanations and async results.

### Desktop behavior

Use temporary HOME directories and synthetic configuration for all write tests.
Verify preview, explicit save, external-conflict rejection, undo, and retention
of unrelated fields. Real personal configuration remains read-only during QA.

Check affected navigation sections at 1280, 1440, and 1920 CSS-pixel widths in
English and Chinese, with light and dark themes. Cover long model IDs, long
paths, warnings, empty states, and the edit/review workflow.

Verify keyboard operation, visible focus, and 200% desktop browser zoom without
losing access to actions or content. Zoom testing is an accessibility check, not
a requirement to implement a phone layout.

No phone layout, mobile emulation, mobile screenshots, or touch-device
certification is required.

### Release gate

The first public release requires P0-P5 acceptance, not P6:

- Clean installation, base validation, and real read-only startup are reproducible.
- Native integration and temporary-config write workflows have current evidence.
- Background defaults and override rules have installation-bound evidence or
  explicitly scoped unknown states; report compatibility alone is insufficient.
- Desktop UI language switching works with English as the first-use default.
- Existing drafts, notices, errors, and preview explanations switch language
  without changing operations or preview validity.
- All maintained non-README documentation is English; README is bilingual.
- Public-file, dependency, license, and proposed publication-history reviews are
  complete.
- Existing personal service usage has a documented migration path.
- Unrun checks and residual compatibility limits are stated explicitly.

## 8. Decisions required before publication

- The maintainer selects the license after reviewing upstream distribution
  conditions.
- The maintainer decides whether to publish existing history or a separately
  prepared publication history.
- The supported Node range and verified OMO/SDK combinations are finalized from
  measured results, not version guesses.

These publication decisions do not prevent local implementation of the plan.
No release, push, history rewrite, or live-service restart is authorized by this
document alone.
