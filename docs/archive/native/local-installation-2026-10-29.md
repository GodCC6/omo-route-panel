# Local OMO extension installation

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Installation event: 2026-10-29T07:12:37Z.
Verification date: 2026-10-29.
Status: installed; direct-directory and configured-entry acceptance passed.

Subsequent update: the stable entry was switched to the boundary improvement
`d616315` on 2026-10-29T07:52:12Z. See
[the boundary verification and installation record](tui-boundaries-2026-10-29.md).
The installation below remains the historical `cc301c1` deployment record.

The user explicitly requested installation of the completed compact routing
editor into local OMO. This is a local installation, not public distribution.

## Installed paths

| Item | Value |
| --- | --- |
| Source revision | `cc301c196b3c9c044269758828f7f0bc0dacdfda` |
| Fresh production directory | `~/.local/share/omo-route-panel/cc301c1` |
| Existing configured loading entry | `~/.local/share/omo-route-panel/9107f85` |
| Loading entry after activation | Symlink to the fresh production directory |
| Previous installation retained | `~/.local/share/omo-route-panel/9107f85.backup-20261029T071237Z` |
| Installed OMO | `5.1.51` |
| Build/test Node | `26.11.1` |
| Production dependency installer | Bun `1.3.14` |

The original configured entry was confirmed through OMO's read-only
`list --no-approve` command before and after activation. Only the matching
panel-path confirmation was emitted; other personal configuration was not
printed. Personal settings did not need modification.

## Build and production dependencies

TypeScript compiled into an isolated temporary directory, followed by the
repository's generated extension entry. The workspace's existing `dist` was
not overwritten. Only `dist/src`, `dist/extension`, `package.json` and
`bun.lock` were copied into the fresh production directory.

Production dependencies were installed with:

```sh
bun install --frozen-lockfile --production --omit=peer --ignore-scripts
```

The dependency installation used a temporary HOME. The resulting `node_modules`
contains only `jsonc-parser`; no development dependencies or second TUI runtime
were copied. `@earendil-works/pi-tui` remains a host peer with range `"*"`.
Both installed compiled trees were compared with the isolated build output and
matched exactly.

## Installed-copy acceptance

A scratch copy of the source revision's real-host acceptance fixture imported
the installed `dist/extension/index.js` default factory instead of importing
the repository source factory. The host, registry, input and reload lifecycle
remained the real installed OMO.

The direct production-directory run passed the complete acceptance test:
search and CJK/raw-ID paste, local candidate editing and reasoning, two custom
categories, duplicate protection, ordering, all comparison views, profile and
background fields, discard, host reload cancellation, combined native Apply,
pre-reload save notification, Undo, catalog conflict, reload failure and pasted
command-name safety. The test used synthetic providers and temporary HOME
directories, with inference and agent-turn tripwires.

The same complete test also passed through the configured stable entry after
activation, with zero failures. Its actual first viewport is
`Routing  User  [Routes] Background`, confirming the compact two-section build.
The configured entry's compiled trees still match the isolated release output.

Evidence:

- `/tmp/omo-installed-cc301c1-proof`: direct fresh-directory acceptance.
- `/tmp/omo-installed-cc301c1-stable-proof`: configured stable-entry acceptance.

The known background recorded-source-contract mismatch in OMO `5.1.51` remains
as documented in the [implementation evidence](tui-redesign-implementation-2026-10-29.md).
Installation does not replace that evidence with guessed semantics.

## Activation and recovery

The old production directory was renamed to its dated backup, then the existing
loading entry was replaced with a symlink to the verified fresh directory.
New host loads resolve the configured path to the new build. An already running
host can retain previously imported JavaScript until its normal extension
reload or next launch; no active personal session was forcibly restarted.

The previous directory remains intact for rollback. The older
`9107f85.backup-20261028T235234` backup also remains intact. No upstream files,
credentials, route declarations, personal service or DNS state were changed.
