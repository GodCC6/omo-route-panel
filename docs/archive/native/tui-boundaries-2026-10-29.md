# Routing editor terminal boundaries

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Verification date: 2026-10-29.
Status: implemented, verified and installed locally.
Implementation: `d616315`.
Local activation: 2026-10-29T07:52:12Z.

## Observed problem and approved change

The user's trial screenshot showed the extension immediately following host
reload output, with its last hint touching the host footer. The content was
readable, but there was no visible start or end to the extension surface.
Earlier isolated component screenshots did not establish separation from host
transcript text.

The approved fix adds shared themed top and bottom rules to every main and
child view. Normal layouts reserve two rows for complete horizontal rules.
Shorter views add one outside blank row at each end only when the complete
surface still fits within 20 rows. Compact layouts embed the existing title
and final hint/status in their boundary rows, preserving the selected content
and reachable actions. Width remains at most 84 terminal cells.

Only rendering and its row budget changed. Candidate declarations, input
dispatch, search, persistence, conflict protection and Undo were not changed.

## Functional verification

`bun run validate:base` passed 179 tests with zero failures or skips, including
type checking, lint, isolated build and packaging checks. The new frame test
traverses main, chain, candidate menu, model picker, comparison, comparison
selector, name input, rejected input, background fields, boolean selector,
Changes, discard choice and failed Apply at normal and compact sizes.

Existing title assertions now identify the active heading instead of assuming
that physical row zero is a title. Existing physical width/height checks still
inspect the complete rendered output, including rules and outside whitespace.
No retained behavior or transaction assertion was removed.

The full real-host acceptance passed in both themes at all four dimensions:

| Terminal | Maximum rendered rows | Maximum cells per line | Result |
| --- | --- | --- | --- |
| 120 x 40 | 20 | 84 | PASS, light and dark |
| 70 x 24 | 20 | 70 | PASS, light and dark |
| 40 x 12 | 10 | 40 | PASS, light and dark |
| 18 x 8 | 6 | 18 | PASS, light and dark |

Each combination captured 63 states, 504 total. ANSI-aware measurements found
zero row/column overflows and zero missing or short first/last boundary rows.
The host retains two terminal rows outside the component.

## Visual verification in host context

The synthetic fixture emits `HOST_CONTEXT_BEFORE_ROUTE_PANEL` through the
host's normal notification channel. The test subscribes to actual PTY output
before opening the menu and freezes the stream once its first action footer
has painted. It uses bounded event waits, not sleeps.

`host-main.ansi` is the actual complete host stream at that point, including
preceding host text and the real host footer. `host-main.png` replays it through
xterm.js. These images, rather than an isolated reconstruction of the component,
establish the fix for the reported mixing problem.

Before captures were taken before the rendering edit at 120 x 40 light,
70 x 24 dark and 18 x 8 light:

- `/tmp/omo-boundary-before-120-light`
- `/tmp/omo-boundary-before-70-dark`
- `/tmp/omo-boundary-before-18-light`

After evidence is under
`/tmp/omo-boundary-after-{120,70,40,18}-{light,dark}`. Each directory contains
frame JSON, event history, raw terminal output, complete host-context captures,
individual `screens/*.png` and contact sheets. All 70 contact sheets were
inspected; individual PNG/JSON was checked where a contact crop was unclear.
The normal and smallest complete host views were also inspected directly.
The rules visibly separate host transcript, extension and host footer in both
themes. No overlap, missing action area or blank surface was found.

The first built-in WebView launch failed in this session. Rendering used an
owned Chromium process with a temporary profile instead. This was an
evidence-tool limitation, not a product change. Evidence remains session-local.

## Local installation

The verified production build is in
`~/.local/share/omo-route-panel/d616315`. Production dependencies were installed
in a fresh directory using the locked production install with peers omitted.
Only `jsonc-parser` is installed locally; `@earendil-works/pi-tui` remains a
host peer with range `"*"`. Compiled installed trees matched isolated build
output.

The full real-host acceptance passed twice against the installed generated
entry: first through the new directory, then through the configured stable
entry after activation. Both used temporary HOME directories, synthetic models
and inference/agent-turn tripwires.

The stable entry `~/.local/share/omo-route-panel/9107f85` was atomically retargeted
from `cc301c1` to `d616315`. The previous release and all dated backups remain
intact. OMO's read-only package list still confirms that configured entry.
Personal configuration, upstream source, local `.omo` files and existing
services were not edited.

Installed-copy evidence:

- `/tmp/omo-boundary-installed-proof`
- `/tmp/omo-boundary-installed-stable-proof`

Running hosts can retain previously imported JavaScript until their normal
extension reload or next launch.
