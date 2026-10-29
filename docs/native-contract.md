# Native Report and Adaptation Contract

Maintained contract updated: 2026-10-29. OMO is the running host; this repository
supplies an independently loaded extension. The
[retired server adapter contract](archive/web/native-contract.md) preserves old
interfaces and inspection evidence, not current entrypoints.

## Routing oracle and installation identity

Native `modelChains` and `configDoctorLines` are the only routing oracle. Keep
structural validation, launcher/runtime binding, restricted workers and
real/mirror equivalence. Never copy the routing algorithm into presentation,
tests or a second SDK runtime.

`src/runtime.ts` discovers report artifacts for the active installation.
`src/extension.ts` binds it to the running host's executable identity; macOS
checks include the mapped file's device/inode, not merely the replacement file
currently on disk. Native report loading re-verifies installation identity.
An upgrade cannot mix an old running host with another runtime's reports just
because version strings look compatible. Source paths and symbols remain
implementation details inside this adaptation boundary.

Workers execute read-only report modules in separate Node processes with
restricted permissions and a controlled environment. They cannot perform
network access, writes, inference or child-session creation. Node permissions
guard trusted local code against accidental access, not hostile code. Missing
artifacts, invalid shapes, doctor diagnostics or real/mirror differences fail
closed with sanitized error codes.

## Interpretation and configuration fidelity

User scope evaluates user configuration without project configuration or
project-identity influence. Current project is an explicit optional context
provided by the host; it never changes the user-level write target. Host registry
assembly context remains separate.

Discovery canonicalizes paths. When HOME is an ancestor, project discovery stops
there; otherwise it stops at the filesystem root. Outside-HOME project layers
map into an isolated `project-context` mirror branch while preserving ancestor
order. Every destination must remain inside the mirror. Do not grant report
workers real scratch-ancestor access just to make a mirror compare.

Preserve native JSONC/JSON precedence, farthest-to-nearest project layering,
root/harness/profile merging and candidate-array replacement. Reject unsafe
symlinked configuration paths. The requested profile is explicit; unrelated
profile environment variables cannot silently change interpretation. Clean
defaults omit personal configuration and active profiles while using the same
catalog as effective resolution.

Mirrors contain only allowlisted routing projection, with private files and
directories, and are cleaned on success or failure. Non-routing data is omitted;
if that omission changes a native report, resolution fails rather than guessing.
The `models` alias map in native configuration is not a provider registry.

## Reports and model references

Native reports expose categories, agents, runtime candidates, recommendation
rungs, exclusions, profile selection and disabled/unavailable states.
`runtime[]` represents effective runnable new-task candidates; recommendation
rungs may include unmatched logical IDs and provider evidence.

Do not infer file provenance or effective reasoning from equal local values.
Full model references preserve `provider + "/" + rawModelId`, including nested
provider-like segments. Host registry failures are never treated as an empty
catalog; see the [registry contract](metadata-contract.md).

## Editing and background boundaries

The controller prepares combined native resolution before Apply. Edits target
only allowlisted user-native category/agent chains, supported memory leaves and
`model_profile`. Chain replacement removes obsolete `model` / `fallback_models`
routing declarations while preserving route-level reasoning and unrelated
behavior fields. Candidate `Inherit` omits only candidate reasoning. Restoring
chain inheritance removes `models`, `model` and `fallback_models`, retaining
`disable` and route-level reasoning fields.

Supported candidate reasoning choices are `off`, `minimal`, `low`, `medium`,
`high`, `xhigh`, `max` and `auto`; unverified passthrough strings are not picker
choices. Model profiles may be built-in or explicitly declared custom profiles.
Only existing native agents can be edited; new categories require a unique name
and a valid complete model reference.

`src/background.ts` computes effective display values from applicable layers,
verified defaults/global gates and attributable identity overrides; it is not a
second model router. `src/background-evidence.ts` binds semantic rules to the
selected installation's relevant source artifact. Missing or changed evidence
affects only dependent claims and is never guessed from a version number.
Dynamic strategies remain dynamic. See [background semantics](background-semantics.md)
for the maintained evidence contract and its dated inspections.

`src/config.ts` owns JSONC safety, locking and atomic replacement.
`src/undo.ts` owns minimal durable last-Apply undo. Apply rechecks file, catalog,
installation, evidence and context dependencies; ordinary reload discards
uncommitted edits. See the [transaction API](api.md), [interaction design](../DESIGN.md)
and [contributor guide](../CONTRIBUTING.md). Synthetic base tests, explicitly
supplied-installation native tests and real-host terminal acceptance are distinct
forms of evidence.
