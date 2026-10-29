# Open-source implementation evidence

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Catalog-source follow-up (2026-10-27): this record predates the live TUI catalog
correction. The current source contract and its verification are documented in
[live catalog evidence](catalog-source-2026-10-27.md). Results below remain
historical evidence for their recorded source revisions.

## P0 baseline (2026-10-27)

Source revision: `9e8bd1b`. Lockfile SHA-256:
`b187cd61870a1533cce241b4e8661777bee8f8fe1960205d7d13fe8d65359f06`.
Host: macOS arm64. Node: `v26.11.1`; Bun CLI: `1.3.14`.
The agent's resident Bun kernel is not the repository's Bun CLI version.
Installed OMO package: `5.1.48`; dependency SDK:
`@code-yeongyu/senpi@2026.10.23-1`.

An archive of the source revision was extracted to a new directory under HOME,
with no `dist` directory. Existing dependencies were linked for this baseline
only. `bun run check`, `bun run lint`, `bun run build`, and `bun run test`
all exited 0. The current run passed **84 tests**, with no failures, skips,
cancellations, or pending tests. The personal service's build output was not
modified.

This is a machine-supported baseline, not contributor reproducibility evidence:
application tests explicitly link an older `5.1.46` installation, and native
tests discover the host installation and use a Homebrew Node path. These
assumptions are P1/P3 work, not baseline failures.

### Account-free acquisition

A second source archive was installed with `bun install --frozen-lockfile`
under `env -i`, an empty temporary HOME, an empty dependency cache, and no
personal registry configuration or account environment. Public acquisition
succeeded (244 packages, exit 0). Lockfile SHA-256 before and after matched
the digest above. No lockfile regeneration or credential copying was used.
This establishes availability for this host, not distribution rights or a
claim about untested operating systems.

### Test destinations and invariant inventory

Every existing test file has a destination; mixed files retain their assertions
when split. Current file names below identify the baseline, not final suite
discovery rules.

| Baseline file | Destination | Protected behavior |
| --- | --- | --- |
| `app.test.ts` | Base transaction coverage through adapter injection; real report assertions remain native integration | Preview without writes, minimal save, undo with unrelated edits, group invalidation, conflict refusal, complete IDs, catalog stale retention, background mapping, launcher invalidation |
| `background.test.ts` | Base | Synthetic mapping of switches, identity overrides, Facts, Dream, Sync, and unknown states; not upstream semantic proof |
| `config.test.ts` | Base | Node edits, JSONC fidelity, allowed fields, symlinks, permissions, pre-commit conflicts, undo |
| `http.test.ts` | Base | Host, Origin, bearer and remote identity checks, read-only routes, error sanitization, static allowlist |
| `metadata.test.ts` | Base, using installed project SDK and synthetic account files | SDK shape, environment precedence, no hooks, no inference, unchanged synthetic credential files |
| `native.test.ts` | Real-report cases: native integration; pure projection and synthetic worker cases: base | Real/mirror equivalence, configuration layers, report contracts, launcher replacement, permission restrictions, catalog unknown state |
| `process.test.ts` | Base | Abort before start and exact child cleanup after subscribed ready event |
| `scratch.test.ts` | Base | Manifest ownership and cleanup without removing live workers |
| `service.test.ts` | Base | Service command construction without changing service state |
| `qa-fixture.ts` | Manual-only helper, never test discovery | Temporary HOME and socket-delivered synthetic authorization |

Shutdown coverage includes explicit application close, worker abort, scratch
ownership, and HTTP teardown. Zero-inference evidence includes the SDK request
tripwire and hook sentinel, native worker permissions, and report-only native
entry points. These checks do not prove successful model calls.

## Publication decisions

No release, remote push, history rewrite, or live-service restart is part of
this implementation. License selection and publication-history selection
require the maintainer's decision. Public dependency acquisition alone does
not settle dependency redistribution terms.

## Implemented runtime and validation boundaries

- `fa37a0a` adds CLI-relative `--node-path` and `--omo-path`, canonical
  launcher identity, digest-based copied-launcher matching, optional-cache
  discovery, isolated browser opening, and static `--doctor`. Its focused run
  passed 43 tests. Node `26.11.1` remains the measured version; the package's
  exact engine declaration was not broadened without additional measurements.
- `832731f` separates catalog refresh from native adaptation and exposes
  native trust, catalog freshness, snapshot freshness and write eligibility.
  The server and UI share the eligibility function. The transaction and HTTP
  regression run passed 47 tests; stale catalog recovery does not revive
  previews. Subsequent tests cover semantic-only artifact changes separately.
- `9e2fbe7` introduces explicit source-driven `test:base` and `test:native`
  discovery, plus clean isolated `validate:base` and `validate:native`.
  The exact staged increment passed 95 base tests under an empty HOME and
  16 supplied-installation integration tests. These are intermediate counts,
  before the new background evidence and UI tests, not final release counts.
- All 21 baseline tests in `native.test.ts` were retained: 16 synthetic or
  projection/worker cases remain in base; 5 real-report cases moved to
  `native.native.test.ts`. All 11 application/native-oracle cases moved to
  `app.native.test.ts`. Shared helpers contain no test registrations.
- Tests no longer contain an absolute username, a Homebrew Node executable,
  or a fixed runtime-cache installation. Base application transaction and
  capability coverage uses injected adapters, not a copied routing algorithm.
- CI is configured for the measured macOS environment. Its commands have been
  exercised locally; no remote CI run or push is claimed. Explicit native
  runs require `OMO_LAUNCHER_PATH` and fail without it. Native evidence is
  intentionally not auto-provisioned on ordinary pull requests.
- Current background source-contract evidence, artifact identity, limitations,
  and synthetic-versus-upstream validation are recorded separately in
  [background semantics](../../background-semantics.md).
- `e5e3abf` wires that evidence into snapshots and watches its artifacts
  independently. Its exact staged source passed 109 base tests and 17 native
  integration tests. The installed source inspection ran at
  `2026-10-27T08:21:33.228Z` and verified all 9 maintained rules against artifact
  SHA-256 `56824d1cd5c625616dcde59c8e29cdb58064a7d46c88d41bba5387a6e6bc0e66`.
  Synthetic mapping assertions and this actual-installation source check are
  separate evidence. Semantic notifications use a generation check so an older
  asynchronous inspection cannot discard a later artifact change.

## Public-file and dependency review

The current documentation uses reusable deployment instructions rather than
personal hosts, tailnet names, IP addresses or usernames. A historical review
identified personal operational identifiers and author metadata in prior
commits. Existing history has not been rewritten; selecting an existing or
separately prepared publication history remains a maintainer decision.

The installed `jsonc-parser@3.3.1` includes the Microsoft MIT license.
`@code-yeongyu/senpi@2026.10.23-1` declares MIT in package metadata and its README,
but the inspected installed package did not include a root license file.
The installed OMO plugin's license expressly covers only named LSP-adapter
portions; it is not evidence of blanket permission for the entire runtime.
These are observations of supplied artifacts, not a redistribution clearance.
No OMO runtime or dependency installation is bundled in this source tree.
The recorded background source-contract fragments are part of the proposed
publication contents and also require upstream-terms review; package metadata
alone is not redistribution clearance.

The source release still needs a maintainer-selected project license, an
established private security-reporting channel, dependency-distribution review,
and publication-history selection. `private: true` remains deliberate; registry
publication is not required. Broader P6 modularization remains after first
release, as specified by the plan.

## Bilingual desktop implementation

`cf4a5da` adds typed English/Simplified Chinese presentation, explicit language
persistence, translated cached explanations, and shared UI/server eligibility.
The exact staged increment passed **117 base tests** and **1 real Chromium
integration test**, after clean isolated type checking, lint and build.
The browser test also denies access to the `localStorage` property to verify
that preference storage cannot prevent startup or in-memory switching.

[Desktop acceptance](qa-open-source-2026-10-27.md) records the complete 84-state
desktop matrix, actual 200% browser zoom, exceptional states, keyboard focus,
and real temporary-config save/conflict/undo workflows. Public screenshots use
synthetic values. Source language scanning found Chinese only in maintained UI
translations and deliberately multilingual external-input tests; maintained
non-README documents and operational diagnostics are English.

## Dependency-notification correction

The first fully reacquired candidate at `f3e7ed5` installed without lock drift,
but its base run failed 1 of 117 tests: a semantic-only change sometimes also
marked native routing unverified. Targeted instrumentation also exposed delayed
notifications around a panel-owned settings save.

A deterministic real-file regression delivered coalesced, filename-less hints
without changing any dependency. Before correction it failed with native state
`unverified` instead of `verified`. Watch callbacks now compare actual file
identity metadata and distinguish semantic-only changes from routing changes.
Closed watcher generations cannot invalidate a newly rebuilt snapshot.
Replacing a routing dependency with identical content still invalidates it
because its identity changes. Canonical targets are included, so moving a
parent directory behind a symlink cannot conceal a dependency change even when
the file inode and contents survive.

The corrected run passed **118 base tests, 17 native integration tests and
1 real Chromium test**, with clean lint and build. The regression uses explicit
event delivery and subscriptions, not sleeps or retrying failures. Temporary
event logging was removed. Final committed-candidate acquisition is recorded
below after the source-only correction.

The cold browser run also exposed a harness assumption: Chromium's initial
navigation stalled under an empty HOME with the original launch arguments.
Adding a mock keychain and basic password store for the
synthetic profile made the same empty-HOME test pass in 1.009 seconds, with all
assertions intact. Navigation commands and their pre-subscribed completion
signals are now awaited together; timeouts identify the navigation stage.
The harness explicitly selects mock/basic credential storage for its profile.

## Final committed-candidate validation

Source revision:
`7aaff50c053181f0bdc72ef8468169713319e742`.
Verification date: 2026-10-27. The later evidence-only documentation commit does
not change the validated implementation or dependency lockfile.

The committed source was extracted to a new temporary directory with no `dist`,
no dependency installation, an empty HOME, and an empty Bun cache. Under
`env -i`, with npm user/global configuration disabled,
`bun install --frozen-lockfile` installed **244 packages** successfully.
Before/after lockfile SHA-256 matched:
`b187cd61870a1533cce241b4e8661777bee8f8fe1960205d7d13fe8d65359f06`.

| Gate | Current result |
| --- | --- |
| Toolchain | macOS arm64; Node `26.11.1`; Bun CLI `1.3.14` |
| Type check | Exit 0 |
| Lint | Exit 0, no warnings or errors |
| Empty-output build | Exit 0 |
| Base suite, empty HOME, no OMO/account environment | **118/118 passed**, 14 current source test files |
| Explicit supplied-installation suite | **17/17 passed**, 3 current source test files |
| Real Chromium suite, empty HOME, task-owned profile | **1/1 passed** |
| Static doctor | Exit 0; selected Node, OMO installation and SDK static checks all `ok` |
| Installed combination | OMO `5.1.48`; SDK `2026.10.23-1`; measured Chrome `156.0.8078.48` |
| Background semantic evidence | All 9 rules verified at `2026-10-27T10:44:35.663Z` |

The semantic artifact digest remained
`56824d1cd5c625616dcde59c8e29cdb58064a7d46c88d41bba5387a6e6bc0e66`.
Native tests used the explicitly supplied launcher; all configuration writes
remained inside temporary fixture HOMEs. No real model probes, session starts,
personal configuration writes, remote publication, history rewrite, or personal
service restart were performed.

Local P0-P4 implementation and P5 source preparation/validation are complete.
This is not publication approval: project license selection, upstream terms
(including recorded contract fragments), a private security-reporting channel,
and publication-history selection remain open. Remote CI has been configured
but not run; only the measured Node/OMO/SDK combination is certified. P6 remains
after first release.
