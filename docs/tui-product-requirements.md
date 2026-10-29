# Native TUI Product Requirements

Maintained contract updated: 2026-10-29. The compact two-section editor and
terminal boundaries are implemented. This document defines ongoing behavior,
not a fresh verification claim. Exact keyboard and layout rules live in
[DESIGN](../DESIGN.md); dated decisions and results live in the
[archive](archive/README.md), including the
[previous v1.1 baseline](archive/native/tui-product-requirements-v1.1.md).

## Purpose and ownership

Help an OMO user compare upstream recommendations, user overrides and effective
candidate chains for new tasks, understand proposed changes and save them
reversibly inside OMO's native TUI.

OMO owns the process, registry, terminal themes and reload lifecycle. The
extension registers `/route-panel` and uses the current host's model availability;
it neither constructs an SDK runtime nor starts another host. Native reports
remain the only routing oracle. Complete model references concatenate provider
and raw model ID without stripping nested provider-like segments.

User scope is the default and excludes project configuration/identity influence.
Current project is an optional interpretation context, never a project write
target. All edits target the supported user-level native routing file. Host
settings can be read as resolution dependencies but are never edited.

## Two sections

**Routes** contains categories, agents and model profile. Users can search the
full host catalog, add categories, replace/reorder/remove candidates, select
candidate reasoning and restore chain inheritance. A route's local form is
accepted as a whole through **Use chain** after validation. Chain editing
preserves route-level reasoning and unrelated behavior fields.

Comparison shows one chain at a time: `Saved effective`, `Saved user override`
and `Upstream`, plus `Proposed effective` when the shared buffer is dirty.
Recommendations are distinct from effective runnable candidates; source or
reasoning attribution must not be guessed from equal values.

**Background** contains Recall, Reflection, Dream, Facts, Nudge and Memory Sync.
Editable rows show user declarations separately from effective values and sources.
Recall and Reflection support enabled/category overrides; Dream supports enabled
and shares Reflection's category; Facts supports enabled/explicit model. Nudge
and Sync are read-only and have no model picker. Verified defaults, global gates
and attributable identity overrides determine effective values. Dynamic policies
remain dynamic; missing source evidence is an explained gap, not a fixed-model
guess or a disabled switch. See [background semantics](background-semantics.md).

## Editing and recovery

Accepted changes across both sections share one temporary user-native-file
buffer. Route-local changes need **Use chain**; valid background field choices
enter the buffer directly. **Changes** identifies the target, saved/proposed
declarations and native effects. **Apply (N)** is the only commit action.

Apply rechecks configuration, permissions, installation, catalog and context
dependencies, rejects conflicts without auto-merge, and preserves comments and
unrelated nodes. Notify the host of the completed save before reload can retire
the editor. Distinguish a saved file followed by reload failure from a rejected
precommit check; prevent duplicate writes.

Close/discard, ordinary reload and shutdown retire unapplied buffers; no drafts
are restored. Dirty close defaults to keeping edits. Scope changes and Refresh
require Apply or discard first. Undo prepares the latest successful Apply's
reversal in Changes for explicit Apply, survives reopening/reload, rejects changed
saved fields and preserves unrelated edits. Old Settings undo records cannot
reopen a hidden Settings editor or mutate Settings.

## Terminal acceptance

Use English UI text, host theme helpers and keyboard actions. Typed and pasted
text belongs to input, never command dispatch. Search `Esc` clears a nonempty
query before close/discard. Function keys are optional because More, Apply and
Changes are selectable rows.

Use a bounded frame up to 84 terminal cells wide and 20 rows high, with at most
10 body rows. Child editors replace the body. ANSI/CJK-aware truncation must
leave complete identifiers inspectable in scrollable child views. Top/bottom
rules separate the component from host transcript/footer text. Preserve selected
content and reachable actions at `120x40`, `70x24`, `40x12` and the `18x8` safety
fallback in both themes.

Acceptance must exercise actual opening, complete model search, route acceptance,
background/profile edits in a combined buffer, Changes, discard, Apply, conflicts,
ordinary reload, save-triggered reload, reload failure and durable undo. Use
temporary HOME, synthetic providers and inference tripwires. Keep base, native,
packaging and real-host visual evidence distinct.

## Non-goals

No Web interface, HTTP/SSE bridge, daemon, remote browser access, multi-host
catalog aggregation, inference probes, session monitoring or current-session
model controls. No Settings/Diagnostics section, compaction editor, doctor/raw
JSON dumps or general-purpose configuration editor. No persistent drafts,
cross-file pending edits, automatic merging or multi-level undo/redo.
