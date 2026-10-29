# Open-source release-candidate evidence

Verification date: 2026-10-29.
Candidate: `omo-route-panel` `0.1.0`, an independently loaded native OMO TUI
extension. This is local release-candidate evidence, not a claim of an npm
publication or successful remote CI run.

## Scope delivered

The current guides describe only the native extension. Retired Web deployment,
HTTP/SDK contracts, old screenshots and dated implementation diaries are
separated under [the archive](archive/README.md). The old executable Web-backend
spike and its exclusive fixtures are removed; retained base/native transaction,
catalog, permission, conflict, lifecycle, background and undo tests remain.

Distribution has a real npm allowlist and precompiled extension entry, an MIT
license, third-party notices, ordinary npm/Bun consumer checks, and explicit
manual release automation. Host terminal helpers remain an optional peer rather
than another installed TUI. Contribution, security, issue/PR and weekly
dependency-update guidance is maintained alongside the current contracts.

The background source-evidence failure is fixed in `4141404` by reviewing the
actual OMO `5.1.51` source bindings, not by approving a version or ignoring a
failed rule. The nine exact source contracts retain uniqueness, field-specific
failure and artifact binding. `158e4b0` additionally fixes injected-HOME launcher
discovery, with a regression that failed before the correction.

## Verified environment and checks

Local environment: macOS arm64, Node `26.11.1`, Bun CLI `1.3.14`, npm `11.20.0`.
The final base source was copied without `dist` or `node_modules`, installed
with an empty HOME/cache under an account-free environment, and validated with
the actual frozen lockfile. Its SHA-256 was unchanged before and after install:

```text
e1ba57f5852881fe537d3e0f39f8ec5e243fdb562f7e02f1c084e86e5791122b
```

| Gate | Observed result |
| --- | --- |
| Frozen public dependency acquisition | Exit 0; no lockfile drift |
| `validate:base` from the cold source copy | 185 passed, zero failures/skips; type check, lint and isolated build passed |
| Official OMO fixture acquisition | Darwin arm64 `5.1.51` asset matched its reviewed SHA-256; `--version` expanded a fresh temporary runtime |
| `validate:native` against that fresh official runtime | 20 passed, zero failures/skips; all nine background evidence rules verified |
| Normal npm `prepack` and runtime consumer installation | Precompiled entry and workers shipped; JSONC worked; no second TUI or development tools |
| Source real-host acceptance at `120x40`, dark | One complete workflow passed without inference |
| Packed npm and Bun factories at `18x8`, light | Both complete real-host workflows passed, with the final tarball retained |
| Workflow/configuration syntax | Both workflow files, Dependabot and issue-form YAML parsed successfully |
| Current public-file pattern scan | No literal private-key headers, recognized token formats or personal absolute HOME paths found; binary screenshots excluded |

The fresh official test host was acquired separately from the existing personal
installation. All TUI/provider/configuration data was synthetic, with temporary
HOME directories and inference/agent-turn tripwires. No personal configuration,
credentials, installed extension, upstream source, local agent state or service
was modified.

The public-file pattern scan is a bounded check of the current tree, not a
comprehensive secret audit or clearance of the existing Git history. Historical
records remain labeled as history; old failures are not deleted or called passes.
Language-server requests intermittently timed out; successful strict compilation
is the type-check evidence, not those timeouts.

The retained `artifacts/omo-route-panel-0.1.0.tgz` contains 28 files. Both package
manager installations and their actual-host workflows used these same bytes:

```text
sha512-NC6OlAOojmDsJSiWhlxXvtBP6PZvvpwVd0CvL2VqwgfWfv7BeYfWdbAvgEhR4eEqp2X6IrSBvbZZ6AGmcJnN0g==
```

## Compatibility and external publication boundary

The measured native-host combination remains macOS arm64, OMO `5.1.51` and
Node `26.11.1`. CI is configured for base validation on macOS/Linux and native
acceptance on macOS, including a small-terminal packaged-host run. Configuration
alone does not establish remote results or broader native compatibility.

No source push, tag push, remote release or npm registry write is claimed by
this evidence. Public history selection and actual first publication are
separate maintainer decisions. An npm package name lookup returned 404 on
2026-10-29; it does not reserve ownership or prove an installation from the
registry. After authorization and account setup, use the
[release procedure](releasing.md) and verify the published registry integrity
plus an isolated `omo install npm:omo-route-panel@<version>` before announcing it.

The public repository `GodCC6/omo-route-panel` was created with explicit user
authorization on 2026-10-29. GitHub's repository API confirmed private
vulnerability reporting as enabled. The local `origin` targets that repository;
the repository remains without an initial source push, so no development
history has been exposed. npm metadata and reporting links use that real
repository identity.

## Independent final review

On 2026-10-29, an independent read-only gate reviewed `cc023cd..1448787` and
returned **APPROVE**, high confidence, with no blocking findings. It independently
reran the 185-test base suite, 20-test native suite, 37-file documentation check,
normal npm prepack and npm/Bun consumer installation. The rebuilt 28-file
tarball's integrity matched the retained artifact above. It also inspected the
fresh official host identity and actual wide/narrow terminal event evidence.

The review identified one non-blocking stale reference to the former
`Snapshot.backgroundSemantics` API; the maintained background document now
names `BackgroundEvidence.rules` and `PanelView.background`. This correction
changes documentation only. The reviewer did not modify source, write a review
file, commit, push or publish. The original cold-install command log was not
retained, and neither remote CI nor npm registry publication is certified by
this review.
