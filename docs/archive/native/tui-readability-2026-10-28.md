# TUI readability and host dependency correction

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Verified: 2026-10-28. This record covers the redesigned extension, not the retired
Web panel. All runtime evidence uses temporary HOME directories, synthetic
configuration and providers, with inference tripwires.

## Changes

- Declare `@earendil-works/pi-tui` as a host peer with range `"*"`, not a runtime
  dependency. Retain the pinned Senpi alias only for development.
- Install deployed dependencies with
  `bun install --frozen-lockfile --production --omit=peer --ignore-scripts`.
  A clean runtime installation contains only `jsonc-parser`; it does not carry
  another TUI module. Existing development `node_modules` must not be reused.
- Replace the concatenated report with Routes, Background, Settings and
  Diagnostics sections. Initially show the selected route's effective chain.
  Recommendations, explicit overrides, resolution evidence and doctor output
  remain inspectable without crowding the initial viewport.
- Add entry filtering, contextual actions, fixed title/navigation/action areas,
  visible list/scroll positions, changed-entry markers and compact integrated
  original/proposed values. Only affected background strategies appear in
  integrated changes.
- Escape from a model picker or field input returns to its originating view.
  Help supports scrolling instead of closing on a page-navigation key.
  Very short terminals reserve less chrome; overlapping pages preserve readable
  continuation lines. Full model references remain unmodified.

File-level Apply, Cancel, conflict checks, native report ownership and durable
latest-save undo are unchanged. No upstream code or OMO configuration was edited.

## Verification

`bun run validate:base` passed type checking, lint, clean isolated build and all
130 base tests. This includes disclosure, filtered route selection, edits across
same-file sections, nested cancellation, help scrolling and the retained
18-column/8-row identifier test. LSP freshness requests timed out; the successful
TypeScript compiler run is the type-check evidence.

All 15 native integration tests passed against the explicitly supplied installed
OMO launcher, using the compiled production candidate.
The same candidate also passed the full real-host TUI acceptance with only
`jsonc-parser` in its `node_modules`, proving that the runtime flow obtains TUI
helpers from the host rather than a development alias or bundled private copy.

The real-host `test:tui` acceptance passed in all four combinations:

| Terminal | Theme | Result |
| --- | --- | --- |
| 120 columns, 40 rows | dark | PASS |
| 120 columns, 40 rows | light | PASS |
| 70 columns, 24 rows | dark | PASS |
| 70 columns, 24 rows | light | PASS |

Each combination captured 23 states: background, candidate reasoning, default
model picker, diagnostics, help top/end, model-profile input/changes, model
search, combined native changes, project/user browse, new-category input,
reasoning input, expanded route top/end, filtered route, settings browse/edit/
changes, thinking input, undo and validation error. All 92 frames fit their
terminal columns and rows using ANSI-aware width checks.

The acceptance drives multi-item edits, candidate ordering, complete raw model
IDs, Cancel, host reload interruption, Apply-triggered reload and persistent
undo. Independent read-only layout and interaction reviews found no blocking
defect. Their help-scroll finding was fixed and verified by a regression test
and fresh real-host top/end captures.

Session-local evidence is under `/tmp/route-panel-final-{wide,narrow}-{dark,light}`:
`capture-*.json`, `terminal.ansi`, `sheet-1.png` through `sheet-4.png`, and
`overview.png`. Screenshots render actual PTY component frames through xterm;
they are not mockups. Contact-sheet backgrounds were corrected to avoid
capture-only dark strips outside the browser viewport in light mode.
These temporary artifacts are not a permanent screenshot archive.

The matrix establishes the tested dimensions and synthetic flows, not every
terminal emulator or inference health. Expanded diagnostic/evidence views remain
intentionally dense and scrollable. A running host must reload its extension
after replacing an installed copy.

## Local installation

Installed and verified on 2026-10-28 at
`~/.local/share/omo-route-panel/9107f85`, retaining that configured loading path.
The previous installation is preserved as the sibling directory
`9107f85.backup-20261028T235234`. The replacement's compiled tree matches the
tested production candidate; its runtime dependencies contain only
`jsonc-parser`.

A separate synthetic-HOME smoke test loaded this exact installed directory
directly through OMO's extension loader. It opened `/route-panel`, rendered the
new section navigation and action bar, and reported no extension resource
conflict or load failure. No inference was sent. Personal OMO configuration,
upstream runtime files and the workspace's existing `dist` were not changed.
The full real-host edit/Cancel/Apply/reload/undo acceptance also passed using
the actual installed copy, with evidence under `/tmp/route-panel-installed-proof`.
