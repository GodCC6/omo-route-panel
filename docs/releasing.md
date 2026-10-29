# Releasing and npm distribution

Maintained procedure updated: 2026-10-29.
Package: `omo-route-panel`. Source repository:
[`GodCC6/omo-route-panel`](https://github.com/GodCC6/omo-route-panel).
Version `0.1.0` is a release candidate and remains unavailable for normal
installation until a staged release is explicitly approved. See the dated
[readiness evidence](open-source-readiness.md) for local verification and
[first public release status](first-public-release.md) for source publication,
CI and registry rollout records.

## Distribution contract

- OMO loads `pi.extensions` from the package manifest. The shipped entry
  `dist/extension/index.js` default-exports the production factory.
- The npm allowlist contains compiled `dist/src/**/*.js`,
  `dist/extension/**/*.js`, README, changelog, license and third-party notices.
  Tests, source TypeScript, scripts, archives, local agent state, lockfiles,
  credentials, `node_modules` and a second OMO runtime are not shipped.
- `jsonc-parser` is the sole runtime dependency. The terminal package is an
  optional `"*"` peer supplied by OMO, not a dependency to install or bundle.
- The tarball needs no build or install script when consumed. OMO's own package
  manager still has its normal installation prerequisites. Do not broaden the
  exact Node engine or OMO compatibility claims without measurements.
- MIT covers this project's original work. Review
  [third-party notices](../THIRD_PARTY_NOTICES.md) when dependencies or host
  integration change; it is not a blanket license for the OMO runtime.

## Local release-candidate verification

Use Node `26.11.1` and Bun `1.3.14`:

```sh
bun install --frozen-lockfile
bun run check:docs
bun run validate:base
bun run test:packaging
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run validate:native
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run test:tui
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run test:package-host
```

`test:packaging` builds a fresh source copy, packs it with npm's actual
file-selection rules, and installs that tarball into empty npm and Bun
consumers with temporary HOME/cache directories. It verifies all required
release files, working JSONC support, and absence of a second TUI or development
tools. It does not need npm authentication or a published package.

`test:package-host` repeats both consumer installations and drives each packed
factory in the real supplied OMO host. It exercises search and paste, candidate
editing/reordering/reasoning, background/profile changes, inspection, Apply,
discard, catalog conflict, reload failure and durable undo. All configuration is
synthetic and inference/agent turns are forbidden.

`prepare:host` is an optional account-free acquisition path for the reviewed
macOS arm64/x64 OMO `5.1.51` release assets. It checks the SHA-256 values in
`scripts/host-fixture.json` before running `--version` in a new temporary HOME.
It prints `OMO_LAUNCHER_PATH` and its owned temporary directory; on GitHub Actions
it writes those values to `GITHUB_ENV`. It does not install into your personal
HOME or configure your OMO. Remove only that generated directory when finished.
Update the fixture version/checksums together and rerun native source-contract
inspection when upgrading the compatibility baseline.

For visible changes, inspect both themes at `120x40`, `70x24`, `40x12` and
`18x8`. `TUI_COLS`, `TUI_ROWS` and `TUI_THEME` select acceptance dimensions;
`OMO_TUI_EVIDENCE_DIR` retains sanitized terminal frames. Native prerequisites
are mandatory, never a reason to silently skip a failing gate.

## Build and inspect a distributable

```sh
bun run pack
```

This creates `artifacts/omo-route-panel-<version>.tgz` from an isolated build and
prints `PACKAGE_TARBALL`, SHA-512 integrity and file count. It never reads an
existing checkout `dist`, so stale output cannot enter the release. For a
tarball retained from full packaged-host validation, set
`OMO_PACKAGE_OUTPUT_DIR=artifacts` when running `test:package-host`.

`npm pack` directly in a source checkout follows the conventional `prepack`
build and can update that checkout's `dist`. Use `bun run pack` for isolated
validation, especially if another process still uses the checkout's output.
Consumers install the tarball; they do not run `prepack`.

## Source publication and clean initial history

The original 45-commit private development history contains local operational
records and personal commit metadata. Preserve that private lineage intact as a
local archive without rewriting or force-pushing it. Publish the first public
repository history as a fresh tracked snapshot with canonicalized Git metadata,
and carry all subsequent development forward on public `main`. The dated
[open-source readiness record](open-source-readiness.md) preserves the original
local verification and code hashes, while
[first public release status](first-public-release.md) records public repository,
CI and staging milestones as they occur.

Before approving a public release:

1. Publish the clean initial source snapshot to `GodCC6/omo-route-panel` on
   `main`.
2. Keep GitHub private vulnerability reporting enabled (verified on
   `GodCC6/omo-route-panel` on 2026-10-29; see [SECURITY](../SECURITY.md)).
3. Run the `Validation` workflow (`base.yml`). It runs account-free base
   checks on macOS and Linux plus native and packaged-host checks on macOS.
   Configured workflow definitions are not evidence of a remote pass until their
   recorded results exist in
   [first public release status](first-public-release.md).
4. Complete the one-time npm staged bootstrap and OIDC trust binding under the
   2FA-enabled maintainer account `cc922`.
5. Update the changelog and release status, push a reviewed `v<package.json version>`
   tag on the public lineage, and run the stage-only release workflow before any
   manual approval decision.

Dependabot proposes weekly Bun dependency and GitHub Actions updates. Review
lockfile changes normally; no automatic merge is configured. Keep OMO fixture,
source-contract evidence and real-host compatibility updates in the same
reviewed maintenance increment.

## npm staged bootstrap and trusted publishing

Local validation never reads npm credentials, writes to the registry or handles
tokens. All interactive npm authentication and 2FA challenges are completed
directly by a person in their own browser or terminal; automated agents must
never collect passwords, OTPs, recovery codes or tokens.

Since 2026-10-02, npm staged publishing can create a new package from a local
logged-in session when the maintainer account (`cc922`) has 2FA enabled:

1. Authenticate interactively in a maintainer terminal (`npm login` / browser
   session for `cc922`).
2. Build and verify the isolated release tarball (`bun run pack`). Create a
   separate bootstrap tarball from that same compiled build, changing only its
   temporary packaged manifest to a distinct prerelease version such as
   `0.1.0-bootstrap.1`. Do not change the stable source manifest or its tag.
   Stage that reservation with an explicit non-default tag:

```sh
npm stage publish /absolute/path/to/omo-route-panel-0.1.0-bootstrap.1.tgz --tag bootstrap --access public --ignore-scripts
```

   Staging a new package creates the public `0.0.0-stage` placeholder so package
   settings exist. The reservation and formal candidate remain unpublished.
3. Keep the bootstrap reservation staged while configuring trust and staging
   the real `0.1.0` through CI. Never approve the reservation. Remove it only
   after a real version has been approved and the package no longer depends on
   its initial placeholder.
4. Configure npm trusted publishing on the created package with stage-only
   authority. The repository helper `bun run release:stage <verified.tgz>` is for
   the stable CI candidate, not the prerelease reservation above.

The first rollout demonstrated that rejecting the only staged bootstrap removes
the initial placeholder too, leaving an unpublished package and triggering npm's
24-hour republish restriction. A different authentication attempt cannot clear
that registry cooldown. Do not use the formal version as a disposable bootstrap,
and do not delete the only bootstrap reservation before the first real release.
See the dated evidence in [first public release status](first-public-release.md).

| npm setting | Value |
| --- | --- |
| Maintainer account | `cc922` (2FA required) |
| Provider | GitHub Actions |
| Organization/user | `GodCC6` |
| Repository | `omo-route-panel` |
| Workflow filename | `release.yml` |
| Environment | `npm` |
| Allow npm stage publish | Enabled (`true`) |
| Direct publish | Disabled (`false`) |

Configure the GitHub `npm` environment to restrict deployment refs to selected
version tags matching `v*`. Do not configure a redundant GitHub required-reviewer
rule that causes a self-review lockout for a sole maintainer; interactive npm
2FA proof of presence at `npm stage approve` is the final publication gate. Do
not add an `NPM_TOKEN` secret.

## Stage-only release workflow and final approval

Run `.github/workflows/release.yml` manually **at the release tag**, not at
`main`. For example, after pushing the reviewed tag:

```sh
gh workflow run release.yml --ref v0.1.0 -f stage=false
```

The boolean `stage` input defaults to `false` (verification only).
`check-release.mjs` rejects any ref that does not match `v<package.json version>`
and rejects a repository that does not match npm metadata. Running at the tag
keeps GitHub provenance aligned with the exact tagged source commit.

The verify job checks docs, type/lint/base behavior, a checksum-verified native
host, native reports and both npm and Bun packaged-host consumers. It retains
and uploads the **exact tarball those consumers tested**, never a later rebuild.

After the distinct bootstrap reservation and OIDC trust binding are configured,
leave that reservation intact and run the workflow with `stage=true`:

```sh
gh workflow run release.yml --ref v0.1.0 -f stage=true
```

When `stage=true`, the `stage` job enters the `npm` environment, requests
GitHub OIDC (`id-token: write`), and invokes `scripts/stage-release.mjs` with
Node (the same helper as `bun run release:stage`) to stage the verified tarball.
The workflow stages only and **never**
approves a release, creates tags, pushes commits or runs on ordinary branch
pushes.

To publish a staged version after inspecting the staged contents and provenance,
the maintainer runs `npm stage approve` (or `npm stage reject` to discard it)
interactively with live 2FA proof of presence. Once approved, verify the
published version and integrity on the registry, then test
`omo install npm:omo-route-panel@<version>` in a temporary HOME before announcing
availability.

Reference documentation checked on 2026-10-29:
[npm staged publishing](https://docs.npmjs.com/staged-publishing/),
[npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) and
[host package format](https://github.com/code-yeongyu/senpi/blob/main/packages/coding-agent/docs/packages.md).
