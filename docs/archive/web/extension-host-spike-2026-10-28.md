# Extension Host Spike

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Verified: 2026-10-28, macOS arm64.
Baseline: `e84c8f9`.
Spike implementation: `7b3d6fc`.
Scope: isolated integration evidence, not a production refactor or deployment.

Product direction updated: 2026-10-28. The
[native TUI requirements](../native/tui-product-requirements-v1.1.md) supersede the companion
Web-backend plan. The results below remain dated feasibility evidence; a surviving
Web backend, restored draft or private bridge is not required by the TUI product.
This spike did not validate the proposed native editor interaction.

## Decision

An independently packaged OMO-loaded extension can supply the host's existing
model registry to a task-owned Node Web backend without changing upstream code
or installing a second SDK runtime. Keep the backend outside the extension's
session-generation resource scope. Rebind it after reload; terminate it when the
owning host process exits.

The companion [refactoring plan](extension-host-refactoring-plan.md) records the
earlier, now-superseded Web-backend proposal. This fixture is not a production
implementation.

## Reproduction

Prerequisites: the project's installed dependencies, Node, Bun with builtin PTY
support, and an explicitly selected installed OMO executable. The measured
toolchain was Node `26.11.1`, Bun `1.3.14`, and OMO `5.1.48`.

```sh
OMO_LAUNCHER_PATH=/absolute/path/to/omo bun run spike:extension-host
```

`OMO_SPIKE_BUN_PATH` optionally selects the Bun executable. The runner compiles
into a disposable directory and invokes Node's test runner. It never builds into
the personal service's `dist`. The spike is deliberately outside the base/native
suite discovery and fails when its installation prerequisite is missing.

Measured launcher SHA-256:

```text
3de5125cc0a9c248b485e4ef7ffd151d0d879e9713bd5a5588a4b2ed80c6f5af
```

Measured lockfile SHA-256:

```text
b187cd61870a1533cce241b4e8661777bee8f8fe1960205d7d13fe8d65359f06
```

## Isolation and instrumentation

- A new temporary HOME, project, agent directory, package and event socket are
  created for each scenario. The host receives a replacement environment, not
  the caller's credentials or provider environment.
- The extension package has no dependencies and no `node_modules`. Its generated
  entry adapts a named fixture factory to the host's required default export.
  External runtime imports are Node builtins only; model types are erased at compilation.
- The explicit package is loaded with discovery disabled. Skills are disabled,
  model network access is offline, and the synthetic configuration disables hooks,
  codemode, memory and prompt-cache keepalive.
- A synthetic extension provider registers two models, including raw ID
  `spike-host/nested`. The model stream function and `agent_start` handler are
  tripwires: either records `inference-forbidden` and throws. No natural-language
  prompt is submitted.
- Bun's native PTY drives the actual interactive installed executable. Slash
  commands invoke the registered fixture handler, not a model. RPC mode is not
  substituted: its config watcher can intentionally operate without a reload
  action.
- Diagnostic events use a private temporary Unix socket. Waiters are installed
  before each triggering action and have bounded failure deadlines. There are no
  sleep-based readiness checks.
- The child backend binds a loopback ephemeral port. Its synthetic bearer token
  and simplified HTTP routes belong only to the fixture. It is not the production
  HTTP authorization boundary.

## Observed results

The complete final spike contains two owner-exit scenarios, each with five child
assertion groups: **12 tests including parent scenarios, 12 passed, 0 failed**.

| Experiment | Observed result | Consequence |
| --- | --- | --- |
| Dependency-free extension package loading | Factory, command, lifecycle and `pi.session.registerControlEndpoint` work in the installed OMO | No upstream extension API addition is required |
| Independent catalog comparison | The backend projection from `ctx.modelRegistry.modelRuntime.getAvailable()` equals the TUI control endpoint's complete sanitized `get_available_models` result in both directions; 2 models | Host injection can replace SDK and TUI-discovery clients |
| Full model reference preservation | `spike-host/one` and `spike-host/spike-host/nested` remain distinct full references | Do not strip provider-like segments from raw IDs |
| Explicit user-only native context | Native real/mirror verification passes with only user-scope files; quick resolves to `spike-host/one` | A project is not intrinsically required for a user-scoped report |
| Separate project native context | The project's quick override resolves to `spike-host/spike-host/nested`, without contaminating the user-only result | Scope selection must remain explicit |
| HTTP settings save | A real atomic write to temporary `settings.json` causes host `session_shutdown` and `session_start`, both with reason `reload` | Production saves must tolerate host generation replacement |
| In-process listener across reload | It is still listening during the shutdown callback, then is unreachable after the host completes reload | A session-owned HTTP server cannot provide browser continuity |
| Child backend across settings reload | Backend identity, PID, listener and unsaved draft remain; the replacement extension binds a different generation | A child backend can preserve browser state across reload |
| Command-driven `ctx.reload()` | The same child is rebound to the replacement generation | Manual reload follows the same architecture |
| Normal host quit | IPC disconnect closes the child listener; the PTY relay exits successfully | Normal host shutdown can clean up the backend |
| Host `SIGKILL` | IPC disconnect still closes the child listener and the host relay exits nonzero | Cleanup need not depend on extension shutdown callbacks |
| Inference tripwires | No inference or agent-start event is observed in either scenario | The experiment does not need model inference |

The catalog assertion compares the full sanitized projection, not merely counts.
The independent TUI query reads only the temporary endpoint's synthetic secret
and sends `get_available_models`; it neither attaches to nor opens a session.
The production design will not retain this comparison client as its source.

The user-scope experiment deliberately uses the existing
`syntheticCatalogAdapter` test wrapper to bypass the production adapter's old
TUI-only provenance requirement. Actual installed native report workers execute
and compare real/mirror configurations. This proves the loader's user-only
semantics, not the future extension provenance contract or the full application
preview/save/undo integration.

## Harness corrections during the experiment

These were harness failures, not evidence that the extension architecture failed:

1. macOS `/usr/bin/script` rejected a piped socket as its controlling input.
   Replaced it with Bun's builtin PTY.
2. The first synthetic model's 32,000-token context window was below the host's
   measured startup minimum. Increased the synthetic capacity to 200,000.
3. `/tmp` and `/private/tmp` differ textually on macOS. Canonicalized the fixture
   HOME before constructing and comparing context paths.
4. The builtin config watcher can announce readiness before this extension's
   session callback. Buffer diagnostic events until its socket is connected.
5. The host requires a default factory while repository lint requires named
   exports. A generated package-entry adapter satisfies both without disabling
   the lint rule.

The final source passes type checking, lint, isolated build and all 164 base
tests. No runtime compatibility failure was hidden by changing an existing test.

## Independent design review

A read-only architecture review confirmed that wrapping the old CLI would retain
the wrong dependency direction and that a bind-time cached catalog is not enough
for writes. The plan therefore chooses an on-demand host provider.

A separate code/plan review identified a stale-bind race: assigning a new epoch
to every authenticated bind would let an old generation supersede a replacement.
The plan now requires synchronous generation retirement, expected-epoch
compare-and-swap, idempotent duplicate bind, and explicit stale-bind/reply/unbind
acceptance tests. These are future implementation gates, not functionality
claimed for the permissive spike bridge.

## Evidence files

- `scripts/spike-extension-host.mjs`: isolated compile/run/cleanup entry.
- `test/extension-host.spike.ts`: Node assertions and explicit installation input.
- `test/extension-pty-fixture.ts`: Bun PTY relay.
- `test/extension-host-fixture.ts`: host-injected registry and lifecycle probe.
- `test/extension-backend-fixture.ts`: child listener, draft and binding probe.

## Limits and required production work

- The fixture uses only synthetic models, configuration and credentials. It does
  not certify arbitrary third-party extensions, a different OMO release or
  Linux/Windows.
- Registry equality is measured against the running host, not a promise about a
  future start, another project, scoped/favorite selections or provider health.
- The HTTP save route changes a synthetic file directly. It does not execute the
  production application's preview/save/undo pipeline or prove its post-commit
  response semantics during reload.
- The fixture caches a projected catalog at bind time. Production must query the
  current host on explicit refresh and write-check boundaries, rather than
  trusting that cached snapshot indefinitely.
- The fixture's ownership record and unconditional bind/detach are intentionally
  insufficient for production. It does not prove capability authentication,
  generation fencing, late-response rejection or backend-crash recovery.
- The backend's in-memory draft is an observation of process continuity, not
  browser DOM/SSE/token acceptance. Production desktop QA remains required.
- No personal configuration, upstream source, installed package, launchd
  service, Tailscale rule or personal service build was changed.
