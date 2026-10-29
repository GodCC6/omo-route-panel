# Native TUI Implementation Evidence

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Implementation date: 2026-10-28.
Verification date: 2026-10-28.
Status: implementation, runtime verification and final gate review complete.
Gate verdict: APPROVE. This report is not the product baseline.

## Architecture

The package is loaded into the running OMO through `pi.extensions`. The generated
default-export adapter registers `/route-panel`; it does not start another OMO,
a service or a browser. Production runtime dependencies are JSONC node editing
and terminal helpers, not a second Senpi SDK/model-registry runtime.

`src/extension.ts` takes models directly from the current host's
`modelRegistry.modelRuntime.getAvailable()`. Installation checks compare the
native-report installation to the current process's mapped executable, including
device/inode on macOS. The registry's assembly context is displayed separately
from the selected routing scope.

`src/editor.ts` owns one temporary file-level buffer. Changes are accumulated
by route/field, resolved together, and inspected in the same component.
`src/tui.ts` supplies keyboard lists, complete model search, candidate ordering,
reasoning, custom categories, supported defaults/background fields and the
integrated original/proposed changes. It uses native reports for ladders,
effective ordering, exclusions and disabled/unavailable status.

User scope reads user configuration only and excludes automatic project identity
overrides. Current-project scope remains an interpretation context, not a write
target. Projects outside HOME use an isolated synthetic ancestry branch rather
than traversing outside a mirror. Real/mirror report equality remains mandatory.

Apply rechecks file revisions/permissions, the host catalog, native engine,
background implementation evidence and identity-dependent presentation. It
retains the existing node-edit allowlist, per-file lock and atomic replacement.
A state-directory lock serializes publication of the single latest-Apply undo
record across file targets. The durable record contains allowlisted before/after
nodes, not full configuration backups. Reversals revalidate restored scalar
fields and model references against current save rules; undo cannot restore an
invalid thinking value or a settings model absent from the current registry.
Restored native chains are also checked against host availability; legacy
aliases are verified by isolated native custom-category reports, not a copied
alias resolver. A prepared reversal carries its exact UUID-identified latest
record, which Apply rechecks under the publication lock to reject consumed or
superseded undo authority even when configuration bytes have returned.

Legacy scalar and object-array fallback declarations retain all candidates and
their supported reasoning when entering the chain editor. Model-profile choices
include declarations from the applicable active configuration-profile and
harness layers; candidate acceptance still comes from native reports.

Undo publication and configuration rename share a synchronous boundary, so host
generation retirement cannot interleave them. A minimal pending record covers
interruption at that boundary. An ordinary reload closes the editor and cancels
uncommitted work; it is never vetoed. Completed saves remain distinguishable
from post-save reload/synchronization failures.

## Retired paths

Removed the HTTP/CLI product, browser assets, translations, SSE, preview caches,
service/Tailscale scripts, independent SDK/catalog worker, socket discovery
clients, Web snapshot/write-capability types and translation descriptors.
The default interface is now the native extension only.

Tests tied solely to those removed surfaces were retired with them. JSONC,
native reports, sandbox/process safety, background semantics and executable
identity regressions remain. Replacement tests cover file-level transactions
and actual terminal interaction, rather than preserving obsolete Web behavior.
The older extension-host spike remains dated historical capability evidence.

## Reproduction

```sh
bun install --frozen-lockfile
bun run validate:base
OMO_LAUNCHER_PATH=/absolute/path/to/omo bun run validate:native
OMO_LAUNCHER_PATH=/absolute/path/to/omo bun run test:tui
```

All three validation entries use disposable compiled output, not the personal
service's `dist`. The TUI runner replaces HOME and the provider environment,
loads synthetic models, disables memory and prompt-cache prewarming, and installs
inference/agent-start tripwires. No natural-language prompt is submitted.
Input IDs associate rendered acknowledgements with their exact keystroke.

Terminal matrix inputs are `TUI_COLS`, `TUI_ROWS`, `TUI_THEME`; optional
`OMO_TUI_EVIDENCE_DIR` records synthetic frames and the PTY stream. Local
screenshots replay those real-host component frames through xterm.js. They are
terminal evidence, not a replacement Web product.

## Acceptance map

| Baseline | Observable coverage |
| --- | --- |
| A1 | Real host command opens User scope with no project argument or browser. |
| A2 | Keyboard scope switching retains user-only edit targets; native integration checks project influence, including a project outside HOME. |
| A3 | Real keyboard editing changes two custom categories, a reordered multi-model chain with reasoning, and multiple settings fields in one buffer. |
| A4 | Cancel leaves original bytes unchanged; close/reload clears buffers without draft restoration. |
| A5 | Combined Apply changes confirmed settings only and preserves JSONC comments; node-edit regressions cover unrelated fields and safety. |
| A6 | Controller regressions reject external changes, failed catalog lookups and changed background artifacts before Apply. |
| A7 | Real Apply reloads the host; reopening reads actual configuration. |
| A8 | Real undo works after reload/reopening; controller tests preserve unrelated external edits, reject changed saved fields and consume the record. |
| A9 | Real picker includes all three registered synthetic models, including `fixture/fixture/nested`; recommendations, overrides and native effects remain distinct. |
| A10 | Real keyboard workflows run at multiple terminal sizes and themes, with no inference tripwire events. |

## Verification results

Verified on macOS arm64 with OMO `5.1.48`, Node `26.11.1` and Bun CLI `1.3.14`:

| Check | Result |
| --- | --- |
| Isolated base validation | TypeScript, lint, clean build and 125/125 tests passed. |
| Installed native validation | TypeScript, lint, clean build and 15/15 tests passed, including outside-HOME interpretation, native-chain undo/aliases, legacy fallbacks and active-profile declarations. |
| Actual native TUI workflows | Four passed: 120x40 dark/light and 64x28 dark/light. |
| Terminal visual inspection | 17 states per matrix, 68 frames total, 20 xterm contact sheets; no column/row overflow, blank output, overlapping content or hidden primary keyboard actions. |
| Inference tripwires | No inference or agent-start event in any workflow. |
| Diff whitespace validation | Passed. |

Local evidence is in `.omo/evidence/tui-visual/manual-qa.md`, the 20 contact
sheets beside it, and `.omo/evidence/tui-{wide,narrow}-{dark,light}/` frame JSON,
event logs and raw `terminal.ansi` streams. These task-local artifacts are not
published or staged. The committed test runner reproduces the workflows.
The actual host Apply/reload/reopen/undo workflow was rerun successfully after
adding restoration validation.
All four matrices were rerun after the gate fixes, including a native-file
custom model-profile Apply/reload/reopen/undo flow under an active profile.

The single gate reviewer initially reproduced four defects: native-chain undo
availability, incomplete legacy fallback projection, consumed-record undo
authority and active-profile model-profile declarations. All four were fixed
with direct regressions and closed in the focused APPROVE re-review.
The local report is `.omo/evidence/omo-native-tui-gate-review.md`.
The reviewer's direct evidence includes isolated compilation, diff inspection
and changed-surface screenshots. Its separate nine-test background result could
not be recovered and is not counted as passed; the completed base/native suites
above cover those regressions under the main task's execution evidence.

Fresh LSP diagnostic requests timed out; the completed TypeScript checks provide
type verification. The integration evidence certifies this macOS installation
and synthetic providers, not arbitrary releases, platforms, provider health or
remote inference.

## Operational boundary

Validation does not modify upstream source/generated installed artifacts, real
credentials, personal configuration, the existing personal service, its `dist`,
launchd or tailnet/DNS state. Loading this extension into a personal host is a
separate operating action; the repository's implementation and isolated
acceptance do not silently change that host's extension configuration.
