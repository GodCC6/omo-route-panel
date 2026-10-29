# Native TUI Product Requirements Baseline

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Version: 1.1.
Confirmed: 2026-10-28; updated: 2026-10-29.
Status: agreed product baseline for the compact native-only routing editor;
intended contract, not an implementation claim or runtime QA evidence.

This document records the decisions confirmed in the product discussion and the
2026-10-29 [interaction redesign (revision 3)](tui-interaction-redesign-2026-10-29.md). It is
the reference for subsequent TUI implementation and acceptance. Changes to the
baseline must be explicit; a previous Web interaction or an existing
implementation detail is not a requirement by itself.

The 2026-10-28 native TUI implementation and its dated acceptance evidence are
recorded in [the 2026-10-28 implementation report](tui-implementation-2026-10-28.md) as
historical evidence for that four-section build. They do not certify the
2026-10-29 compact native-only redesign, whose runtime behavior and visual
fidelity remain unverified until steps 2-6 are implemented and QA'd.
The earlier [extension-host plan](../web/extension-host-refactoring-plan.md) is
superseded as an execution plan. Its Web backend and bridge must not be carried
forward without a need established by this baseline.

## 1. Purpose

Help an OMO user understand model-routing configuration for new tasks and make
clear, verifiable and reversible configuration changes inside OMO's native TUI.

The product must answer:

1. What does upstream recommend?
2. What have I overridden?
3. What candidate chain is effective in the selected scope, using the host's
   available model set?
4. What will my changes affect?
5. Were those changes saved, and can I undo the last save?

Features that neither answer these questions nor ensure a correct save are not
part of the baseline.

## 2. Requirements

### R1. Native host integration

- Use the native OMO TUI as the only product interface.
- Work as a separately loaded extension without changing upstream source or
  generated installed artifacts.
- Opening the tool must not require a browser, separate service or access URL.
- Viewing and editing must not submit model prompts, run inference probes, create
  inspection sessions or manage unrelated running sessions.
- Leaving the tool returns to ordinary OMO interaction.

The running OMO is the host, not a component embedded or independently started by
this project. The baseline does not require standalone operation outside OMO.

### R2. User scope without a project prerequisite

- Default to `User` scope. Opening the tool does not require selecting a project.
- Offer `Current project` as an optional interpretation context supplied by the
  host. Do not require an arbitrary-directory picker or multi-project manager.
- User scope excludes project configuration and project-identity overrides.
- Current-project scope explains applicable project overrides and their effect.
- Editing targets the supported user-level native routing configuration file in
  both views; viewing project influence must not silently enable project-file
  writes.
- Label user-scope results accurately. They are not a promise of identical
  effective routing in every project.
- Keep the routing context distinct from the context in which the host assembled
  its model registry, without adding a separate Diagnostics page.

### R3. Recommendations, overrides and effective results

For categories and agents, distinguish:

- The upstream recommendation ladder.
- Explicit user overrides and inheritance.
- The effective ordered candidate chain in the selected scope.
- Relevant exclusions, disabled entries and unavailable models, plus concise
  user-facing errors when an edit or save cannot proceed.

Do not reduce a chain to its first model, guess provenance from equal values or
reimplement OMO's routing decisions. Results must agree with the installed OMO's
native reports. Do not expose raw doctor dumps, registry-context reports, source
evidence ladders or a separate Diagnostics section.

### R4. Authoritative model availability

- Use the current host's authoritative available-model set, including registered
  extension providers. Do not create or maintain a second catalog producer.
- Model search and selection cover the complete set.
- Preserve the raw model ID and the complete `provider/modelId` reference,
  including provider-like segments inside the raw ID.
- Clearly distinguish host-registry availability from provider health, inference
  reachability, favorites and session-specific model scopes.
- Do not promise what another project or a future fresh host will load.
- A failed availability lookup is an explicit failure, not an empty model set.

### R5. Background configuration semantics

For the six supported background memory tasks (Recall, Reflection, Dream, Facts,
Nudge and Memory Sync), show the effective switch and its source, and the
verified model-selection strategy: a fixed model, category binding, dynamic
selection or local processing. Do not add compaction or separate rows for
lexical projection and explicit completion helpers.

Merge defaults and applicable overrides before displaying a value, while keeping
the user declaration distinct from the resolved effect and source on editable
fields. Absence in one layer must not be presented as disabled or unknown when
the effective value can be determined. Do not present dynamic selection as a
fixed model or invent switches for on-demand functions or read-only tasks.

When a fact cannot be established, explain the specific gap and affected result
instead of fabricating a value or filling the screen with generic placeholders.

### R6. Bounded native-only editing scope

Support:

- Editing ordered candidate chains for categories and existing agents, including
  their supported per-candidate reasoning settings (with candidate `Inherit`
  omitting the candidate property while preserving route-level `reasoning`,
  `reasoningEffort` and `variant`).
- Adding a custom category when a valid non-duplicate name and first model are
  accepted.
- Removing supported user chain overrides (`models`, legacy `model` and
  `fallback_models`) to restore chain inheritance while preserving `disable`,
  route-level reasoning and other non-chain fields.
- Selecting the native routing model profile (including `Inherit` mapped to
  `remove-field`).
- Editing the existing supported background-task switches and binding fields in
  the user native configuration: Recall (`enabled`, `category`), Reflection
  (`enabled`, `category`), Dream (`enabled`, sharing Reflection's category) and
  Facts (`enabled`, explicit `model` or `Inherit`), while keeping Nudge and
  Memory Sync read-only.

Do not provide a Settings section, a Diagnostics section, settings-file editing,
file-switching commands, default provider/model editing, default reasoning
editing, compaction-model editing, raw JSON/doctor/evidence dumps, credential or
provider management, plugin or permission administration, project-file editing,
or general OMO settings management. Do not replace removed Settings or
Diagnostics views with renamed general-purpose information pages.

### R7. Multiple items in one user-native-file editing session

- Accepted edits across `Routes` and `Background` share one user-native-file
  editing session. There is no one-item restriction and no settings-file editing
  session.
- Candidate actions within a route edit a local chain form first and enter the
  shared file buffer when accepted via `Use chain`; valid background field
  choices, `Space` boolean toggles and model-profile choices enter the shared
  file buffer immediately after validation.
- Moving between `Routes` and `Background` or among entries retains accepted
  changes in that shared buffer. Opening and closing an entry without accepted
  node differences leaves the session clean and does not lock Refresh, scope
  switching or eligible Undo.
- `Apply` commits the accepted user-native-file buffer together; explicit
  discard, closing after abandonment confirmation, or host reload discards
  uncommitted changes together.
- The commit boundary is the supported user native configuration file, not one
  field or route.
- Switching scope or refreshing is blocked while accepted changes are pending,
  with an explicit Apply-or-discard explanation; it never discards pending edits
  silently or creates hidden pending buffers.

### R8. Temporary editor buffer, no draft system

Keep uncommitted values only for the current editing session. Keystrokes, model
selection and candidate reordering must not write the configuration immediately.

Cancel or closing the editor discards unapplied changes. Do not provide a draft
inbox, a separate drafts page, pending-draft counters, background synchronization,
exit recovery, cross-reload draft restoration or automatic external-edit merging.

The editor buffer supports multiple changes under R7. Removing long-lived drafts
must not be used as a reason to restrict the number of editable items.

### R9. Integrated change inspection and explicit Apply

- Make the saved and proposed user declarations, the target user native file and
  native effective consequences clear in the integrated changes view (`F4` or
  the selectable `Changes` action).
- Provide a selectable change list showing one changed item's details at a time
  when multiple items are modified, rather than concatenating every JSON payload
  or background report.
- Modified entries carry `*`, and the dirty count `N` in `Apply (N)` counts
  logical entries with actual saved-versus-proposed node differences. Reverting
  all entries to their saved declarations returns the session to clean.
- Do not require a separate Review page, a Generate Preview action or an
  additional confirmation dialog for `Apply`. An inline abandonment choice
  (`Discard N unsaved changes?`, defaulting to `Keep editing`) guards only `Esc`
  with an empty search query on a dirty main view and `More -> Discard all changes`.
- `Ctrl-S` or the selectable `Apply (N)` action commits the accepted buffer from
  the main view or integrated changes. In a child view with unaccepted local
  input, `Ctrl-S` prompts `Accept or cancel this edit first` without writing; in
  a child view with no local edits but accepted buffer changes, `Ctrl-S` or
  `Back to changes` returns to integrated changes without writing.
- Opening or searching never writes. Selecting an entry with `Enter` opens its
  child editor directly without a preliminary `e` mode switch; explicit `Apply`
  provides the user authorization to write.

The interaction is:

```text
Find / select item in Routes or Background -> Edit in child view -> Inspect Changes / Apply or Discard
```

The requirement is informed confirmation of what will be saved, not a fixed
sequence containing an additional review ritual.

### R10. Correct saves and unambiguous outcomes

- Validate supported fields, model references and native-resolution results
  before committing.
- Read necessary state on demand (including host settings when native resolution
  depends on them) and recheck relevant file, catalog and context dependencies
  before commit.
- Detect external changes during editing and refuse an obsolete save. Do not
  automatically overwrite, merge or silently rebase the user's changes.
- Preserve comments, unrelated fields and file safety properties.
- Prevent duplicate submission and partial writes.
- Clearly distinguish a rejected/uncommitted change, a completed save, and a
  completed save followed by a reload or synchronization problem.

Retain appropriate file-conflict checks and atomic-write safeguards. Multiple
OMO instances and external editors can still affect the same configuration.

No live dashboard, periodic catalog polling or continuously synchronized
client/server state is required. Refresh on demand; freshness at the commit
boundary remains necessary.

### R11. Undo the most recent successful Apply

- Retain the minimal record needed to undo the most recent successful Apply.
- Closing and reopening the tool, including after a host reload, must not alone
  discard that record.
- Show the proposed reversal before an explicit Apply, using the integrated
  change inspection rather than a separate preview-management workflow.
- Refuse undo if the relevant saved fields have subsequently changed.
- Preserve unrelated external edits.
- Undo consumes the record. Do not provide multi-level undo, redo, an edit-history
  browser or full-configuration backup management.
- If a pre-redesign undo record targets removed Settings fields, do not open a
  hidden Settings editor or modify the settings file; preserve the record and
  show a concise unavailable-for-this-version reason if needed.

An unapplied buffer is not a save and does not create an undo record.

### R12. Host reload and interruption

- Permit ordinary host reload; do not keep the old editor alive by blocking it.
- Reload or host shutdown cancels uncommitted editing, without automatic Apply
  or draft restoration.
- Old context or computed changes must never authorize a later save after their
  editing session has ended.
- Completed saves remain distinguishable from uncommitted edits even if reload
  closes the interface before it can finish displaying a result.
- Reopening reads actual configuration and host state.

The tool edits new-task configuration. It must not implement a current-session
model switch as a substitute for saving configuration, or claim that a user-level
change has identical effects in all active sessions.

### R13. English-only, terminal-appropriate interaction

- Use English interface text, consistent with the OMO host. Do not retain Chinese
  translations, a language switch or localization-state requirements.
- Preserve user-defined names, configuration values and model IDs as supplied.
- Make all core actions keyboard-accessible with consistent navigation, focus,
  cancellation and Apply behavior, without requiring function keys (`More`,
  `Apply (N)` and `Changes` remain selectable rows) or hidden single-letter
  commands (`e`, `d`, `a`, `r`, `+`, `-`) while search owns typing.
- Use a compact, bounded list layout modeled on the official OMO Settings
  screen (up to 84 columns and 20 rows, with up to 10 body rows and child views
  replacing the body instead of appending nested reports).
- Adapt to terminal size (`120 x 40`, `70 x 24`, `40 x 12`, and the `18 x 8`
  safety fallback) using ANSI-aware terminal cell widths without hiding required
  actions or losing the current editor buffer. Main-list values and the two-line
  description may ellipsize; complete identifiers and changes must remain
  inspectable in scrollable child views.

## 3. Explicit non-goals

- A Web interface, dual-interface maintenance, standalone daemon or remote
  browser access.
- Session monitoring, history analysis, current-session model management or model
  inference/health/benchmark probes.
- Aggregating registries from multiple OMO hosts.
- A Settings section, a Diagnostics section, settings-file editing, default
  provider/model or default reasoning controls, compaction controls, raw config
  JSON/doctor/source-evidence dumps, or separate rows for lexical projection and
  explicit completion helpers.
- An arbitrary project browser or general configuration editor.
- Persistent drafts, cross-file pending edits, automatic merging, multi-level
  undo or redo.
- Retaining HTTP/SSE synchronization, preview-token caches, distributed retry
  protocols or backend-rebinding machinery solely because the Web design used
  them.

These exclusions do not remove justified save validation, an immutable read
result used by a view, or the temporary buffer needed by the current editor.

## 4. Acceptance scenarios

| ID | Observable outcome |
| --- | --- |
| A1 | Open inside OMO without a project argument or browser and inspect user-scope routing in the compact `Routes` / `Background` view, with no Settings or Diagnostics sections. |
| A2 | Switch to Current project via `More`, see its influence, and still clearly identify the user-level native edit target when inspecting changes. |
| A3 | Open routes directly with `Enter` (no `e` key), accept a whole-chain edit via `Use chain` and background field/profile edits into the shared user-native-file buffer, and inspect combined changes via `F4` or `Changes`. |
| A4 | Clear a nonempty main-view search with `Esc` without losing edits; from an empty search query on a dirty main view, review the `Keep editing` / `Discard & close` choice or explicitly discard so the file remains unchanged and no draft is created. |
| A5 | Apply multiple accepted changes together via `Ctrl-S` or `Apply (N)`; only the confirmed user-native nodes change, route-level reasoning fields survive chain edits, and comments/unrelated configuration remain intact. |
| A6 | Change the file externally during editing; Apply is rejected rather than overwriting the external version, and accepted buffer changes remain inspectable. |
| A7 | Save a change that triggers reload; pre-retirement save notification and reopening show the actual saved state, distinct from reload failure or precommit rejection, and no unapplied buffer is restored. |
| A8 | Undo the latest successful Apply after reopening; relevant external edits block undo while unrelated edits are preserved, and pre-redesign settings undo records do not mutate the settings file. |
| A9 | Search the complete host model set in child pickers, preserve provider-like raw ID segments, repair multi-invalid chains before whole-chain validation, and inspect single-chain comparison views (`Proposed effective`, `Saved effective`, `Saved user override`, `Upstream`). |
| A10 | Complete the workflow using the keyboard (including visible action rows without function keys, CJK/paste-safe inputs, and ANSI-cell truncation) at `120 x 40`, `70 x 24`, `40 x 12` and `18 x 8`, without inference requests or a separate catalog runtime. |

Implementation of this 2026-10-29 redesign (steps 2-6 of
[the redesign proposal](tui-interaction-redesign-2026-10-29.md)) must exercise
the real editor, cancellation, Apply, reload and undo behavior and pass
functional plus visual QA against the official Settings reference. The
[2026-10-28 implementation report](tui-implementation-2026-10-28.md) and earlier
extension-host spike remain historical evidence only and do not certify the
redesigned interaction model.
