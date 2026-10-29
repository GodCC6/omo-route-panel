# Historical native contract

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

## Historical Web adapter contract (retired 2026-10-28)

The sections below preserve the former server/CLI adapter contract and dated
upstream evidence. Server options, catalog endpoint queries, browser snapshots,
watchers and CLI paths are historical descriptions, not current entrypoints.
Source evidence is not fresh certification of the replacement TUI.

### Former adapter interface

`src/native/index.ts` exports read-only contract types alongside `createNativeAdapter(options)`, `catalogSnapshot`, `projectConfig`, `discover`, `NATIVE_REASONING`, and `NATIVE_MODEL_PROFILES`.

`options` are configured exclusively by the server: `runtimeRoot`, `nodePath`, `launcherPath`, `home`, and `timeoutMs`. The adapter never accepts runtime directories, module paths, or shell commands from the browser. By default (with P1 runtime input resolution), the CLI resolves `--node-path` (or `process.execPath`) and `--omo-path` (or `~/.local/bin/omo`) and discovers the matching runtime from the launcher's canonical target and installation cache. It does not rely on a hardcoded OMO version string or static digest allowlist.

- `inspect({ project, profile? })` returns `NativeResult<NativeInspection>`.
- `catalog({ project, profile? })` queries the project-local live TUI control endpoint worker (`get_protocol_info`, `list_sessions`, `get_available_models`) for an existing same-user, matching-project TUI whose process executable digest matches the active installed launcher. It never spawns the OMO CLI, never starts or attaches to a session, and never falls back to standalone SDK model definitions.
- `resolve({ project, profile?, catalog, candidate? })` verifies real-versus-mirror equivalence and returns `effective`, clean `defaults`, and optional `candidate` resolution.
- `candidate` maps an existing `sourceId` to a full **routing allowlist projection** replacement, not a raw file, JSON Patch, arbitrary file path, or partial merge layer. An absent user config file is represented as a virtual source with `revision: "absent"` so first-time global config creation can be previewed before any file exists on disk.

Results use `{ status: "ok", value }` or `{ status: "unknown" | "unsupported", code }`. Failures never expose raw exceptions, socket paths, credential paths, configuration text, or worker `stderr`. Static error codes distinguish unavailable endpoints, multi-endpoint catalog conflicts, and mid-operation catalog or input changes. An `unknown` catalog is never coerced into an empty catalog. `catalogSnapshot` hashes sanitized, deterministically sorted models together with the typed `CatalogSource`, excluding capture timestamps. The application separately projects its restricted public source (`{ kind, coverage, project, launcherDigest, inputRevision, instances }`) into the browser snapshot. Pure sanitization fixtures may omit the source; the production native adapter rejects an unbound catalog.

Each configuration source carries `sourceId`, `path`, `relativePath`, `scope`, `revision`, and `config`. `config` contains only the sanitized routing projection, while `revision` is the SHA-256 digest of the entire underlying file. `watchPaths` includes all candidate `.omo` directories from `HOME` down to the target project plus known catalog input dependencies (`auth.json`, `models.json`, `models-store.json`, settings files, `credential-pool-state.json`, and `trust.json`, tracked by `stat` and canonical-target identity only) so the parent server can watch for external edits. The engine also reports both the input path and `realpath` for the launcher and Node executable; the server watches both so a symlink switch immediately invalidates the active snapshot rather than waiting until the next save attempt. Test fixtures replace only temporary launcher symlinks and never modify a real OMO installation.

Global settings path resolution follows the standalone environment override precedence and reports `pathStatus: "verified-global"`. Project settings report `projectInfluence: "unknown"` because project trust state is not read from user state files.

## Native Reports & Isolated Worker Execution

`NativeView` consists of `{ report, doctorLines }`. The adapter never rewrites the upstream routing algorithm:

- `categories[]` and `agents[]`: `kind`, `name`, `status`, optional `primary`, `runtime[]`, `rungs[]`, and optional `reason`.
- Each rung: `model`, `source`, `state`, plus optional `providers` or `excludedBy`.
- Top-level fields: `excludeModels`, `modelProfile`, and optional `configProfile`.
- `runtime[]` represents new-task configuration output, not an active session. Native rungs do not carry fine-grained file-layer provenance.
- When the native report does not emit a separate effective `reasoning` field, the panel does not guess effective reasoning from local config equality.

`modelChains` and `configDoctorLines` execute in separate Node child processes with process permission flags. Module exports, report fields, and diagnostic shapes are validated at the boundary; version strings are diagnostic metadata only. Node capability is verified by probing actual permission-flag behavior rather than pinning a single patch version.

Each inspection binds the active launcher executable (`--omo-path` or `~/.local/bin/omo`) to the matching runtime binary via live SHA-256 digests cached by file identity, size, `mtime`, and `ctime`. Before importing report modules, the worker re-verifies the digest so a mid-request upgrade cannot mix modules across versions. After an upgrade, discovery selects the runtime matching the current launcher binary rather than a leftover cached directory, reporting `engine-launcher-mismatch` only when no matching runtime exists. The launcher binary itself is never executed, and `~/.omo/install.json` is not trusted as proof of the active binary.

Worker child processes do not inherit the caller's environment variables and are denied filesystem write, network, child-process, worker-thread, and native-addon permissions. Note that Node's `--permission` flag is a safeguard against accidental reads by trusted local runtime code, not a sandbox against untrusted code. Real-versus-mirror comparison grants read access to candidate `.omo` directories and the exact configuration filenames because Node permission grants on non-existent directories do not automatically cover descendants. Workers read configuration solely through the native loader and never read `auth.json`, engine `models.json`, provider secrets, MCP configs, source code, or session history.

`configDoctorLines` returns `WARN` configuration diagnostics and category-shadows-agent warnings. Any diagnostic line, real-versus-mirror report mismatch, or mid-read source revision change fails closed with a static error code without leaking user configuration values from the raw diagnostic text.

### Background Configuration & Semantic Evidence

Because the installed runtime does not export a standalone read-only memory settings resolver, `src/background.ts` merges allowlisted configuration leaf values without implementing a second model router:

1. Merge configuration files in discovery order, then apply `root`, `harness`, `profile root`, and `profile harness` layers.
2. Apply `memory.agents` overrides for the resolved new-task identity.
3. Built-in defaults enable `memory`, `recall`, `reflection`, `facts`, `dream`, `nudge`, and `sync`, with `recall` and `reflection` defaulting to the `quick` category and `dream` sharing the `reflection` category.
4. When the global `memory.enabled` master switch is `false`, all memory features resolve to disabled; upstream checks the global master switch before binding identity overrides and ignores `identity.enabled`. Similarly, the Sync runner consumes global `memory.sync` settings only and ignores `identity.sync`.
5. Verified per-feature switches, categories, and `facts.model` apply identity overrides when the new-task identity is attributable (via path or explicit name slug/hash, including legacy ASCII slug migration checks). When unattributable `memory.agents` overrides exist (such as git-remote or existing-session identities), affected switches and model strategies report `unknown`.
6. Under P2, background semantic claims are bound to the relevant installed runtime artifacts. If those artifacts change or lack verification evidence, only the dependent background fields become `unknown` (never coerced to disabled), while verified category and agent routes remain available.

## Configuration Fidelity

Configuration discovery and projection match the upstream functions `resolveOmoConfigPaths`, `findProjectConfigPathsFarthestFirst`, `detectUserOmoJsonPath`, `detectOmoJsonPath`, `resolveOmoConfigView`, `loadOmoConfig`, and `loadSenpiOmoConfig`:

- Paths are canonicalized with `realpath` first, and the target project must reside inside the canonical `HOME` directory. The mirror preserves the relative ancestor hierarchy from `HOME` to the project.
- `.omo/omo.jsonc` takes precedence over `.omo/omo.json`; project ancestors load from farthest to nearest, without duplicating `HOME` as a project directory.
- Symlinked configuration directories or files (including lower-priority `.json` siblings) are conservatively rejected.
- The requested `profile` is passed explicitly as `OMO_PROFILE` without inheriting external `OCX` or `OpenCode` profile environment variables.
- File layers merge first, followed by `root`, legacy `[senpi]`/`[native]`, `profile root`, and `profile harness`. Candidate arrays replace as a unit through the native loader.
- The clean default context omits personal configuration files and active profiles while sharing the same model catalog snapshot as the effective context.
- `models` inside `omo.jsonc` is a **model alias map** (copying only `model` and `reasoning`), not the engine's `models.json` provider registry.
- The temporary mirror writes `0600` files inside `0700` directories and cleans up its scratch root on both success and failure. Non-routing fields (`prompt`, tools, `provider_options`) are omitted from the mirror; if omitting them causes any native report difference, resolution fails closed.

## Candidate Chain Normalization

Upstream `categoryModelCandidates`, `agentModelCandidates`, and `normalizeLegacyModelFields` require clearing legacy single-model fields (`model`, `fallback_models`, `reasoning`, `reasoningEffort`, `variant`) when writing a full `models[]` array; otherwise an agent's legacy `model` field would take precedence ahead of the new `models[]` array.

Canonical `reasoning` values are `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, and `auto`. Although the upstream schema permits arbitrary passthrough strings, the panel editor restricts selection to verified canonical levels.

`model_profile` in configuration is a string (built-in `daily-normal`, `daily-heavy`, `geeky-normal`, `geeky-heavy`, or a custom key defined in `model_profiles`), whereas `modelProfile` in the native report is an object (`{ profile, selection, applied?, rungs, reason? }`). A rung's `model` may be an unmatched bare logical ID carrying `providers`, whereas `runtime[]` contains only resolved, runnable `provider/modelId` entries.

When clearing legacy routing fields, the editor preserves `thinking`, `textVerbosity`, `provider_options`, `providerOptions`, and `maxTokens` because upstream normalization maps some of those fields into provider behavior rather than route selection.

## Historical Upstream Source Evidence (OMO 5.1.46 / 5.1.48 Inspection)

The table below records the upstream source inspection that established the panel's conservative interpretation boundaries. It is static code evidence, not runtime observation:

| Area | Upstream Evidence & Conservative Boundary |
|------|-------------------------------------------|
| Recall / Kibitzer | `plugin/extensions/omo.js` (`Pte` constructor and pinned category handling): tries only the `recall.category` chain and advances to the next candidate on failure without falling back to an expensive main-session model. |
| Reflection / Dream | Same file (`g3` fork launcher, `e.route?.route === "fork"` branch): forks from the parent session file with a candidate model; effective selection depends on both the category chain and dynamic fork state, so the UI never displays a single fixed model. |
| Facts | Same file (facts model chooser): identity-level `memory.agents[id].facts.model` overrides global `memory.facts.model`; when unset, uses user-configured `quick` candidates (skipping if `quick` is disabled, and ignoring built-in fallback items appended by the loader), or otherwise inherits the session model. |
| Helper completion | `node_modules/@code-yeongyu/senpi-codemode/src/completion/handler.ts` (`resolveRequestedModel`, `lowestCostModel`, `highestCostModel`): `default` uses `ctx.model`; `smol` and `slow` pick the lowest or highest `input + output` catalog cost. Invoked on demand only. |
| Compaction | Installed `docs/settings.md` and `docs/extensions.md`: describes `compaction.model` and `getCompactionModel`; displayed as a configuration policy rather than a guaranteed runtime model across all retry/recovery paths. |
| Local processing | Nudge, lexical search, projection, and sync run locally without fabricating a model candidate chain. |
| Settings directory | `plugin/extensions/omo-task.js` (`YT`): checks agent-dir environment overrides (`OMO_CODING_AGENT_DIR`, `SENPI_CODING_AGENT_DIR`, `PI_CODING_AGENT_DIR`), then `~/.omo/agent/settings.json`, `~/.omo/settings.json`, and `~/.senpi/agent`. |
| Settings trust | Installed `docs/settings.md`: RPC has no interactive trust prompt; saved trust or `defaultProjectTrust` controls project settings loading (`ask`/`never` skip untrusted projects; `always` or `--approve` loads them). Discovering a project file on disk does not prove it is active. |

## Metadata Boundary & Validation

`src/native/catalog.ts` sanitizes catalog entries to retain only `provider`, `id`, `name`, `reasoning`, `input`, `contextWindow`, `maxTokens`, and `cost` (`input`, `output`, `cacheRead`, `cacheWrite`), and normalizes the live TUI `source` metadata (`kind: "tui"`, `coverage: "running-tui"`). Unknown properties, `baseUrl`, `headers`, tokens, socket paths, PIDs, and raw error objects never cross the public snapshot boundary.

`test/native.test.ts` and `test/metadata.test.ts` run under `node:test` against compiled output using temporary `HOME` directories, synthetic Unix control endpoints, synthetic configurations, and synthetic credentials without reading personal credentials or making inference requests. Tests that require a live installed OMO runtime belong to the native integration suite (`OMO_LAUNCHER_PATH="$HOME/.local/bin/omo" bun run validate:native`), while synthetic contract and unit tests run in the isolated base suite (`bun run validate:base`).
