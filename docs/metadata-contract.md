# Host Model Registry Contract

Maintained contract updated: 2026-10-29. The extension reads the current OMO
host's authoritative `ctx.modelRegistry.modelRuntime.getAvailable()` set,
including loaded extension providers. The
[former SDK/control-endpoint contract](archive/web/metadata-contract.md) is
historical; it is not another supported catalog path.

## Source and freshness

The host supplies availability directly through the structural extension seam.
Do not construct an SDK model runtime, query another host's control endpoint,
start a producer, aggregate hosts or poll on a timer. Registry assembly context
is separate from User/Current project routing interpretation.

Read on demand and recheck the host/catalog dependencies before Apply. The host
generation and installation must remain valid. Failed reads are explicit
failures, never an empty available-model set or a fallback to static SDK model
definitions.

The set describes this host's loaded availability only. It does not establish
provider health, quota, inference reachability, session scopes/favorites,
another project's registry or a future host's loaded extensions. Inspection
never creates, attaches to or changes a session and never sends model probes.

## Sanitization and complete references

`src/native/catalog.ts` retains allowlisted model metadata: `provider`, `id`,
`name`, `reasoning`, `input`, `contextWindow`, `maxTokens` and supported cost
fields. Unknown properties, URLs, headers, credentials and raw transport errors
are not public presentation data.

Form complete references strictly as `provider + "/" + id`. Preserve raw IDs,
including nested provider-like segments; do not normalize away a prefix.
Catalog membership validation, searching and persistence use complete references.
Compact main rows may ellipsize, but scrollable child views keep full references
inspectable.

`catalogSnapshot` produces deterministic sanitized catalog revisions rather than
using capture time as identity. Native resolution uses that catalog for effective,
clean-default and proposed comparisons; no separate catalog producer may alter
the available set.

## Distribution boundary

The package has no Senpi SDK dependency. `jsonc-parser` is the sole runtime
dependency. Terminal helpers use the host peer `@earendil-works/pi-tui` with
range `"*"` and optional peer metadata; the pinned development alias is not a
runtime catalog producer and must not ship as a second TUI. See the
[release guide](releasing.md) for actual tarball/install validation.

See the [extension API](api.md), [native adaptation](native-contract.md) and
[security policy](../SECURITY.md) for adjacent contracts.
