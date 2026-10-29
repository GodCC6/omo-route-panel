# Background semantic evidence

Verification date: 2026-10-29.

## Boundary and API

A valid native routing report does not establish background-task semantics.
`loadBackgroundEvidence(runtimeRoot)` independently reads the selected
installation's `plugin/extensions/omo.js`, without importing it. It returns a
timestamp, artifact path, canonical path, full SHA-256, and one evidence record
per maintained rule. Each rule records its method, affected fields, and bounded
source references: UTF-16 offsets and lengths in the decoded source, with SHA-256
of each referenced fragment. No source text is returned in snapshots.

`backgroundEvidencePaths(runtimeRoot)` supplies the artifact paths for watching.
`backgroundRoutes(inspection, report, fields, evidence?)` accepts the resulting
record as its fourth argument. Evidence must belong to the inspection's runtime
root. Omitted evidence means unknown semantics, even with a valid report.

The checker uses exact, unambiguous implementation fragments recorded in
`backgroundSourceContracts`; it does not approve a version number or a full-file
digest from a compatibility whitelist. It checks readable regular source inside
the supplied runtime, with a size bound and a no-follow file open. It does not
read personal configuration, credentials, hooks, transcripts or session state,
or start sessions or inference calls.

The first inspection binds the artifact's canonical path and full digest for the
process lifetime. Later missing, changed or redirected artifacts invalidate every
rule that depends on that artifact, even when their recorded fragments still
occur and the native report is unchanged. Restoring the bound artifact restores
its evidence; a different artifact needs a fresh process/source-contract check.
A new process still has to pass the recorded source contracts. A new minification
can therefore require a reviewed contract update, even when behavior is unchanged.

## Recorded upstream inspection

The supplied installation was inspected at `2026-10-29T08:26:09.367Z`.
Its runtime directory was named `5.1.51`; that name is identification, not a
compatibility condition. The artifact was `plugin/extensions/omo.js`, SHA-256:

```text
443394ed1461a1502d91124667dc6fc94d82c458867b07e5549f8080e061080e
```

The bounded source inspection traced configuration schemas through the binding
gate, task settings and model-selection call sites. The native integration test
repeats the read-only contract checks against the explicitly supplied launcher.
The following offsets identify reviewed entry points, not line numbers in the
large minified bundle. The exported evidence contains every reference and digest.

| Rule | Reviewed source references | Affected output |
| --- | --- | --- |
| `defaults` | `hu` schema at 176259, Sync/Recall defaults at 176919, `b0` default parser at 800104 | Omitted memory/task switches; default Recall/Reflection category; Dream scheduling defaults |
| `globalGate` | `wae` at 1146413, `_ae` at 1146513, binding short-circuit at 915671, callback wiring at 1144349 | Memory task configuration switches; the gate precedes identity binding |
| `identityOverrides` | `_0` at 800142; `C7` at 973546; Dream settings at 1138012; Facts at 1099013; Nudge at 1134025 | Per-identity task switches, categories and Dream scheduling values |
| `identityDerivation` | Normalization and Unicode slug at 506072/506159; hash construction at 506430; automatic path/git branch at 507092 | Fields whose resolution needs an identity override lookup |
| `syncGlobal` | Global `p.sync` handoff at 917824; Sync runner gate at 922063 | Sync configuration switch, independent of identity overrides |
| `factsModel` | Identity/global explicit-model precedence at 1086283; session fallback at 1087138 | Facts explicit model and selection strategy |
| `factsQuick` | Disabled/user-configured quick branches at 1086407; explicit user candidate membership filtering at 1086724 | Facts category, strategy and candidate filtering |
| `dreamReflection` | Shared `_0(...).category` resolution at 885125; Dream/Reflection surface selection at 885831 | Dream's Reflection category relationship and category candidates |
| `reflectionDynamic` | Pricing/context-window branches at 886219; fork-versus-category cost comparison at 887080 | Reflection and Dream dynamic strategy, never a fixed selected model |

The previous recorded fragments described the installation inspected on
2026-10-27 (`5.1.48`). On 2026-10-29, a fresh compiled native test against
the explicitly supplied OMO launcher reproduced
`defaults: Recorded source contract for defaults is missing or ambiguous.`
The new bundle renamed private schema, parser, identity and resolver bindings.
The reviewed values and precedence below did not change. All affected exact
fragments were refreshed together, retaining parser-to-schema and caller wiring,
unique-match checks, per-rule invalidation and process-lifetime artifact binding.
No version exemption, fuzzy identifier match or execution of the bundle was added.
Older or future bundles still need to satisfy the recorded fragments; this
inspection does not establish compatibility for another installation.

The `hu` schema enables memory, Recall, Reflection, Dream, Facts, Nudge and Sync
by default. Recall and Reflection default to category `quick`; Dream defaults to
30 idle minutes, 24 hours between runs and an enabled shutdown trigger.
`b0` parses the default schema when memory is omitted. The global enabled gate
runs before identity binding. Reflection and Recall merge identity settings over
global settings (including nested trigger/event caps); Dream, Facts and Nudge use
identity leaves with nullish global fallbacks, so explicit `false` is preserved.
Sync receives global `p.sync`, not identity Sync settings. Dream uses the
effective Reflection category and its dynamic cost/context policy. Facts uses an
identity model, then a global model, then explicitly configured quick candidates,
otherwise the session model; these are selection rules, not verified inference.

`omo-memory-sync.js` was also inspected for its static exports. It does not
consume memory configuration; the global-only Sync settings handoff and enabled
gate are in `omo.js`. Neither that extension nor `omo-memory-doctor.js` is a
dependency of the configuration claims above. Their availability is not proof
that a configured task is running.

## Scoped invalidation and candidate ownership

Switch, category/model and dynamic-strategy dependencies are checked separately.
For example, missing Facts quick-precedence evidence makes the dependent Facts
model fields unknown, not its independently verified enabled switch. It does not
invalidate an explicit Facts model, Dream or ordinary native routing. Missing
dynamic-selection evidence preserves a verified category and its native
candidates while making the dynamic strategy unknown. A verified false global
memory gate determines disabled switches without resolving identity overrides.
Missing defaults do not erase independently explicit switch values.

Changes to the shared `omo.js` artifact invalidate all dependent memory claims.
They do not erase compaction settings or change native-route compatibility.
Unknown is represented as `null`/`unknown` with reasons, never as disabled.
`semanticEvidence` on each mapped memory row summarizes the relevant rules.
`BackgroundEvidence.rules` is the separate ledger returned by
`loadBackgroundEvidence`; `PanelView.background` carries the derived rows.

Native reports remain the sole source of resolved candidate order. Facts filters
that order to explicitly user-configured quick entries, including configured
fallbacks, without adding built-in candidates. An explicit Facts model is shown
as configuration, not manufactured into a resolved candidate chain. An explicit
Facts model bypasses quick's disabled branch; otherwise disabled quick suppresses
the chain. The panel does not call the upstream resolver or infer active models.

## Verification and limits

- `background.test.ts` and `background-evidence.test.ts` use synthetic evidence
  and temporary source files. They protect mapping, independent field
  invalidation, root binding, changed/missing artifacts and safe source access.
  They do not establish agreement with upstream.
  An independently recorded installed-defaults fixture also rejects changed
  enabled/category values, a parser pointing at another schema and duplicate
  parser evidence; it is not generated from the exported contracts.
- `background-evidence.native.test.ts` requires `OMO_LAUNCHER_PATH`. It locates
  that installation through static launcher/cache identity checks, inspects source only, and
  fails if any maintained rule lacks its recorded contract. It prints the actual
  verification timestamp and artifact digest.
- Source-contract checks are bounded static evidence, not execution, a complete
  JavaScript semantic proof, or verification of every possible caller. Exact
  fragment presence alone is not a security attestation of an arbitrary
  adversarial distribution.
- Configuration switches do not establish running state. Environment flags,
  runtime flags, selected sessions, Git identity, model availability, pricing
  and actual call success are not probed. Git identities with potentially
  applicable overrides remain unknown.
- Compaction's configured model is displayed independently. Its unconfigured
  runtime selection is unknown; these memory contracts do not validate it.

For an account-free check, run `bun run validate:base`. For supplied-installation
evidence, run `bun run validate:native` with the explicit launcher (and, if
needed, `OMO_NODE_PATH`). Both validation entry points build fresh temporary
output rather than modifying a running service's `dist`.
