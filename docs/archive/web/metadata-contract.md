# Historical metadata contract

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

## Historical Web catalog contract (retired 2026-10-28)

Everything below records the earlier control-endpoint producer and its dated
evidence. References to production, the server, workers, CLI doctor, HTTP/SSE
and per-request refresh describe that retired implementation, not the current
extension. Historical source claims and measurements are preserved unchanged.

Original inspection date: 2026-10-25 (against installed OMO Native standalone 5.1.46; updated 2026-10-26 for SDK structural checks; updated 2026-10-27 for the project-local live TUI control endpoint catalog contract).

## Historical Implementation: Project-Local Live TUI Control Endpoint Contract

Verified: 2026-10-27.

Production catalog queries connect **only** to existing same-user, matching-project TUI control endpoints. The panel never spawns the OMO CLI, never starts a new CLI RPC session, never calls `open_session` or attaches to an active conversation, never enters a session lifecycle or triggers hooks, never sends model inference probes, and never alters the selected model in any running session.

### 1. Role of the Official SDK vs. Live TUI Model Registry

The `@code-yeongyu/senpi` SDK is used **only as a transport, endpoint discovery, and control authentication helper**. Model definitions never come from an isolated SDK `ModelRuntime` instance. Instead, every catalog query reads the actual `ModelRuntime.getAvailable()` output already loaded inside the running TUI process, including models registered by loaded extension providers.

For each candidate control endpoint, the query executes only three read-only control commands:

- `get_protocol_info`
- `list_sessions`
- `get_available_models`

Session records returned during endpoint matching are used solely to verify that the endpoint serves the target project. The panel never exposes session names, conversation history, active session state, or current model selections in the API or UI. Native reports remain the sole routing oracle for new-task candidate chains.

### 2. Endpoint Identity, Digest Binding, and Conflict Resolution

Before accepting a catalog response from a candidate endpoint, the worker verifies process and installation identity both **before and after** the query:

- The running TUI process must belong to the same OS user and match the target project directory.
- The process executable must digest-match the active installed OMO launcher binary.
- Protocol instance identity (`instanceId`), OS process start time (`processStartTime`, alongside `pid` and `executable`), and endpoint registration must agree before and after the control requests complete.

Multi-endpoint and zero-endpoint behavior is deterministic:

- **Multiple matching endpoints**: If more than one matching endpoint is running for the same project and their sanitized model catalogs agree, the catalog is accepted and all matching instance IDs are recorded. If their sanitized catalogs differ, the query fails closed with a conflict error (`catalog-endpoint-conflict`) rather than taking a union or picking an endpoint at random.
- **Zero matching endpoints**: If no running TUI endpoint matches the target project and active launcher digest, the panel keeps the last verified catalog marked `stale` (or `unknown` before any catalog has been loaded) and blocks writes. It **never** falls back to standalone SDK model definitions and **never** auto-starts a background host or TUI session. Stale catalog reuse is permitted only when the installation launcher digest and target project still match.

### 3. Coverage Boundary

The catalog source reports `kind: "tui"` and `coverage: "running-tui"`. This coverage represents the **running TUI's loaded model registry** at query time. It does **not** prove:

- What a future fresh TUI start will load after external plugin or environment changes.
- Upstream or remote provider health, account quota, or inference reachability.
- Session-specific model scopes or user favorites.
- That newly edited configuration files have already been reloaded inside the running TUI process.

### 4. Source Metadata, Input Revision, and Public Snapshot Boundary

Internally, a verified native catalog carries `source`:

```text
{
  kind: "tui",
  coverage: "running-tui",
  launcherDigest: string,
  agentDir: string,
  project: string,
  profile: string | null,
  inputRevision: string,
  inputs: Array<{ path: string; revision: string }>,
  endpoints: Array<{
    socket: string;
    instanceId: string;
    pid: number;
    processStartTime: string;
    executable: string;
  }>,
  watchPaths: string[]
}
```

- **Stat-only input revision**: `inputs` tracks `auth.json`, `models.json`, `models-store.json`, global/project `settings.json`, `credential-pool-state.json`, and `trust.json`. Their revisions are computed from filesystem `stat` metadata and canonical target identities only. The route-panel server never reads or parses credential file contents.
- **Deterministic catalog revision**: `catalog.revision` hashes the sanitized, deterministically sorted model list together with the normalized source identity, excluding capture timestamps so identical state produces the same revision.
- **Restricted public snapshot**: `snapshot.catalog.source` exposes only `{ kind, coverage, project, launcherDigest, inputRevision, instances: string[] }`. Socket paths, PIDs, credential paths, raw worker errors, and internal exceptions are never leaked to the browser.

### 5. Per-Request Re-verification, Invalidation, and Refresh Lifecycle

- **No periodic polling**: The server never polls the TUI catalog on a timer.
- **Watcher invalidation**: File watchers monitor `watchPaths` for known catalog dependencies and configuration files. When a watched catalog dependency changes, existing previews are invalidated and SSE carries its `catalogStatus` to the browser. The browser updates the badge, retains drafts, and offers catalog refresh rather than treating a configuration-only refresh as recovery. A `catalog-changed` API response applies the same state even if SSE is disconnected.
- **Canonical targets and publication barrier**: Watchers observe both original paths and resolved targets, comparing target metadata as well as link identity. They are armed before asynchronous snapshot checks; an invalidation generation change prevents publication of a previously constructed fresh snapshot. Explicit refresh and post-save queries retire old watcher baselines before rebuilding.
- **Per-request verification**: `preview`, `save` (including `beforeCommit`), and `undo` re-query and verify the live catalog source and input revision. If the catalog source, input revision, or endpoint set changed since the snapshot or preview baseline, the request is rejected with `catalog-changed` (`409`) while preserving unsaved browser drafts.
- **Explicit refresh and post-save refresh**: Only an explicit catalog refresh (`POST /api/refresh` with `target: "catalog"`) reacquires a changed catalog source after invalidation; successful `save` writes also refresh the catalog for the returned snapshot. The last successful catalog is retained before either query, so a post-save query failure returns stale models rather than an empty initial-unknown state. A configuration-only refresh cannot relabel a rejected source or input revision as fresh.
- **Static doctor scope**: `node dist/src/cli.js --doctor` verifies SDK transport artifacts and the installed native runtime only. It does not query credentials, connect to a live TUI endpoint, or establish catalog equivalence.

---

## Historical Evidence: Standalone SDK vs. Live TUI Catalog Divergence (2026-10-27)

*Historical note: Earlier documentation (2026-10-25 through 2026-10-26) treated an isolated standalone SDK `ModelRuntime.getAvailable()` query (`allowModelNetwork: false`, `SENPI_OFFLINE=1`, without extension registration) as equivalent to the live model list. Read-only verification on 2026-10-27 disproved that assumption and motivated the switch to querying the running TUI control endpoint.*

Manual read-only comparison on 2026-10-27 against the same local environment showed:

- **Standalone SDK query count**: 578 models.
- **Running TUI `get_available_models` count**: 580 models.
- **Present only in running TUI (`onlyTui`, 4 models)**:
  - `kimi-coding/k3.1-pro-highspeed`
  - `opencode-go/gemini-4-argon`
  - `opencode-go/iceman-contributor-free`
  - `openrouter/liquid/lfm-2.5-2.6b`
- **Present only in standalone SDK (`onlySDK`, 2 models)**:
  - `openrouter/openai/gpt-3.5-turbo`
  - `openrouter/openai/gpt-3.5-turbo:batch`

Because a standalone SDK worker neither loads runtime extension providers nor reflects the live TUI registry state, the standalone SDK catalog contract was retired in favor of the project-local live TUI control endpoint query above.

---

## Historical Evidence: CLI RPC Startup Blocker (2026-10-25)

*Historical note: The sections below preserve the 2026-10-25 source audit explaining why spawning a new CLI RPC process (`omo --mode rpc --no-session --no-extensions --no-skills`) was rejected and remains forbidden. Any personal path shown in the environment block below is a historical record from that audit, not a runtime default.*

### Conclusion

**Spawning a new CLI RPC process cannot be enabled safely.** The security contract requires proving that startup, catalog lookup, and shutdown cannot trigger model inference or arbitrary shell commands. Proving that the `get_available_models` handler itself does not call a model is insufficient because spawning the CLI with those flags still loads built-in `hooks`, and the `session_start` lifecycle event can execute arbitrary user-trusted `SessionStart` shell commands before the first RPC request is even read. Connecting to an already-running TUI control endpoint avoids spawning a new CLI lifecycle while reading the exact live registry.

### Inspected Upstream Versions (2026-10-25)

- Installed runtime directory during audit: `~/.omo/binary-runtime/5.1.46/`.
- Upstream OMO tag: `code-yeongyu/oh-my-openagent` at `v5.1.46` (`packages/omo-native/package.json` depending on `@code-yeongyu/senpi: 2026.10.23-1`).
- Upstream Senpi tag: `code-yeongyu/senpi` at `v2026.10.23-1` (paths below are relative to `packages/coding-agent/src/`).

### Verified RPC Request Handler vs. CLI Startup Blocker

The candidate CLI invocation inspected on 2026-10-25 was:

```text
<verified standalone omo> --mode rpc --no-session --no-extensions --no-skills
```

With stdin request:

```json
{"id":"catalog","type":"get_available_models"}
```

While `modes/rpc/connection-handler.ts:1436-1437` and `modes/rpc/session-control-actions-data.ts:10-32` confirm that `get_available_models` only calls `modelRegistry.modelRuntime.getAvailable()`, the CLI startup sequence still executes built-in extensions:

1. `core/resource-loader.ts:770-772` uses `noExtensions` only to filter external extension discovery paths.
2. `getActiveBuiltinExtensionIds():1370-1396` in the same file selects built-in extensions from `enabledBuiltinExtensions` / `disabledBuiltinExtensions` in settings and **ignores `noExtensions`**.
3. `loadExtensionFactories():1534-1562` instantiates the enabled built-in extensions.
4. `core/extensions/builtin/index.ts:77` registers `hooks` as a built-in extension.
5. `core/extensions/builtin/hooks/index.ts:77-101` loads hook configurations and trust records, and lines `157-168` dispatch `session_start` via `dispatchLifecycleHookEvent` without any exemption for `--no-session` or `--offline`.
6. `core/extensions/builtin/hooks/lifecycle-adapter.ts:222-255` selects trusted matching handlers (skipping only runtime-discovered hooks on initial startup, not global/pre-session hooks).
7. `core/extensions/builtin/hooks/dispatcher.ts:86-107` and `command-runner.ts:38-71` execute `spawn(command, { ..., shell: true })`.

Because `cli/args.ts` provides no CLI flag to disable built-in `hooks` or override `settings.json` independently of `agentDir` (`core/sdk.ts:258-270` binds `auth.json`, `models.json`, and `SettingsManager` to the same `agentDir`), spawning a fresh CLI binary cannot guarantee zero hook execution or zero inference.

### Verified Global Settings Path Precedence

Inspection of `v5.1.46/packages/omo-native/bin/lib/agent-dir.js`, `compiled-environment.ts:6-14`, and Senpi `config.ts:628-637,691-694,720-723` confirmed the global settings path resolution order:

1. Environment overrides in order: `OMO_CODING_AGENT_DIR`, `SENPI_CODING_AGENT_DIR`, `PI_CODING_AGENT_DIR` (first non-empty trimmed value, resolved via `resolve()`).
2. Default agent directory when unset: `<home>/.omo/agent` (where `<home>` is `HOME || USERPROFILE || homedir()`).
3. Global settings file: `join(getAgentDir(), "settings.json")` (typically `~/.omo/agent/settings.json`).

This precedence is used dynamically at runtime rather than hardcoding any single user's home directory.
