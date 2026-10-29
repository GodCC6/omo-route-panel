# Routing editor interaction and UI redesign

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Date: 2026-10-29.
Revision: 3, after an additional independent visual-engineering UI/UX review.
Status: proposed interaction design, revised after independent reviews;
awaiting approval; not implementation evidence. Last updated: 2026-10-29.

## 1. Product boundary

The user's 2026-10-29 direction is explicit:

- Remove Settings and its features, which OMO already provides.
- Remove Diagnostics; its information does not help this extension's users.
- Use the supplied official OMO settings screenshot as the visual and
  interaction reference, rather than improving the existing report layout.

These removals override the corresponding parts of R6 in
`tui-product-requirements.md` and the four-section design in `DESIGN.md`.
Other requirements remain: native routing truth, complete host model search,
effective background semantics, temporary multi-item editing, explicit Apply,
conflict protection, last-save undo, and reload cancellation.

This document proposes the replacement. It does not claim that the current
implementation or baseline documents have already been migrated.

### Remove, rather than relocate

- Default provider/model editing, default reasoning and compaction-model editing.
- The Settings section, file-switch command and settings-file editing session.
- The Diagnostics section, registry-context report, doctor output, raw config
  JSON, source-evidence dumps and explanatory warning paragraphs.
- Compaction as an extension control; do not move the removed Settings feature
  into Background.
- Separate rows for lexical projection and explicit completion helpers. They are
  not independently configurable background tasks in this editor.

Do not replace these with Advanced Settings, Technical Details or another
general-purpose information page.

### Retain

- Category and existing-agent ordered chains, per-candidate reasoning, custom
  categories, and restoration of inheritance.
- Native routing model-profile selection. This belongs to routing, not the
  removed host settings controls.
- Recall, Reflection, Dream, Facts, Nudge and Memory Sync interpretation;
  only the currently supported native fields are editable.
- User scope by default; optional current-project interpretation, never
  project-file writes.
- User-facing errors that explain why a specific edit or save cannot proceed.
  Removing Diagnostics must not conceal an unavailable model or failed save.

All new edits target the supported user native configuration file. Settings may
still be read and hashed when native resolution depends on them; removing its
editor is not permission to remove commit dependency checks.

## 2. Reference and visual contract

The supplied official Settings screenshot has a search input, aligned label/value
rows, one selection marker, a small description area and a short action footer.
Those properties are the reference. This proposal does not assume that the
official screen's persistence behavior matches this extension's Apply contract.

Layout: a compact, host-aligned terminal settings list; search and navigation
above, one scrollable body, selected-item description and contextual actions
below. Child editors replace the body instead of appending to it. No split
panes, cards, fullscreen report, experimental overlay or persistent blank filler.

- Use the host's theme, font and input primitives where their contracts fit.
  Do not change upstream code or install another TUI runtime.
- Bound content to 84 columns or the available terminal width, whichever is
  smaller; align it with normal host content rather than centering a dialog.
- Cap normal panel height at 20 terminal rows. List height uses the remaining
  space and is capped at 10 rows. Do not pad to the terminal's full height.
- At 70 x 24 and 120 x 40, keep title/search, selected entry and actions visible.
  Larger terminals do not produce larger reports.
- Use the normal foreground for labels and values, muted text for descriptions,
  and the host selection treatment plus a textual marker for focus. Do not color
  every header or repeat status tokens after every name.
- Labels and values have consistent columns. Main-list values and the two-line
  selection description may ellipsize; Enter opens a scrollable child view with
  complete references. Do not promise unlimited text in the bounded main view.
  Never mutate a model ID to produce a shorter stored or searchable reference.
- Below 40 columns or 12 rows, reduce descriptions and list height before
  reducing required actions. Wrap full identifiers in child views and provide
  scrolling; retain the existing 18 x 8 safety regression.
- Long lists have a position indicator. Only the body scrolls; there are no
  nested scrolling reports underneath a list.
- Budget rows explicitly: title 1, search 1, result position 1, description at
  most 2, actions at most 3, contextual hint 1, status at most 2. The remaining
  rows are results or child content, capped at 10. Optional blank rows consume
  only spare space; selected content and actions take priority over whitespace.
- In 40 x 12 and smaller terminals, use a one-line title/search context, at least
  one content row, a compact action row and a short hint. The action row shows
  the currently focused action and its position when all actions cannot fit.
  Up/Down still traverses every result and action; selection is never offscreen.
- Nonselectable group labels consume body rows within the same 10-row cap, not
  result counts. Omit them when the body has at most 3 visible rows. The selected
  entry's description identifies category/agent; when that description is omitted,
  reserve a short kind label on the selected row. Never spend the only content
  row on a group heading.
- Measure width, truncation and wrapping in ANSI-aware terminal cells, including
  CJK and pasted text, not JavaScript string length.

English UI text remains consistent with OMO. Preserve user-defined names, model
IDs and values verbatim. ASCII diagrams below are illustrative, not a palette or
fixed synthetic model catalog.

## 3. Main view: find an item and edit it

Primary action: Enter edits the selected item.
Reading priorities: item name, current value, selected-item explanation.
Deliberately absent: raw paths, JSON, evidence ladders, repeated chain listings,
an Edit mode switch, and four numbered sections.

```text
Routing                         User       [Routes] Background
> search

> architect                     gpt-6-astra +2
  artistry                      Inherited
  deep-high                     Inherited
  deep-low                      Inherited
  quick                         deepseek-flash +1
  ...
  Model profile                 daily-normal
  Add category...

architect / category - User override, 3 effective candidates
  More...
Type to search | Enter edit | Tab section | Esc close
```

`+2` means two additional candidates, never an independent model-selection
decision. Full ordered chains are accessible through the selected route editor.
Disabled/unavailable entries show a meaningful state instead of a misleading
first model.

- Routes contains categories, then agents, then Model profile. Section labels
  are nonselectable, not extra pages. Filtering matches name, route kind and
  complete candidate references, using untruncated values.
- Background contains the six named memory tasks. Its main value is the effective
  switch; the description summarizes category, dynamic, fixed or local strategy.
- Tab switches Routes/Background and retains each section's selection and query.
  Both share the same temporary native-file buffer.
- Printable text edits the search input directly. Up/Down selects results;
  Backspace edits the query; Ctrl-U clears it. No printable character is a hidden
  command while the list owns search input.
- In the main view, Esc with a nonempty query clears search without closing or
  asking to discard accepted edits. Show `Esc clear search` in that state.
  Clearing restores the selected item if it still exists, otherwise the first
  result, and scrolls it into view. This applies even when an action row owns
  selection. With an empty query the hint becomes `Esc close` when clean or
  `Esc review discard` when dirty. Search text is not an unsaved configuration edit.
- Left/Right, Delete and Home/End edit the search cursor/text. Paste and CJK
  composition belong to the visible input, never hidden navigation. PgUp/PgDn
  page the results in searchable lists and the body in comparison/details views.
- Action rows such as Add category and Undo last save remain reachable below
  results, even with no matches; distinguish them from matching configuration rows.
- A persistent, selectable More row opens a short action menu: Change scope, Refresh, Inspect changes when
  editing, and Discard all changes when dirty. Undo is offered only when usable.
  Scope changes/refresh are unavailable with pending edits, with an explicit
  Apply-or-discard explanation.
- F1 is a shortcut to More, not the only way to reach these actions. When dirty,
  persistent Apply (N) and Changes rows accompany More. Up/Down/Enter reaches
  all actions even with no matching results; action rows are not search results.
- Show `(selected result / filtered configuration count)` for configuration
  rows, and a separate action position when an action is selected. Action rows
  do not inflate result counts. The Enter hint follows the selected target:
  edit, view, add or choose; read-only tasks must not advertise editing.
- Opening an entry starts the native editor internally if necessary. There is
  no preliminary `e` key. Merely opening or searching never creates a write.

When dirty, the footer adds `Ctrl-S Apply (N) | F4 changes`, and modified rows
carry `*`. N counts logical entries with actual saved-versus-proposed node
differences, not operations, reports or generated effects. Reverting an entry
to its saved declaration clears its marker; reverting all entries makes the
session clean, even if equivalent effective values came from different layers.

### Session state and cancellation

- **Clean:** opening/closing an editor without accepted node differences does not
  block Refresh, scope changes or Undo. End an empty controller buffer before
  those operations; opening a view is not a permanent edit lock.
- **Dirty:** accepted native-file changes exist. Section navigation retains them;
  scope changes, Refresh and Undo cannot silently cancel them.
- **Prepared undo:** the proposed reversal uses the same inspection/Apply path;
  arbitrary edits are disabled until it is applied or canceled.
- **Applying:** submission is locked and a persistent `Applying...` status is
  visible. Prevent duplicate Apply and do not claim cancellation after commit.

With an empty search query, Esc at the clean main view closes immediately.
With an empty query at a dirty main view, it replaces
the body with `Discard N unsaved changes?`, defaulting to **Keep editing**;
only explicit **Discard & close** closes and discards. F1/More Discard uses the
same inline choice with **Discard changes** returning to a clean main view.
Esc from this choice keeps editing and restores selection/query/scroll.
This guards abandonment only; it adds no confirmation to normal Apply.
Ordinary host reload/shutdown still follows the existing discard contract.

## 4. Route editor and model selection

Opening a route replaces the main list with its candidate editor.
Primary action: Enter edits one candidate or invokes a visible action row.

```text
architect                       Category / User override

> 1  chatgpt-subscription/gpt-6-astra          inherit
  2  kimi-coding/k3.1-pro                    inherit
  3  opencode/claude-fable-5-1               inherit

  Add candidate...
  Compare recommendation / override / effective...
  Restore chain inheritance
  Use chain                     Unavailable: no local changes

3 candidates - no local changes
Enter choose | Esc back
```

- Seed from the accepted file buffer when present, otherwise the saved state.
  Existing overrides seed the local chain; otherwise use the native effective
  candidates. Preserve raw candidate reasoning declarations separately from
  display inheritance. An unavailable/empty route still offers Add candidate.
- Merely opening the route leaves its local form unchanged: comparison is
  available, Use chain is unavailable, and Esc returns without accepting a change.
  If the shared buffer is dirty, show Back to changes as a selectable action.
  Candidate or inheritance-intent differences from the opening form enable Use
  chain and show `Local changes - not yet accepted`; comparison and Back to
  changes are unavailable until acceptance or cancellation. Reverting every
  local difference restores the unchanged state. A clean local form is separate
  from a clean shared file buffer.
- Enter on a candidate opens an action list: Replace model, Reasoning, Move
  earlier, Move later, Remove. Boundary moves are unavailable with a short reason.
  Do not require memorizing `a`, `d`, `r`, `+` or `-`.
- Add/replace opens a searchable host model picker with one model per row.
  Search covers the entire current host catalog, not favorites or a preselected
  subset. The selected model's complete provider/raw ID is visible and wraps.
- In searchable child pickers, Esc always cancels the picker and restores its
  immediate parent, even with a nonempty query; show `Esc cancel picker`.
  Ctrl-U clears that query without leaving. The main-view clear-before-close
  rule does not apply to child pickers.
- Reasoning uses a choice list, including Inherit, rather than free text.
- Candidate actions update one unaccepted, local chain form. **Use chain**
  validates the complete replacement against the catalog and native oracle,
  then accepts it into the shared file buffer and returns to the main view.
  This permits repairing two unavailable candidates before whole-chain validation.
  This form is not another persistent draft or another file session.
- Until acceptance, unresolved/legacy references stay visible with item-specific
  reasons. There is no native Proposed-effect claim for an invalid local form.
  Disable native comparison while local edits are unaccepted; say to accept or
  cancel them first. A rejected Use chain retains the editable form and leaves
  previously accepted file-buffer changes intact.
- Untouched legacy/unavailable routes do not prevent editing another valid
  route. Changed chains require complete catalog references; legacy aliases are
  shown as saved declarations, not silently guessed into provider/model IDs.
- Removing the final candidate is unavailable; Restore chain inheritance is a
  separate action that proposes removing user chain fields, not an empty list.
- Restore chain inheritance is resolved and displayed in the buffer before Apply.
  Project influence may remain; never label it as an unconditional reset to upstream.
- Choosing it stages an inheritance-removal intent in the local form; Use chain
  accepts that intent through native resolution, rather than requiring a
  nonempty explicit chain. Esc before acceptance cancels the intent.
- It removes only `models`, legacy `model` and `fallback_models`; retain
  `disable`, route-level reasoning and other non-chain behavior. A disabled
  route may stay disabled; a custom category with no remaining definition may
  have no inherited chain. Show the actual native result without inventing one.
- Use chain accepts and returns to the main list. Esc cancels only the local
  unaccepted form and returns, retaining other already accepted file changes.
  Esc in a picker/action menu returns to its immediate parent without accepting
  the current choice. A child text field's unaccepted input, such as a new
  category name, is discarded on Esc; this does not describe main-list search.
- On return restore the triggering row, query and scroll. Replace/reasoning keeps
  the same candidate selected; add selects the new candidate; remove selects
  the next candidate, or the previous last candidate. Async errors retain focus.
  During validation show a local busy state and lock mutation; only the active
  input receives keys, and no hidden parent consumes typing.
- Add category uses a labeled name input followed by the same model picker.
  Do not add the category to the buffer until a valid name and first model are
  accepted. Canceling leaves no empty category behind.
- Check new names against the complete saved and accepted-proposed category
  sets, independent of filtering, plus the local pending name. A duplicate
  reports Already exists and offers to locate it; it never replaces that chain.

### Reasoning declaration contract

Inherit on a candidate means omit its explicit `reasoning` property, allowing
remaining native layers to decide. Preserve route-level `reasoning`,
`reasoningEffort` and `variant` on chain writes and inheritance restoration;
do not silently clear them as the current writer does.
Do not materialize an inherited route-level value into every candidate during
reordering. Keep explicit candidate values attached to their candidate.
The editor distinguishes candidate override from route-level declaration;
neither is labeled a confirmed effective reasoning level unless the native
report establishes it. Integrated changes and undo cover every changed node.

### Focused comparison, not another report

The compare action replaces the editor body with a single chain list.
Clean order: Saved effective, Saved user override, Upstream; default to Saved
effective. With accepted file changes: Proposed effective, Saved effective,
Saved user override, Upstream; default to Proposed effective.
Proposed uses the validated file buffer; all Saved views use the baseline.
Unaccepted chain edits are not included. Changes inspection shows the proposed
user declaration, including explicit inheritance removals.

Left/Right moves between these views and stops at the ends, never wrapping.
At narrow widths show `View: <name> (i/n)` instead of a clipped tab strip;
Enter opens the same views as a selectable list. Each view contains one ordered
chain, never concatenated reports.

User override explicitly distinguishes inheritance from an explicit chain.
Native route state, relevant exclusions and unavailable candidates appear
beside affected entries in plain language. Only claim provenance the native
report proves. Full chains remain inspectable even when long.

The label never changes a Saved view into a proposed view. Esc returns
to the chain editor. No raw resolution ladder, JSON or doctor output is appended.

## 5. Background task editor

Enter on a task opens its own short field list. Do not mix task summaries with a
second, distant list of raw `memory.*` keys.

```text
Recall / Kibitzer

> Enabled                       Inherit
  Category                      quick
  Effective candidates...
  Back to main

Effective: true, inherited default; User scope
Space toggle | Enter choose | Esc back (keeps accepted edits)
```

Every editable row shows the user declaration (Inherit or an explicit value).
The selected-row explanation separately shows the effective value and concise
source: default, user override, identity override or global gate. This applies
to category and model bindings as well as switches.
Selectors highlight the user declaration, not a shadowing effective value.
For example, user Facts model A and identity model B means editing A while the
effect remains B. Accepting C must show Saved A -> Proposed C, still effective B.
Inherit deletes only the user leaf, never the identity/project binding.

Unlike a chain's whole-form acceptance, each valid field choice or Space toggle
is accepted immediately into the shared unsaved file buffer after validation.
No task-level pending form or second Done/accept step is introduced. Back to main
and Esc from the task field list both retain accepted field edits; neither
writes the file. Esc inside a child selector cancels only its unaccepted choice.
Rejected field validation leaves the previous accepted value intact and focus
on the affected field. When the shared buffer is dirty, the task field list
also exposes Back to changes; a child selector must be finished or canceled first.

| Task | Editable fields | Read-only interpretation |
| --- | --- | --- |
| Recall | enabled, category | Native category candidates |
| Reflection | enabled, category | Dynamic choice, not a fixed selected model |
| Dream | enabled | Shared Reflection category and dynamic strategy |
| Facts | enabled, explicit model / inheritance | Fixed, user quick chain or session strategy as established |
| Nudge | none added | Effective switch/source; local processing |
| Memory Sync | none added | Effective switch/source; local processing |

- Space toggles only an editable boolean row in its task editor; it never toggles
  a task by selecting a search result or invents an unsupported switch.
- Enter on a boolean offers Inherit / Enabled / Disabled. Space proposes the
  inverse of the effective boolean as a user override. If the effective switch
  cannot be established, Space is unavailable and Enter still offers explicit
  override choices; explain any unresolved effect before Apply.
- Category/model fields use searchable choice lists. Recall category, Reflection
  category and Model profile all offer Inherit mapped to `remove-field`, not a
  copy of the current default. Facts offers Inherit to
  remove its explicit model. Dream points to Reflection's category rather than
  adding a second independent binding field.
- An active global gate or project identity override stays visible in the short
  explanation. Native results, not the edited raw leaf, decide the displayed effect.
- Read-only fields are marked, with no fake edit affordance. Unverified strategy
  is described specifically on the affected task, not as a panel-wide warning.
- Model profile uses the same choice-list interaction in Routes.
- Effective candidates opens a read-only, scrollable child list only when the
  native result establishes a candidate set. Show complete provider/raw IDs,
  order and the applicable strategy, without implying a successful inference or
  a fixed dynamic selection. Esc restores the triggering task row; this is not
  an implicit route-edit shortcut. It uses the same narrow-width wrapping,
  body paging and position rules as comparison views.
  If a fixed binding or dynamic strategy has no established candidate set,
  expose Binding details or Strategy details instead, showing only proven
  information. Nudge and Memory Sync have no model-candidate action; local
  processing is explained in the task description, not a fake empty picker.

## 6. Changes, Apply, errors and undo

Accepted edits across Routes and Background share one user-native-file session.
The main footer and each edited row make unsaved state visible without a draft
page or independently pending files.

F4 expands/collapses integrated changes in the main editor body. It contains:
the target user file, changed-item names, compact Saved / Proposed values, and
native effective consequences for the selected change. The target path belongs
here because it authorizes a write; it is not a Diagnostics page.

Multiple changes use a selectable change list with one change's details at a
time. Do not concatenate every before/after JSON value and background report.
No mandatory Review screen or confirmation ritual is introduced.
The persistent Changes action opens the same body without a function key.
Apply is visible alongside Changes; both act on the entire accepted file buffer.

- Ctrl-S applies only from the main editor or integrated changes. In a child
  picker/input, finish or cancel that local edit first; never silently accept
  unsubmitted text or save only an unexpected subset.
- With unaccepted local chain/field input, Ctrl-S shows
  `Accept or cancel this edit first` and does not write. With no local edits but
  accepted file changes in a child view, it returns to integrated Changes without
  writing. Every editable child exposes a Back to changes action in that state.
- Apply validates the complete buffer, checks file/catalog/context dependencies,
  writes once, and invokes the existing host reload lifecycle. Lock duplicates.
- Validation failure preserves the last valid buffer and identifies the item.
- External conflict performs no write and retains the buffer for inspection;
  tell the user to discard and refresh. Do not merge or auto-rebase.
- Saved-but-reload-failed explicitly says Saved. It must not look like an
  uncommitted validation failure.
- While the panel is alive use a fixed status line. Successful commit clears
  dirty markers and Apply count, regardless of reload outcome. Publish the save
  result through the supported host notification channel before retiring the
  context; do not rely on a panel that a successful reload closes to show it.
  Ordinary success reports `Saved N changes` and returns through the host
  lifecycle; only report reload completion after it is actually known.
  Reload failure reports `Saved N changes; reload failed`, with Reopen offered,
  never a second Apply of already saved edits. Reopening exposes Undo.
- Validation/conflict errors never say Saved, preserve accepted changes, and
  remain attached to the failed operation through navigation. Clear them only
  on successful correction/retry, explicit dismissal or cancellation. The fixed
  status remains concise; selecting the failed item reveals the full explanation.
- Ordinary host reload/shutdown discards uncommitted changes. Reopening reads
  actual state; there is no restoration of an unfinished edit.
- Undo last save prepares the reversal in the same integrated changes UI.
  Ctrl-S explicitly commits it; conflicts and unrelated edits follow the current
  undo safety contract.
- For pre-redesign undo records targeting removed Settings fields, do not create
  a hidden Settings editor. Show a concise unavailable-for-this-version reason
  if needed, preserve the record, and do not modify the settings file.

## 7. Implementation boundaries and sequence

This is a proposal for later implementation, not authorization to deploy.

1. Align `docs/tui-product-requirements.md`, `DESIGN.md` and README with the user's
   removals and this approved interaction contract. Preserve dated QA as history.
2. Rework `src/tui.ts` around compact list and immediate-parent child views.
   Keep one native-file buffer and render only the active body. Adapt
   `src/extension.ts` host input/focus integration without upstream edits.
3. Map task rows to existing supported native fields. Refine presentation without
   replacing `src/background.ts` semantics or `src/native/` routing oracles.
   Keep raw declaration/provenance separate from inherited display values in
   `src/presentation.ts`. Adjust `src/config.ts` chain-node edits to preserve
   non-chain reasoning fields under the explicit contract above.
4. Remove Settings entry points and write reachability in `src/tui-contract.ts`
   and `src/editor.ts`; reject removed operations at the extension boundary.
   Remove settings-only orchestration where no remaining caller needs it.
   Preserve necessary read dependencies and JSONC/undo safety primitives.
5. Update `test/tui.test.ts`, `test/editor.test.ts` and real-host acceptance for
   removed surfaces and new navigation. Retain native-semantic, conflict,
   comment-preservation and transaction checks. Do not weaken retained tests to
   accommodate retirement.
6. Validate, inspect real terminal captures against the official reference, then
   commit independently verified changes. Installation/reload is a separate
   explicit handoff after implementation passes.

## 8. Acceptance: usability is a gate

The following must all pass; green unit tests alone do not approve the redesign.

| Area | Observable acceptance |
| --- | --- |
| Removal | No Settings, Diagnostics, settings-file edit route, compaction control, raw evidence page or renamed replacement |
| First viewport | At 120 x 40 and 70 x 24, compact search/list/description/actions; no fullscreen padding or appended report |
| Discoverability | From a fresh open, select a route and press Enter to reach its editable candidates without `e` |
| Native reference | Compare captures with the supplied official Settings screenshot: bounded footprint, aligned rows, clear selection and concise footer |
| Inputs | Search, category names and raw model IDs accept text without triggering navigation commands; input owns focus and supports CJK/paste |
| Catalog | Full host model search; complete provider/raw ID remains inspectable; availability errors are not empty results |
| Chain | Add, replace, reorder, reasoning and inheritance work through visible menus; accepted order matches native proposed effects |
| Scope | User default; project interpretation is explicit; scope switch cannot discard pending changes silently or enable project writes |
| Background | True effective switches and sources; no dynamic strategy rendered as a fixed model; no unsupported editable Nudge/Sync/Dream binding |
| Transactions | Multiple route/task edits in one native file; no write before Apply; Cancel, close and reload discard; saved/uncommitted outcomes differ |
| Safety | External file/catalog/context drift refuses stale Apply; comments and unrelated nodes survive; undo is verified after reopening |
| Size/theme | Both host themes, 120 x 40, 70 x 24, 40 x 12; 18 x 8 safety fallback; long IDs and CJK do not overflow or lose actions |
| Failure paths | No search matches, unavailable route, empty chain, rejected edit, conflict and reload failure show local actionable feedback |

### Review-derived scenarios

- Repair a chain containing two unavailable models in one local form, cancel it
  once without altering another accepted edit, then accept and Apply the repaired
  chain. An unchanged legacy route must not block another route's edit.
- Restore Recall category, Reflection category and Model profile through Inherit;
  verify leaf removal, true resolved effect, one Apply and complete Undo.
- Open/close a clean editor and edit/revert to the saved declaration; Refresh,
  scope switching and eligible Undo remain available with no dirty indicators.
- With user Facts A and identity B, propose C and then Inherit. The user leaf and
  effective B remain separately inspectable; User scope excludes project identity
  overrides rather than pretending they were deleted.
- Reorder candidates with explicit and inherited route-level reasoning; only
  intended ordering/candidate override nodes change. Apply/Undo preserves the
  route-level `reasoning`, `reasoningEffort` and `variant` declarations.
- Restore chain inheritance on disabled and custom categories; preserve
  non-chain fields and report disabled/no remaining chain faithfully.
- Hide an existing category with search, then try its name through Add category;
  repeat with an accepted-but-unsaved new category. Neither chain is overwritten.
- Dirty two entries with an empty search query, press Esc, cancel abandonment and
  verify exact focus/query/scroll and values. Explicit discard closes or clears
  as chosen; Apply has no extra confirmation. A clean Esc with an empty query
  still closes immediately.
- In clean and dirty main views, filter to zero results and select an action;
  the first Esc clears search and keeps accepted changes, without abandonment.
  A second Esc with an empty query closes or offers Keep editing as appropriate.
  In a filtered model picker, Esc instead cancels immediately; Ctrl-U clears
  its query without selecting or canceling a model.
- Toggle Recall Enabled and choose its category, then leave via Back to main
  and repeat via Esc; both retain validated, unsaved edits. Cancel a nested
  category selector without accepting its choice. Back to changes exposes the
  accepted edits, and no task-level Done step is required.
- With another entry already accepted in the buffer, open an unchanged route:
  Compare and Back to changes work without Use chain. Reorder a candidate:
  both actions become unavailable until the local form is accepted or canceled.
  Revert the reorder and verify the unchanged local state is restored.
- Inspect established Recall and dynamic-task candidate sets with full-ID
  scrolling and immediate-parent return. Fixed bindings and unestablished
  dynamic sets show proven details instead; local tasks have no empty model picker.
- Apply/reload success, reload failure and precommit failure have distinct
  markers, notifications and Undo availability. Repeat Apply while busy once;
  only one commit occurs, and no retired panel callback claims success.
- Without function keys, use visible actions to inspect/apply the accepted
  changes, change scope, refresh and undo when eligible, including empty search.
- In every child, verify Ctrl-S's local-pending versus accepted-buffer behavior;
  cancel/accept three nested views and restore candidate/input focus exactly.
- Exercise each comparison view in clean and dirty sessions, including narrow
  view selection. Verify Saved is the baseline and Proposed is the accepted
  native result, never an invalid local chain.
- At 40 x 12 and 18 x 8, dirty/error states and long/CJK IDs keep at least one
  selected content row and an actionable footer/control; complete references
  are scrollable in child views without expanding the main description.
  Traverse categories, agents, Model profile and actions with actual Up/Down
  keys; group labels cannot occupy the selected row's only visible space.

Verification commands: `bun run validate:base`,
`OMO_LAUNCHER_PATH=... bun run validate:native`, and
`OMO_LAUNCHER_PATH=... bun run test:tui`, using isolated builds, temporary HOME
directories, synthetic providers and inference tripwires. Subscribe to exact
events with bounded waits; do not use sleeps to make terminal tests pass.

Before implementation, capture the current installed surface at the same sizes.
Afterward, drive and capture every changed screen, menu, input, compare selector,
changes state, failure and undo path in both themes. Inspect the actual xterm
render, not just returned strings. Record functional and visual verdicts
separately; a readable reference comparison is required for completion.

## 9. Review disposition

Reviewed on 2026-10-29 by two independent, read-only advisory reviewers against
revision 1 (`7bd52ce`): functional completeness (`st_01a1859c`) and UI/UX
(`st_01a1859d`). They inspected the plan/code and, for UI/UX, the supplied
screenshots. These are design reviews, not implemented-surface QA results.

| Finding | Revision 2 disposition |
| --- | --- |
| F1: multi-invalid-chain repair blocked by per-action validation | Local whole-chain form, one Use chain acceptance, cancel isolation and repair scenario |
| F2: missing category/profile inheritance actions | Explicit Inherit -> remove-field in all three selectors |
| F3: clean auto-open session locks navigation | Clean/dirty/prepared-undo/applying states; empty-buffer retirement and revert handling |
| F4: binding values shadowed by identity/project layers | User declaration and resolved effect/source separated for every background field |
| F5: ambiguous reasoning inheritance and destructive normalization | Candidate omission semantics and preservation of route-level reasoning fields; raw provenance and Undo checks |
| F6: restore implies removing the entire route | Restore chain inheritance removes only chain fields; disabled/custom-route effects explicit |
| F7: duplicate name hidden by filtering | Full saved/proposed namespace checks, independent of search |
| U1: accidental Esc loses all edits | Inline abandonment choice, Keep editing selected by default; no extra Apply confirmation |
| U2: incomplete saving/success lifecycle | Applying state, actual-diff counts, pre-retirement save notification and commit/reload outcome separation |
| U3: child editing hides save path | Visible return-to-changes path; explicit Ctrl-S behavior for pending and accepted edits |
| U4: function-key-only actions and small-screen crowding | Selectable persistent actions, adaptive row budgets and no-function-key acceptance |
| U5: complete references promised inside a bounded main description | Partially adopted: remove the impossible unlimited-main-text promise; complete references guaranteed in scrollable child views |
| U6: ambiguous Effective/Proposed compare selectors | Explicit baseline/accepted-proposed views, order, default and narrow view chooser |
| U7: nested focus and async input ownership | Parent restoration and add/replace/remove focus rules, local busy/error ownership |
| U8: vague position counters | Filtered configuration count separate from action position |
| U9: Enter says edit on read-only/action targets | Contextual edit/view/add/choose hints |
| U10: incomplete search input key contract | Cursor editing, paste/CJK ownership and separate paging keys |
| U11: error feedback disappears during navigation | Persistent operation errors with explicit clearing rules and full item explanation |

The UI reviewer suggested displaying the complete first reference in the main
description. That is not required when it conflicts with compact height and
arbitrarily long IDs; the revised contract states the limit honestly and keeps
full-reference inspection reachable with Enter. No other issue is deferred to a
hidden Settings/Diagnostics replacement or an upstream change.

Follow-up on 2026-10-29: the original functional reviewer re-read revision 2,
checked F1-F7 against the revised contracts and acceptance scenarios, and
confirmed all seven resolved with no remaining functional-plan blocker.
This receipt does not certify implementation or runtime behavior.
The original UI/UX reviewer independently checked U1-U11, including the revised
local-chain acceptance/cancellation flow, and confirmed all eleven closed with
no remaining UI/UX-plan blocker. The reviewer accepted the bounded main-view
description plus full-reference child inspection as the resolution of U5.
Both follow-ups are limited to the proposal text and its acceptance contracts.

### Additional independent UI/UX review: revision 3

On 2026-10-29, a separate `visual-engineering` reviewer (`st_01a18636`) reviewed
revision 2 (`05ceed5`) read-only against local proposal and implementation
evidence. The reviewer reported one blocker and four nonblocking improvements.
The dispositions below record proposal corrections, not runtime QA.

| Finding | Revision 3 disposition |
| --- | --- |
| V1 (P1): search Esc competes with panel close/discard | Main-view query clearing takes precedence; contextual Esc hints and zero-result/action-focus acceptance added. Child pickers deliberately retain immediate cancellation, with Ctrl-U for clearing, preserving their immediate-parent contract. |
| V2 (P2): task Done/Esc acceptance is ambiguous | Each validated field choice enters the shared unsaved buffer; Back to main and Esc retain it. No task-level form; conditional Back to changes and rejection behavior explicit. |
| V3 (P2): unchanged and locally edited chains look identical | Opening form and shared-buffer states separated; unchanged sketch, Use chain availability, comparison/return gating and local revert rules explicit. |
| V4 (P3): background candidate inspection is unspecified | Read-only child with complete IDs, strategy, paging and focus return; only established sets get candidate lists. Fixed/dynamic details do not invent candidates; local tasks have no model picker. |
| V5 (P3): group labels can exhaust a tiny viewport | Labels share the body budget and disappear at 3 visible rows or fewer; selected kind remains identifiable without hiding the selected entry. |

V1 is a usability correction rather than evidence that revision 2 left main-view
Esc entirely undefined: that revision explicitly specified immediate close or
discard. Revision 3 makes search recovery take precedence in the main view and
narrows the generic text-input cancellation wording to child inputs.

Implementation must verify host key decoding and paste/CJK behavior through real
input, not screenshots alone. The additional reviewer could not locate a durable
original Settings screenshot in this repository; its extracted layout contract is in
section 2, while visual fidelity remains unverified until the original reference
and real terminal captures can be compared. Neither historical QA nor this
additional review certifies the proposed runtime behavior or user acceptance.

Follow-up on 2026-10-29: the same independent visual-engineering reviewer
re-read revision 3 and checked V1-V5 against its sketches, normative interaction
contracts and acceptance scenarios. All five were confirmed closed, including
the distinct main-search and child-picker Esc rules, with no remaining
proposal-level blocker. This confirmation is limited to proposal text; actual
terminal behavior, visual fidelity and user acceptance remain unverified.
