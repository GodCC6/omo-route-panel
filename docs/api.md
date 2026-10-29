# Native Extension and Transaction API

Maintained contract updated: 2026-10-29. This is an in-process host seam, not a
network protocol. The [former Web API](archive/web/api-contract.md) is archived.

## Package and host entry

`src/extension.ts` exports the named `extension` factory. Build generates
`dist/extension/index.js`, which default-exports it for the host's
`pi.extensions` loader. The factory registers `/route-panel` and host shutdown
handling; the command requires interactive TUI mode and opens one panel at a
time. It does not start a service or another OMO.

The structural `HostAPI` / `HostContext` seam supplies command registration,
shutdown, current project/agent directory, `modelRuntime.getAvailable()`,
themed custom UI, notifications and reload. No Senpi SDK runtime is constructed.
The running host's installation identity is bound to native report discovery;
generation retirement prevents old callbacks from authorizing later work.

## Controller

`src/tui-contract.ts` defines `PanelController`, `PanelView`, `EditorView`,
`Scope` and `SaveOutcome`. `src/editor.ts` implements the controller:

| Method | Meaning |
| --- | --- |
| `read(scope)` | Read User or Current project interpretation; refuse refresh/scope changes while accepted edits are pending |
| `begin()` | Begin one supported user-native-file editor |
| `change(operations)` | Validate combined operations and prepare declarations plus native effects without writing |
| `undo()` | Prepare the latest eligible native Apply's reversal in the same editor |
| `apply()` | Recheck dependencies and commit accepted changes once |
| `cancel()` | Discard the temporary buffer |
| `close()` | Retire the controller and its authority |

`PanelView` carries the verified inspection, host catalog, routes, background
semantics, user declarations and undo eligibility. `EditorView.group` is always
`"native"` and exposes the target path, operations, changes, proposed routes,
background and profile. Settings may be read and hashed as dependencies but are
not an editable group. Old Settings undo records cannot mutate that file.

The route child form is local UI state until **Use chain** accepts it. Valid
background field choices enter the shared buffer directly. **Changes** inspects
that accepted buffer; **Apply** is the only commit action. Exact interaction
rules live in [DESIGN](../DESIGN.md).

## Apply and lifecycle

Before writing, recheck configuration revisions/permissions, host registry,
installation, background artifacts and identity/context dependencies. Validate
allowlisted operations and native candidate resolution. External drift rejects
the operation without auto-merging; validation failures retain the buffer.
Locking, JSONC edits and atomic replacement belong to `src/config.ts`.

`SaveOutcome.status` is `"saved"` or `"saved-reload-failed"`. A completed save is
notified through the host before reload retires the context. Reload failure
does not imply rollback or permit resubmitting the same save. Precommit failure
must never emit a Saved notification.

Cancel, close, ordinary reload and shutdown retire unapplied buffers. Minimal
last-Apply undo survives reopening/reload; it is not a draft store. Undo requires
inspection and explicit Apply, refuses changed saved fields and preserves
unrelated external edits.

Base controller/TUI tests cover these transitions; native integration and
real-host acceptance are separate evidence. See [CONTRIBUTING](../CONTRIBUTING.md)
for commands and [SECURITY](../SECURITY.md) for trust boundaries.
