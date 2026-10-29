# Historical api contract

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

## Historical Web API contract (retired 2026-10-28)

The remainder preserves the previous server/browser contract as historical
reference. Its endpoints, capability state machine, bilingual presentation,
preview tokens and server-process undo lifetime are not current interfaces.

### Former frontend and backend API

`src/types.ts` defines the shared data contract between the server and browser. The server exposes a same-origin HTTP API only. Every API request requires `Authorization: Bearer <ephemeral token>`. In local mode, the browser reads the token from the startup URL fragment into memory and immediately strips the fragment from the address bar; in Tailscale HTTPS mode, the browser bootstraps an in-memory token from `/api/session`. Responses are JSON, and failures return the sanitized `ApiError` shape without exposing raw internal exceptions.

## Endpoints

- `GET /api/session`: Used in Tailscale HTTPS mode to exchange verified proxy identity headers for an in-memory bearer token.
- `GET /api/snapshot`: Returns the current `Snapshot` without triggering a catalog refresh.
- `POST /api/refresh`: Request body `{ "target": "config" | "catalog" }`; returns an updated `Snapshot`. Only an explicit `catalog` refresh (or a completed `save`) reacquires a changed catalog source after invalidation.
- `POST /api/preview`: Request body `{ "snapshotId": "...", "group": "native" | "settings", "operations": Operation[] }`; re-verifies the live TUI catalog and configuration baseline before returning a `Preview`.
- `POST /api/save`: Request body `{ "previewId": "..." }`; re-verifies the live TUI catalog (`beforeCommit`) and file revisions, writes the previewed group, refreshes the catalog, and returns a new `Snapshot`.
- `POST /api/undo`: Request body `{ "action": "preview" }`; re-verifies the live TUI catalog and target file before returning a reverse `Preview` for the most recent panel save, which must still be explicitly committed via `/api/save`.
- `GET /api/events`: Reads Server-Sent Events (SSE) over an authenticated `fetch` stream. `event: invalidated` signals an external configuration, runtime, or catalog dependency change. Its data is `{}` for generic invalidation or `{ "catalogStatus": "stale" | "unknown" }` for catalog invalidation. The browser retains drafts, invalidates previews, updates the catalog badge, and offers the appropriate catalog refresh. Neither the browser nor the server polls the model catalog on a timer.

## Capability & Eligibility States

Per P2 of the [archived open-source refactoring plan](open-source-refactoring-plan.md) (updated 2026-10-27 for live TUI catalog queries), the API and UI represent capability states independently rather than coupling catalog lookup or diagnostics to write eligibility:

- **Native routing state**: Whether native report discovery, shape validation, and real/mirror equivalence succeeded for the current snapshot.
- **Catalog state**: `fresh`, `stale`, or `unknown`. The catalog comes from a read-only control query (`get_protocol_info`, `list_sessions`, `get_available_models`) to an existing same-user, matching-project running TUI whose executable digest matches the active launcher. If zero matching endpoints are available, the previous catalog is retained as `stale` (only when launcher digest and project still match) or remains `unknown` initially, and writes are blocked; if multiple matching endpoints return different sanitized model lists, the query fails with a conflict error. An `unknown` catalog never fabricates an empty catalog, and the server never falls back to standalone SDK model definitions or auto-starts a TUI/host.
- **Restricted public catalog source**: When present, `snapshot.catalog.source` exposes only `{ kind: "tui", coverage: "running-tui", project, launcherDigest, inputRevision, instances: string[] }`. Socket paths, process IDs, credential file paths, and raw worker errors are never included in API responses. `coverage: "running-tui"` reflects only the running TUI's loaded registry (including loaded extension providers), not future fresh-start behavior, remote provider health, session scopes/favorites, or unapplied config edits.
- **Background semantic state**: Whether background-task default and override rules are verified against the installed runtime artifacts or marked `unknown` on artifact change.
- **Write eligibility & per-request catalog verification**: Preview, save (including `beforeCommit`), and undo require `editMode: true`, a verified native routing snapshot, a `fresh` live TUI catalog, and matching snapshot, file, and catalog revisions. Each write-path request re-queries the live TUI catalog; if the catalog source, endpoint set, or watched input revision (`auth.json`, `models.json`, `models-store.json`, settings files, `credential-pool-state.json`, `trust.json`) changed, the server invalidates cached previews and rejects the request with `409` (`code: "catalog-changed"`). UI-disabled buttons are mirrored by server-side enforcement.

## Fields & Operations

`fields` keys use `native:memory.recall.enabled`, `native:model_profile`, `settings:defaultProvider`, and related allowlisted identifiers. Their values reflect only the explicit fields present in the target global file rather than claiming to represent the full merged configuration hierarchy.

- **Allowlisted Native memory fields**: `memory.recall.enabled`, `memory.recall.category`, `memory.reflection.enabled`, `memory.reflection.category`, `memory.facts.enabled`, `memory.facts.model`, and `memory.dream.enabled`.
- **Allowlisted Native profile field**: `model_profile`.
- **Allowlisted Settings fields**: `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, and `compaction.model`.

`background` and `fields` have distinct semantics: `background` describes the effective new-task configuration after combining built-in memory defaults, merged config layers, and new-task identity overrides:

- `stateSource` explains the basis for each effective switch (built-in default, merged configuration, identity override, or unverified).
- `modelStrategy` distinguishes category binding, dynamic fork, explicit model, session inheritance, local processing, helper invocation, and unverified state.
- `candidates` lists the candidate chain from the verified `NativeReport`, not an active runtime call log.
- Dream shares the Reflection category. Facts keeps only user-configured `quick` candidates when falling back to `quick`, excluding built-in items appended by the native loader.
- When native resolution fails, background semantic artifacts do not match, or an unattributable git/session identity override exists, affected background fields report `unknown`. Catalog lookup failures never mark background switches disabled.
- Compaction, lexical search/projection, and helper completion do not share a memory-task switch and are reported as on-demand policies.

## Route Comparisons, Previews & Model IDs

- Creating a custom category uses `set-chain`. Each candidate `model` must be a full `provider/modelId` string, and `reasoning` accepts only verified canonical levels (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `auto`).
- Removing a route override uses `remove-override`; removing a scalar field override uses `remove-field`.
- Each preview and save targets a single group (`native` or `settings`). Saving one group invalidates existing previews for the other group while keeping unsaved drafts intact. Conflict errors (`409`) also preserve drafts.
- The route table's comparison columns come from the native baseline (`defaults`), current-layer inspection, and native effective resolution (`effective`). Source `evidence` stays conservative and never guesses file origin merely from value equality.
- `defaults` holds the upstream recommendation ladder, while `defaultEffective` holds the filtered `runtime[]` chain resolved under a clean default context with the same catalog. The "effective differs from default" filter compares `effective` against `defaultEffective`, not against the unfiltered recommendation ladder.
- `effective` contains only the runnable `runtime[]` chain, while `ladder` retains every rung, its status, and provider evidence. When the native report does not supply an effective reasoning value, reasoning remains unknown rather than inferred from local config text.
- A `native` group preview also includes `headless.before` and `headless.after` to show changes in native `model_profile` resolution. Route diffs list only added, removed, or changed targets so unchanged routes do not clutter review. When a preview finishes loading, keyboard focus moves to the preview diff heading rather than the Save or Confirm Undo button.
- For bilingual UI rendering (P4), application-owned explanations, draft descriptions, preview invalidation reasons, and error messages carry stable message identifiers and parameters (or derive from structured operation data) so switching between English and Simplified Chinese updates explanations in place without re-running `/api/preview` or `/api/snapshot`.
- `CatalogModel.id` is always the raw SDK model ID. Full references are formed strictly by concatenating `provider + "/" + id`; even if `id` starts with text matching the provider name, the prefix is never stripped. TUI `defaultModel` saves the raw `id` verbatim.
