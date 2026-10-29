# OMO-Hosted Extension Refactoring Plan

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Date: 2026-10-28.
Status: superseded as an execution plan on 2026-10-28 by the
[native TUI product requirements baseline](../native/tui-product-requirements-v1.1.md).
The Web-backend proposal below is preserved as historical design context, grounded
in the completed [extension-host spike](extension-host-spike-2026-10-28.md).
It has not been implemented and must not be executed unchanged.

The current direction is an English-only native TUI with multiple editable items
per file, a temporary editor buffer, integrated change inspection and unified
Apply/Cancel. Web services, private backend bridges, persistent drafts and an
independent Review step are not product requirements. A new implementation plan
must be derived from the TUI baseline and focused interaction evidence.

## 1. Outcome and decisions

Make OMO Route Panel an independently distributed extension loaded by OMO.
OMO owns its model runtime; this project owns its configuration application,
browser UI and supervised Node backend.

The user can open the panel without selecting a project. The initial view edits
and explains user-scope configuration. A project is an optional resolution
context, not the server's identity or startup prerequisite.

Adopt these decisions:

1. Make no upstream edits. Install a separate extension package; never add files
   to the installed OMO plugin's generated directories.
2. Do not install or construct a second Senpi/OMO runtime. Remove the production
   SDK dependency and internal SDK imports, rather than bumping their version.
3. Obtain model availability from the host's existing model runtime, through
   extension context injection. Remove production TUI endpoint discovery and
   control-secret reading.
4. Run the existing Web application in a task-owned Node child. Keep its lifetime
   tied to the host process, not the extension session generation.
5. Use on-demand catalog requests over a private host bridge, with invalidation
   notifications. Do not make a bind-time push snapshot the freshness authority.
6. Keep native reports as the only routing oracle, including user-only and
   project-context real/mirror verification.
7. Preserve read-only default, explicit preview, one-group save, node-level edits,
   journal, undo and all HTTP access checks.
8. Keep one backend per owning OMO process for the first implementation. Do not
   aggregate catalogs across hosts or provide a global daemon.

An OMO process must be running because the product is its extension. This is an
explicit host relationship, not a claim of standalone operation or a dependency
on locating some unrelated TUI.

## 2. What the spike settles

The measured installation supports extension commands, an injected runtime,
normal and settings-triggered reload, and a child IPC channel that outlives
extension reload but closes on normal exit and SIGKILL. The child preserves its
listener and draft state; a session-owned HTTP listener is reclaimed.

User-only native reports can exclude project overrides. Internally, use the
canonical HOME as the native loader's explicit user-only evaluation directory,
and the mirror HOME for its mirror. This is an implementation of a named
`user` scope, not an implicit project selected from the panel's cwd.

The spike does not establish production bridge authentication, out-of-order
generation safety, full save/undo races, UI continuity or package installation
commands. Those are acceptance work below, not prerequisites for upstream edits.

## 3. Composition and ownership

```text
OMO process
  -> separate route-panel extension package
       -> /route-panel command and host-generation binding
       -> existing host modelRuntime (no constructor/imported runtime copy)
       -> supervised Node backend
            -> private host capability bridge
            -> configuration application and native report workers
            -> authenticated HTTP/SSE server and existing browser UI
```

### Extension

Register `/route-panel` with optional `--edit`. No arguments opens the user-scope
view read-only. A later explicit edit invocation may enable writes for that
backend; it must never downgrade another active transaction silently.

The factory registers capabilities and handlers only. Do not open listeners or
start children from the factory, since factories can run in no-session CLI
invocations. Start the backend on the command. On later session starts, rebind
an already-owned backend but do not launch one just because OMO starts.

The extension exposes host identity, agent directory, current host context and
allowlisted catalog data. It does not perform configuration transactions or pass
auth, provider headers, URLs, session histories or raw runtime objects downstream.
Use host-supplied APIs or type-only development imports; do not bundle an SDK.

### Node backend

Extract CLI composition into a reusable backend entry. The extension launches
that entry directly, not the old CLI with its TUI catalog provider.

Keep a real Node executable for permission-restricted native report workers.
The compiled host's `process.execPath` is not a Node executable. Support an
explicit Node path in extension configuration and retain capability probing.
Do not execute an executable path supplied by a browser.

Reuse the existing application, native report workers and HTTP implementation.
Do not introduce a frontend framework, another model router or a second service
manager.

### Host installation identity

Provide the host PID and executable identity through the private bridge.
Retain the installed-launcher/report binding and mapped-file checks already used
by the repository; move reusable identity code out of TUI-specific modules.
On macOS, compare actual mapped device/inode identity as well as disk digest.

The report installation must match the running host and the selected active
installation. An upgrade that replaces the binary or report artifacts makes the
old binding stale and blocks writes; do not import reports from a different
installation merely because its version string looks compatible.

## 4. Private bridge contract

Separate browser access from host control. The browser bearer token must never
authorize bridge bind, catalog replies, executable selection or owner adoption.

Use a backend-owned private Unix control socket and an atomically published
capability descriptor in a same-user 0700 per-host directory. The descriptor is
0600 and contains the backend instance identity, random control capability and
owner process identity. The extension reads only this project's own descriptor.
Do not use a PID/port file alone as adoption authority.

On initial launch, bootstrap the random capability through inherited IPC, not
argv or logs. The inherited channel also supplies the process-lifetime lease
observed by the spike. The descriptor enables a replacement extension generation
to open a new control connection without relying on module-cache behavior.
Validate owner PID plus process start identity, backend instance and a
capability-authenticated challenge before adoption. Refuse stale descriptors;
never kill or reuse an unrelated process found on a port.

Use a bounded JSONL protocol with a version and request ID. Define these messages:

- `bind`: authenticated owner and context declaration; the backend assigns a
  monotonically increasing binding epoch.
- `catalog.request` / `catalog.response`: request the current host runtime's
  `getAvailable()` result, projected to the existing model allowlist.
- `catalog.invalidated`: retire freshness and previews without a timer poll.
- `unbind`: retire only the named current binding epoch.
- `shutdown`: close the backend only for the authenticated owning process.

Every request/reply names protocol version, host instance, backend instance and
binding epoch. A late reply, stale unbind or closed generation must never replace
or clear a newer binding. Outstanding catalog requests fail on detach, timeout
or cancellation. Unknown protocol versions fail with a specific diagnostic.

Set a generation's local `retired` flag synchronously at the start of shutdown,
before awaiting detach or any other work. Retired code cannot initiate a new
bind or answer a catalog request. Bind uses compare-and-swap against the expected
previous epoch; a duplicate bind for the same generation is idempotent, not a
fresh epoch. An old request arriving late cannot supersede a newer accepted
generation simply by asking the backend to assign another epoch.

The backend state machine is:

```text
unbound -> bound(epoch N) -> detached/stale -> bound(epoch N+1)
                            |
                       owner exit -> closed
```

During detach, retain displayable previous models and browser drafts but expire
previews and reject writes. A new authenticated binding does not relabel a
previous snapshot fresh: obtain and verify a new catalog first.

Keep fixture-only bind-time caching and permissive ownership code out of
production. Bootstrap/adoption, missing-Node and backend-crash failures need
actionable diagnostics; a subsequent explicit command can restart a lost backend.
No automatic restart loop or periodic catalog polling is required.

## 5. Scope, catalog provenance and freshness

Represent configuration scope separately from host catalog provenance:

```text
resolutionContext:
  { scope: "user", profile: string | null }
  | { scope: "project", project: canonicalPath, profile: string | null }

catalogSource:
  { kind: "extension", coverage: "host-registry",
    hostInstance, bindingEpoch, installationIdentity,
    agentDir, hostContext, inputRevision }
```

These are internal contract sketches, not fields already shipped by the API.
Publish only a sanitized host/source identity and scope metadata. Do not expose
capabilities, socket paths, PIDs, executable paths or credential paths.

Expose an authenticated `POST /api/context` for explicit scope/profile selection.
Accept only the discriminated context fields above, validate/canonicalize project
paths inside the existing HOME boundary, and reuse config-directory safety
checks. HOME, runtime modules and executable paths remain server-owned.
Serialize context changes with application transactions; reject a change while
a save is in progress. Ship the changed context/source/save-response contract as
snapshot schema version 2, with its browser consumer updated in the same release.

- User scope loads user configuration only and applies no project identity
  override. Explain values as user-scope results evaluated against this host's
  registry, not as universal effective values for every project. Pass an explicit
  absent project identity to background semantics; never derive an identity from
  HOME merely because HOME is the native loader's user-only evaluation directory.
  Show verified user-scope values, not fabricated unknown/disabled placeholders.
- Project scope includes the existing canonical ancestor discovery and optional
  profile. Preserve current filesystem safety boundaries. Scope/profile changes
  invalidate previews and native snapshots, not the shared host registry itself.
- The host context records where the registry was assembled. It is not an
  equality requirement for opening the panel or editing user files.
- A different project can change extension registration. A projection for that
  project using this host's catalog is conditional on that catalog; do not label
  it proof of what a fresh host in that project will load.
- Do not use current session model, scopes or favorites to narrow the new-task
  registry, or claim future-start/provider-health equivalence.
- On explicit catalog refresh and each existing write-check boundary, ask the
  currently bound host for availability. Preserve deterministic full-model and
  provenance revisions, stat-only dependency invalidation and cancellation.
- No project selection is required to compute a verified user-scope native
  report, preview user-file edits, save or undo. Keep the existing fresh-catalog
  and native-verification requirements in that user-scope context.

`CatalogSource`, public `Snapshot.context/catalog.source`, application startup,
native `inspect/resolve`, source verification and stale reuse all need this
change. Merely making the CLI argument optional is insufficient.
Split dependency observation accordingly: catalog inputs follow the host's
agent directory and host assembly context; native-resolution inputs follow the
selected user/project scope. Do not invalidate or relabel host provenance merely
because a different resolution project was selected.

## 6. Transactions and reload races

Keep preview, per-request verification, `beforeCommit`, source revision checks,
single-writer locking, node-level journaling and single-group save together.
The private bridge is a catalog provider, not a configuration writer.

Fence each preview by its scope/profile, host/backend identity, binding epoch,
catalog revision and file revisions. Any detach, scope change or generation
replacement expires it. Keep unsaved drafts, including drafts for the other
file group.

A settings write can trigger reload before post-save catalog refresh completes.
Treat filesystem commit and host resynchronization as separate outcomes:

1. Before commit, any lost binding or changed revision prevents the write.
2. Once commit succeeds, retain its minimal journal and a receipt keyed to the
   preview ID in the surviving backend.
3. Return an explicit committed result plus the snapshot and host synchronization
   state (`current`, `reloading` or `unavailable`).
4. A post-commit reload cannot turn a completed write into an ambiguous
   retryable "save failed" response.
5. Repeating that preview ID returns its existing receipt, never applies the
   edit twice. Do not blindly retry after a backend crash or lost receipt;
   re-read the file revision and journal.
6. After rebind, rebuild freshness before enabling a new preview. Undo still
   requires a newly verified reverse preview and explicit confirmation.

Update the shared response type, HTTP route, browser save handling and API
documentation together. Preserve Host, Origin, bearer and remote-identity checks,
explicit asset allowlisting and safe error projection.

## 7. Delivery increments

Each increment is separately verified and committed. Do not deploy partial
production modes or mark an increment complete with a placeholder.

| Increment | Changes | Acceptance |
| --- | --- | --- |
| A. Scope/source contracts | `src/native/types.ts`, `src/types.ts`, `src/catalog-source.ts`, `src/native/index.ts`, `src/background.ts`, application context inputs | User/project contexts are distinct; synthetic extension sources can be verified without fake TUI endpoints; user-only and project real/mirror reports pass; user scope does not invent a HOME-derived identity |
| B. Host bridge and supervisor | New extension entry, private bridge modules and backend entry; extract composition from `src/cli.ts`; reuse identity helpers in `src/runtime.ts` | Dependency-free host loading; capability bootstrap/adoption; late bind/reply/unbind tests; one backend per host; explicit Node validation |
| C. Catalog cutover | Inject on-demand host provider into `src/app.ts`; replace production `metadata*.ts`, `catalog-endpoint.ts`, `catalog-rpc.ts` and TUI-only discovery portions of `catalog-process.ts` | Full sanitized model-set equality; dynamic provider refresh appears; all write-check boundaries use the current binding; detached state stays stale/unknown; no production control-secret read |
| D. User-scope application and save receipts | `src/app.ts`, native context adapters, HTTP/shared response contracts, config transaction integration tests | Open/preview/save/undo without project selection; optional project overlay is separate; pre-commit detach prevents writes; post-commit reload returns committed receipt; old preview cannot commit |
| E. Browser continuity | `src/web/app.ts`, typed messages and source/context views | English default and Chinese support; scope switch and reload retain drafts/focus; committed group clears once; SSE/token remain stable during host reload; no catalog polling |
| F. Packaging/dependency and documentation cutover | `package.json`, frozen lockfile, build asset allowlist, README, CONTRIBUTING, SECURITY and current API/native/metadata contracts; legacy service instructions | Published extension entry is loadable from a separate local package; no Senpi runtime dependency or internal deep import; no required project CLI argument; no wrapper that restores old TUI discovery |
| G. Release acceptance | Existing base/native suites, hardened host-spike scenarios, desktop QA and migration evidence | Every gate below passes against the explicitly selected installed OMO |

Remove obsolete SDK shape/fingerprint tests and replace them with behavioral
bridge/source tests. Keep genuine native-report tests and installation-independent
tests. Preserve historical documents as dated evidence; update active contracts
to say the old TUI catalog design is retired.

Test fixtures remain validation infrastructure, not a public demo mode.

## 8. Acceptance gates

### Automated and real-host behavior

- Run `bun run check`, `bun run lint` and clean isolated build/base validation.
- Run the native suite with an explicit installation.
- Promote the spike into production-bridge integration tests after cutover.
  Require complete equality with the same host's authoritative catalog, including
  a dynamically registered provider and provider-like raw model IDs.
- Test missing host, missing/unsupported Node, failed backend startup, duplicate
  command, stale descriptor, backend crash, disconnect and aborted catalog call.
- Test out-of-order replies, stale bind arriving after a replacement bind,
  expected-epoch compare-and-swap failure, old-epoch unbind after new bind,
  duplicate bind and code continuing after its generation has retired. None may
  mutate the newer binding. Test a reload between every
  preview/precommit/postcommit boundary.
- Assert normal quit and SIGKILL leave no listener or child. Keep explicit
  idempotent cleanup and the process-lifetime lease.
- Exercise actual production preview/save/undo HTTP routes, not the fixture's
  direct settings writer. A committed save must remain identifiable through
  settings-triggered reload.
- Verify both user-only and optional project scopes, including profile changes,
  ancestor precedence and cross-context old-preview rejection.
- Check every existing HTTP access boundary, safe public provenance, stat-only
  credential dependency observation and absence of raw secret/error projection.
- Use synthetic HOME/config/providers and event subscriptions with deadlines.
  No inference prompts, arbitrary inspection sessions or timing sleeps.

### Desktop behavior

Test 1280/1440/1920 widths, both languages and themes, keyboard focus and 200%
zoom. Keep a real browser open while saving settings and issuing `/reload`.
Observe the same backend URL/token/SSE connection, retained unrelated drafts,
correct committed-group clearing and expired old previews.

### Dependency and distribution

Verify the production installed package with a frozen lockfile and no full
Senpi package in its dependency closure. The development type toolchain is not a
runtime catalog producer. Host-core packages, if referenced, must be external
host capabilities rather than bundled or automatically installed runtime peers.

Install the built extension package through the actual supported host package
mechanism in an isolated HOME. A direct `-e` package load, which the spike proves,
is not evidence that every branded installer command has been tested.

## 9. Operations, rollout and exclusions

The first production extension uses an ephemeral loopback port by default.
An explicitly configured fixed/Tailscale port must report a conflict rather than
adopting an unrelated service. Keep remote identity checks and configuration;
never rewrite Tailscale rules as ordinary validation.

Retire independent launchd startup from the supported extension architecture.
Do not silently uninstall or stop the existing personal service. Deployment
requires a deliberate handoff: build and validate the extension, stop the old
service, enable the new extension and verify real assets/access behavior. Keep
the old build/service definition available for a controlled rollback; do not run
both as competing owners of the same fixed port.

This plan does not authorize that handoff, upstream modifications, publication,
credential access, routing-algorithm duplication, a global multi-host daemon,
new model inference probes or a broad UI/framework rewrite.
