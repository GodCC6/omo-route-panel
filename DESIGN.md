# Native TUI Interaction Design

Maintained interaction contract updated: 2026-10-29. See the
[product requirements](docs/tui-product-requirements.md) for scope and
[transaction API](docs/api.md) for controller ownership.
The compact two-section editor and terminal boundaries are implemented.
[Dated implementation and acceptance records](docs/archive/README.md) describe
their own source revisions; they do not certify a newly packaged release.

## Product boundary and scope

OMO owns the terminal surface and lifecycle. Route Panel opens inside that
surface and returns to normal OMO interaction when closed. Use English UI text
and host theme helpers; preserve user-defined names, model IDs and values
verbatim.

Open in `User` scope by default. `Current project` is an optional interpretation
context reachable from `More`, never permission to edit project files. All edits
target the supported user-level native routing configuration file. Host settings
may still be read and hashed when native resolution depends on them.

Only two sections exist: `Routes` and `Background`, switched with `Tab` while
retaining each section's selection and search query. There is no `Settings`
section, no `Diagnostics` section, no settings-file editing session, no
file-switch command, no default provider/model or default reasoning editor, no
compaction control, no raw JSON/doctor/source-evidence dump, and no separate
row for lexical projection or explicit completion helpers. Do not replace
removed views with renamed general-purpose information pages.

## Reference and compact viewport budget

Layout: a host-aligned bounded terminal frame with fixed themed top and bottom
rules; only the active body scrolls. The frame encloses title, search, results,
description, actions, hints and operation status. It separates the extension
from preceding host output and the host footer in the actual terminal.

The 2026-10-29 usability follow-up adds a shared frame to every main and child
view. At normal sizes, reserve two rows for complete horizontal rules and add
one outside blank row at each end only when the total still fits the budget.
At compact sizes, embed the existing title and final hint/status into the two
boundary rows instead of allocating extra rows. Keep at least one selected
content row and reachable actions. Rules use the host accent; content retains
its existing foreground, muted, selection or error role.

Model the layout on the official OMO Settings screen: search and section context
at the top, one scrollable list or child body in the middle, and a two-line
selected-item description plus concise contextual actions at the bottom. Child
editors, pickers, comparison views and integrated changes replace the body
instead of appending nested reports below the list. Avoid split panes, cards,
fullscreen padding and persistent blank filler.

- Bound width to `84` terminal columns or the available width, whichever is
  smaller, aligned with normal host content rather than centered as a modal.
- Cap total height at `20` terminal rows and body height at `10` rows. Larger
  terminals (`120 x 40`, `70 x 24`) do not expand into larger reports.
- Budget rows explicitly: title `1`, search `1`, result position `1`,
  description at most `2`, actions at most `3`, contextual hint `1`, status at
  most `2`, and body up to `10`.
- Measure widths, truncation and wrapping in ANSI-aware terminal cells,
  including CJK and pasted text. Main-list values and the two-line description
  may ellipsize; complete `provider/rawModelId` references are guaranteed inside
  scrollable child views. Never shorten stored or searchable model IDs.
- Nonselectable group headings in `Routes` consume rows inside the `10`-row body
  cap, not result counts. Omit group headings when the body has `3` or fewer
  visible rows, and identify the selected entry's kind in its description or a
  short row label so a heading never occupies the only visible content row.
- At `40 x 12` and down to the `18 x 8` safety fallback, shrink descriptions and
  list height before hiding required actions. Keep at least one selected content
  row and a compact action row showing the focused action and its position.

## Main view, search and action rows

`Routes` lists categories, then agents, then `Model profile`, followed by action
rows (`Add category...`, `More...`, and when dirty `Apply (N)` and `Changes`).
Each route row shows the first effective candidate plus `+K` for additional
candidates, `Inherited`, or an explicit disabled/unavailable state. `Background`
lists the six memory tasks (`Recall`, `Reflection`, `Dream`, `Facts`, `Nudge`
and `Memory Sync`) with their effective switch as the main value and strategy
summary in the description.

- Printable characters edit the search input directly, with `Left`/`Right`,
  `Home`/`End`, `Backspace`, `Delete`, `Ctrl-U` and CJK/paste handled by the
  input. No printable letter acts as a hidden command (`e`, `d`, `a`, `r`, `+`,
  `-`) while search owns typing.
- `Up`/`Down` traverses filtered configuration rows and persistent action rows;
  `PgUp`/`PgDn` pages the body. Show `(selected / filtered count)` for
  configuration rows and a separate action position when an action row is
  selected.
- Contextual `Enter` hints match the target (`edit`, `view`, `add`, `choose`),
  and opening an editable entry starts the native session internally without an
  `e` mode switch.
- In the main view, `Esc` with a nonempty search query clears search first
  (`Esc clear search`), restoring the selected item or first result without
  closing or prompting to discard edits, even when an action row is focused.
  With an empty query, `Esc` closes immediately when clean (`Esc close`) or
  opens the inline abandonment choice (`Discard N unsaved changes?`, defaulting
  to `Keep editing`) when dirty (`Esc review discard`).
- `More...` (also reachable via `F1`) offers `Change scope`, `Refresh`, `Inspect
  changes` when editing, `Discard all changes` when dirty, and `Undo last save`
  when eligible. Pending edits block scope changes and Refresh with an explicit
  Apply-or-discard message.

## Route editor, candidate chain acceptance and comparison

Selecting a route with `Enter` replaces the body with its candidate editor,
seeded from the accepted buffer or saved state.

- Merely opening a route keeps its local form clean: `Compare recommendation /
  override / effective...` is available, `Use chain` is unavailable (`Unavailable:
  no local changes`), `Back to changes` appears when the shared buffer is dirty,
  and `Esc` returns to the main view without accepting local edits.
- Selecting a candidate with `Enter` opens an action menu (`Replace model`,
  `Reasoning`, `Move earlier`, `Move later`, `Remove`). Model add/replace uses a
  searchable full-catalog child picker where `Esc` cancels immediately (`Esc
  cancel picker`) and `Ctrl-U` clears the picker query.
- Candidate actions and `Restore chain inheritance` modify only the unaccepted
  local chain form (`Local changes - not yet accepted`), disabling comparison
  and `Back to changes` until accepted or canceled. Reverting local edits
  restores the clean local state.
- `Use chain` validates the whole replacement chain (or staged inheritance
  removal) against the host catalog and native oracle, accepts it into the
  shared user-native-file buffer, and returns to the main view. This allows
  repairing multiple invalid candidates in one local form while untouched legacy
  routes elsewhere do not block editing.
- Candidate `Inherit` omits the candidate `reasoning` property while preserving
  route-level `reasoning`, `reasoningEffort` and `variant`. `Restore chain
  inheritance` removes only `models`, legacy `model` and `fallback_models`,
  retaining `disable` and route-level reasoning fields.
- `Add category...` collects a non-duplicate name (checked against all saved and
  accepted categories regardless of search filter) and first model before
  entering the shared buffer.
- The compare view shows one ordered chain at a time, navigated with non-wrapping
  `Left`/`Right` (or a selectable view chooser at narrow widths). Clean order:
  `Saved effective` (default), `Saved user override`, `Upstream`. Dirty buffer
  order: `Proposed effective` (default, from the accepted buffer), `Saved
  effective`, `Saved user override`, `Upstream`.

## Background task editor

Selecting a background task with `Enter` replaces the body with its field list:

- Every editable row displays the user declaration (`Inherit` or explicit user
  value), while the description shows the effective value and concise source
  (`default`, `user override`, `identity override` or `global gate`).
- Valid field choices and `Space` boolean toggles validate and enter the shared
  user-native-file buffer immediately; there is no task-level `Done` step. Both
  `Back to main` and `Esc` from the task list keep accepted field edits, while
  `Esc` inside a nested selector cancels only that selector. When the shared
  buffer is dirty, `Back to changes` is also available.
- `Recall` edits `enabled` and `category` (`Inherit` removes the user leaf) and
  exposes `Effective candidates...` when established. `Reflection` edits
  `enabled` and `category` with dynamic strategy details. `Dream` edits
  `enabled` and shares Reflection's category. `Facts` edits `enabled` and
  explicit `model` (`Inherit` removes the user leaf). `Nudge` and `Memory Sync`
  have no editable fields and no fake model picker.

## Integrated changes, Apply, reload and undo

Accepted edits across `Routes` and `Background` share one temporary
user-native-file buffer. Modified entries show `*`, and `Apply (N)` counts
logical entries with actual saved-versus-proposed node differences.

- `F4` or `Changes` opens the integrated changes body showing the target user
  native file, a selectable list of changed items, compact `Saved` / `Proposed`
  declarations, and native effective consequences for the selected item.
- `Ctrl-S` or `Apply (N)` commits from the main view or integrated changes. In a
  child view with unaccepted local edits, `Ctrl-S` reports `Accept or cancel this
  edit first` without writing; in a child view with no local edits but accepted
  buffer changes, `Ctrl-S` returns to integrated changes without writing.
- While saving, lock duplicate submissions and show `Applying...`. On commit,
  clear dirty markers, publish the save notification (`Saved N changes` or
  `Saved N changes; reload failed`) through the host notification channel before
  retiring the context, and trigger host reload. Validation or conflict errors
  never say `Saved`, retain the buffer, and keep the error attached to the
  failed operation until corrected, dismissed or canceled.
- Ordinary host reload or shutdown discards uncommitted edits. `Undo last save`
  prepares the reversal in integrated changes for explicit `Apply`, refuses undo
  when target fields drifted externally, preserves unrelated edits, and refuses
  to open a hidden Settings editor or mutate settings files for pre-redesign
  settings undo records.
