# Contributing to OMO Route Panel

Maintained contract updated: 2026-10-29. This repository provides an independently
distributed extension for OMO's native TUI. Start with [README](README.md),
[DESIGN](DESIGN.md) and the [documentation index](docs/README.md).

## Toolchain and setup

Use Node `26.11.1` and Bun `1.3.14`. Node builds the extension, runs report workers
and executes compiled `node:test` suites; Bun installs dependencies and runs
package scripts. The exact Node engine requirement remains until broader
compatibility is measured. The resident agent's Bun version is not contributor
toolchain evidence.

```sh
bun install --frozen-lockfile
bun run validate:base
```

`validate:base` copies source to a clean temporary workspace, links installed
dependencies, and runs type checking, lint, build and base validation there.
It does not overwrite an existing `dist` used by a loaded extension or personal
service. Installation is separate; do not regenerate the lockfile to hide
frozen-install failures.

To build and load your checkout explicitly:

```sh
bun run build
omo -e /absolute/path/to/omo-route-panel
```

Run `/route-panel` in the interactive host. Use isolated validation rather than
building over output another process still uses.

## Architecture and boundaries

| Area | Ownership |
| --- | --- |
| `src/extension.ts` | Host command, current registry, installation binding and reload lifecycle |
| `src/tui.ts`, `src/tui-contract.ts` | Terminal interaction and typed in-process controller contract |
| `src/editor.ts` | One temporary user-native-file transaction and Apply orchestration |
| `src/config.ts`, `src/undo.ts` | JSONC node edits, locking, atomic replacement and durable last-save undo |
| `src/native/`, `src/runtime.ts` | Native reports, installation discovery, structural checks and real/mirror equivalence |
| `src/background.ts`, `src/background-evidence.ts` | Effective background display and installation-bound source evidence |
| `src/presentation.ts` | Recommendation, override and effective route presentation |

Native `modelChains` and `configDoctorLines` are the routing oracle; do not
implement another router. Read available models from the current host registry,
including loaded extension providers. Preserve complete `provider/rawModelId`
references. Registry availability is not inference health.

User scope is the default. Current project changes interpretation, never the
write target. Only supported user-native routing fields may be edited; host
Settings, Diagnostics, compaction and session management stay outside the panel.
Do not add an HTTP bridge, browser, catalog polling or another SDK runtime.

Accepted edits share one temporary buffer. Explicit Apply rechecks dependencies,
preserves comments and unrelated nodes, and rejects external conflicts. Do not
describe the file lock as atomic compare-and-swap against unrelated editors.
Close, reload and shutdown retire unapplied buffers. Undo stores only the minimum
last-Apply information, not persistent drafts or full configuration backups.
See the [API](docs/api.md), [native](docs/native-contract.md),
[registry](docs/metadata-contract.md) and [background](docs/background-semantics.md)
contracts before changing these boundaries.

## Validation

```sh
bun run validate:base
bun run check:docs
bun run test:packaging
bun run pack
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run validate:native
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run test:tui
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run test:package-host
```

- **Base:** synthetic configurations and temporary HOME directories; no installed
  OMO or personal credentials are required. Direct `test:base` / `test` commands
  run compiled tests and therefore require a preceding build.
- **Packaging:** verify the actual tarball and clean npm/Bun runtime installs.
  `test:package-host` also exercises the packed extension inside a real OMO host.
  `pack` builds isolated source into `artifacts/*.tgz`; `prepare:host` fetches
  the checksum-verified macOS OMO `5.1.51` host fixture into a temporary
  directory when needed. Use the [release guide](docs/releasing.md) for the
  stage-only `release.yml` workflow (`bun run release:stage`, OIDC staging and
  interactive 2FA approval) and [first public release status](docs/first-public-release.md)
  for public repository and CI rollout records.
- **Documentation:** `check:docs` checks relative Markdown targets and public
  home-path leaks without pinning prose. Keep current contracts and archived
  evidence clearly separated.
- **Native:** explicitly supply the OMO launcher. `.native.test.ts` tests exercise
  installed native reports; missing prerequisites fail rather than silently
  skipping. `OMO_NODE_PATH` may select the native-test Node executable.
- **TUI:** `test:tui` creates disposable compiled output and drives the production
  extension in an actual host PTY, with temporary HOME, synthetic providers and
  inference/agent-turn tripwires. It requires the launcher and does not submit
  model prompts. `TUI_COLS`, `TUI_ROWS` and `TUI_THEME` select acceptance dimensions;
  `OMO_TUI_EVIDENCE_DIR` retains sanitized captures.

Run the checks relevant to a change and report exact commands, versions and
results. Native failures can indicate installation or source-evidence drift;
keep the failure visible and distinguish it from base or packaging results.
Dated counts in the [archive](docs/archive/README.md) are not a fresh check.

Keep implementation and direct regressions together. Retain JSONC safety,
native-report, background, conflict, lifecycle and undo assertions. Tests must
subscribe to the exact event before triggering asynchronous behavior and use
bounded deadlines, not fixed sleeps or timing luck. Use synthetic credentials
and temporary files, clean up all children and sockets, and never read personal
auth files or send inference probes. Do not add prose-pinning documentation tests.

For visible changes, inspect real-host light/dark output at `120x40`, `70x24`,
`40x12` and the `18x8` safety fallback. Exercise search, candidate acceptance,
combined Changes, Apply, discard, conflicts, reload and undo. Confirm complete
IDs remain inspectable, required actions stay reachable and boundaries separate
the extension from host transcript/footer text. Record observed evidence
separately from requirements.

## Package and dependency policy

The published package ships precompiled `dist/src` and `dist/extension`, with
`pi.extensions` pointing to the generated default-export wrapper. Ordinary users
do not need a compiler or install hook. `jsonc-parser` is the sole runtime
dependency. `@earendil-works/pi-tui` is a host-provided peer with range `"*"` and
optional peer metadata, so ordinary installs do not fetch a second TUI. The pinned
development alias supplies compile/test types only; never ship development
`node_modules` or bundle an OMO runtime.

The project uses MIT. Check dependency terms and packaged contents when changing
distribution; do not infer rights to unrelated upstream code from a package
manifest. Make no changes to upstream installations to implement this extension.
The public repository starts from a clean tracked snapshot on `main`, while the
earlier 45-commit private development history is preserved outside the public
lineage without rewriting or force-pushing that local archive. Automated agents
must never collect npm passwords, OTPs, recovery codes or tokens; a maintainer
completes interactive login and 2FA prompts directly in their browser or CLI.

## Issues and pull requests

Use the [issue tracker](https://github.com/GodCC6/omo-route-panel/issues) for
non-sensitive bugs and focused proposals. Include extension and OMO versions,
Node/Bun versions, platform, terminal size/theme, expected versus observed
behavior and a minimal synthetic reproduction. Never attach personal
configuration, auth files, private hostnames or session transcripts. Follow
[SECURITY](SECURITY.md) for vulnerabilities.

A pull request should explain the behavior changed, relevant boundaries and
verification performed. Keep unrelated cleanup separate. UI text, maintained
documentation, diagnostics, comments, tests and synthetic prose are English;
README has complete English then complete Simplified Chinese sections. Preserve
user-supplied names, keys, IDs and values verbatim.
