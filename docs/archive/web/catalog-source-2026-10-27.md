# Live catalog source implementation evidence

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Verification date: 2026-10-27.

## Delivered boundary

The panel queries the existing TUI's `get_available_models` control command,
whose handler uses that TUI's `ModelRuntime.getAvailable()`. The project SDK
provides transport, discovery and authentication helpers only. No upstream
source, installed runtime, personal service or personal build output was changed.

The accepted coverage is `running-tui`: the loaded registry of the matching
project and executable, including loaded extension providers. This is not a
claim about a future fresh start, unapplied configuration, scopes/favorites,
provider health or successful inference.

Production resolution rejects catalogs without provenance. Provenance binds
the mapped executable and its digest, process-start identity, endpoint instance,
canonical project, requested routing profile and stat-only input revisions.
Different matching TUI catalogs fail rather than being merged. Missing endpoints
retain explicitly stale data or remain unknown initially; neither state permits
saving, starts a session, or falls back to SDK model definitions.

## Implementation map

| Boundary | Files |
| --- | --- |
| Existing endpoint discovery, ownership and mapped-executable proof | `src/catalog-process.ts`, `src/catalog-endpoint.ts` |
| Bounded authenticated JSONL with three read-only commands | `src/catalog-rpc.ts` |
| Worker isolation, stat-only inputs and source construction | `src/metadata.ts`, `src/metadata-worker.ts`, `src/catalog-source.ts` |
| Source-bound native resolution and deterministic revisions | `src/native/index.ts`, `src/native/catalog.ts`, `src/native/types.ts` |
| Snapshot, preview, save, pre-commit and undo re-verification | `src/app.ts` |
| Catalog-specific invalidation events and browser state | `src/http.ts`, `src/types.ts`, `src/web/app.ts` |
| Bilingual coverage, conflict and unavailable-source explanations | `src/web/messages.ts` |

The parent server does not open provider credential contents. Input tracking
uses filesystem and canonical-target identities. Local control authentication
stays inside the isolated worker and the official socket helper; secrets and
raw RPC models never enter logs or the public snapshot.

## Automated verification

All runs used Node `26.11.1` and Bun CLI `1.3.14` on macOS arm64. Builds were
made in temporary source copies with an empty output directory and a link to
the frozen project dependencies. The personal service's `dist` was not used.

| Check | Observed result |
| --- | --- |
| `bun run check` | Pass |
| `bun run lint` | Pass |
| `bun run build` in the isolated copy | Pass |
| `node scripts/test.mjs base` after that build | 164 passed, 0 failed, 0 cancelled |
| `OMO_LAUNCHER_PATH="$HOME/.local/bin/omo" node scripts/test.mjs native` | 17 passed, 0 failed, 0 cancelled |
| Explicit Chrome `node --test dist/test/i18n.browser.js` | 1 passed, 0 failed, 0 cancelled |

Regressions cover authentic synthetic Unix sockets, command allowlisting,
sanitization, wrong project or executable, old mapped inodes, endpoint and secret
rotation, malformed responses, conflicting catalogs, cancellation and byte limits.
Worker tests distinguish the TUI's target model from independent SDK definitions
and reject input changes during a query. Transaction tests reject source,
input and model-list changes, including a change at the pre-commit check.
HTTP and browser tests verify that catalog invalidation reaches the badge without
polling and keeps a previously prepared save disabled.

Gate review added deterministic regressions for an invalidation during final
snapshot checks, canonical symlink-target edits, and retention when a committed
save's final catalog query fails. Configuration-only refresh demotion and launcher
source-badge invalidation are covered as well. Snapshot publication now checks
an invalidation generation, with watchers armed before asynchronous verification.

An independent review run also exposed `process-input` from a no-input process.
Such commands now use ignored stdin instead of opening an unnecessary writable
pipe. The regression checks the child's actual file-descriptor kind; nonempty
request-pipe failures remain errors. This is a structural fix, not a retry or
suppression of input errors.
The same boundary now uses streaming UTF-8 decoding, preserving opaque multibyte
identifiers across pipe chunks. Retained pre-fix builds reproduced both the
unnecessary stdin pipe and multibyte-output corruption; the final regressions
check the real child descriptor and exact output bytes.

Chrome teardown previously waited for process exit before deleting its profile.
A cleanup run exposed a late profile write (`ENOTEMPTY`). The harness now requests
graceful `Browser.close`, waits for the child's `close` event and normal exit,
then removes the temporary profile. No assertion or cleanup error was suppressed.

The final independent gate returned **APPROVE** after re-running all three
original fault reproductions and independently passing check, lint, build,
base 164/164, Native 17/17 and Chrome 1/1 on the final code. No blocking findings
remained. The real installed-runtime parity result is recorded separately in
`live-parity.json`; the reviewer did not send another query to the real TUI.

A file-notification regression initially depended on macOS event delivery timing.
It now uses the repository's deterministic notification seam while changing real
temporary files and checking the real invalidation callback. Native watcher tests
and manual browser checks separately exercised actual filesystem notifications.

## Real-surface verification

Chrome `156.0.8078.48` used a task-owned profile and separate loopback servers.
The read-only server queried the real installed OMO `5.1.48` TUI; write scenarios
used temporary HOME directories, synthetic TUI sockets and synthetic settings.
No model prompt, inference probe, session creation, session attachment or
selected-model change was sent.

| Scenario | Observed result | Evidence |
| --- | --- | --- |
| Production worker and read-only HTTP catalog | 580 models, target `opencode-go/gemini-4-argon` present, two matching instances, `coverage: running-tui` | Live catalog captures and verification transcript |
| Complete set parity with direct TUI control query | 580 vs. 580; both directional differences empty | `live-parity.json` and final source-parity transcript |
| Select target and generate preview | Complete identifier available in the browser DOM picker; settings still unchanged before save | Preview transcript and focused capture |
| Catalog changes after preview | Save returned HTTP 409; backend and browser marked the catalog stale; draft retained and settings bytes unchanged | `stale-en-light.png`, transcript |
| Refresh, re-preview and save | Target written to the temporary settings file; catalog remained fresh and drafts cleared | Transaction transcript |
| Undo | Original temporary settings bytes restored; catalog remained fresh and `canUndo` became false | Undo transcript |
| Input file creation | Actual filesystem notification marked the badge stale and disabled the prepared save without polling | Stale draft matrix |
| Endpoint disappears | Old models remained visibly stale, saving stayed disabled, and diagnostics named `catalog-endpoint-unavailable` | `endpoint-unavailable-zh-dark.png` |
| Failed catalog refresh | No success notification was shown for the unavailable source | Final browser transcript and unavailable-source capture |

## Desktop visual scope

The changed surfaces were the live catalog diagnostics and the stale draft /
preview state. Both were captured at 1280, 1440 and 1920 CSS pixels in English
and Simplified Chinese, light and dark: 24 states and 48 top/bottom captures.
Both surfaces were also checked at actual Chrome 200% zoom in both languages
and themes: 8 additional states and 16 captures. The zoomed 1440-pixel viewport
reported 720 CSS pixels, device pixel ratio 2 and visual viewport scale 1.
There were zero horizontal document overflows across all 32 states.

Actual Tab input produced a visible solid 2px focus outline at 200% zoom.
Long identifiers, source limitations, file paths, retained drafts and disabled
save controls remained readable through document scrolling. No CSS or layout
system was changed.

Local captures and the machine-readable matrix are retained under
`.omo/evidence/catalog-source-2026-10-27/` and are not publication assets.
`live-parity.json` is the raw source-set comparison, and `source-match.json`
records exact agreement between the 15 production source files and the isolated
verification copy.
Task browser processes and temporary servers are separate from the personal
service. The personal service is intentionally not redeployed by this task.
