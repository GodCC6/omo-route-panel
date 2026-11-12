# Releasing on npm

Updated: 2026-11-12.
Package: `omo-route-panel`. Maintainer: `cc922`.

Releases are automated through npm trusted publishing (OIDC). A pull request
that updates the package version and changelog, merged to `main`, is validated
by the usual CI jobs and then published by the `publish` job in
`.github/workflows/base.yml`. No npm token is stored in the repository or CI.

## Automated release flow

1. Update the `package.json` version and add a `CHANGELOG.md` entry in a PR.
2. Merge to `main`. CI runs `validate:base`, `check:docs`, `test:packaging`
   and the native and real-host suites as on any change.
3. After all validation jobs pass, the `publish` job compares the package
   version with the registry, packs a fresh tarball with `bun run pack`,
   publishes `artifacts/omo-route-panel-<version>.tgz` via
   `npm publish --ignore-scripts --access public`, and pushes the `v<version>`
   tag. An unchanged version skips publishing with a notice.

npm generates provenance attestations automatically for publishes from this
public repository. A failed publish can be re-run from its workflow run; the
registry rejects an already-published version. npm allows unpublishing a
version within 24 hours of publication; later corrections can only mark it
deprecated.

## Trusted publisher binding

The package settings on npmjs.com bind publishing to this repository's
workflow: GitHub Actions, `GodCC6/omo-route-panel`, workflow file `base.yml`,
allowed actions `npm publish` and `npm stage publish`. The binding was
configured on 2026-11-12 and requires the maintainer's own 2FA. npm validates
a new binding through its first successful publish within 2 days of creation.
The workflow filename is part of the binding: renaming `base.yml` requires
deleting and recreating the binding.

To require per-release approval instead, switch the binding's allowed actions
to stage-only: the workflow then stages the version through `npm stage
publish`, and the maintainer approves it in npm Staged Packages from any
device. No repository change is needed.

## Verify and pack

Use Node `26.11.1` and Bun `1.3.14`:

```sh
bun install --frozen-lockfile
bun run check:docs
bun run validate:base
bun run test:packaging
bun run pack
```

Run the native and real-host checks when runtime or interaction changes:

```sh
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run validate:native
OMO_LAUNCHER_PATH="/absolute/path/to/omo" bun run test:package-host
```

`pack` builds a fresh temporary source copy and writes
`artifacts/omo-route-panel-<version>.tgz`. It does not use or replace an existing
checkout's `dist`. `test:packaging` installs the actual tarball with both npm
and Bun; `test:package-host` also drives the installed extension in OMO.

The package contains compiled extension/worker JavaScript, its manifest,
README, changelog, license and notices. `jsonc-parser` is the runtime dependency.
OMO supplies the optional `"*"` terminal peer. Consumers need no compiler.

## Publish manually (fallback)

After updating the version and changelog, publish the verified tarball:

```sh
npm whoami
npm publish ./artifacts/omo-route-panel-<version>.tgz --access public --ignore-scripts
```

npm performs its normal account verification. Complete login and any required
2FA yourself; do not send credentials or verification codes to an agent.

For remote work, npm's own staging feature avoids a browser prompt on the build
machine:

```sh
npm stage publish ./artifacts/omo-route-panel-<version>.tgz --access public --ignore-scripts
```

Then sign in to npm on **your current device**, open your account's
**Staged Packages**, inspect that version and approve it there. This is an
alternative to direct publishing, not an additional required project gate.
It needs no OIDC connection or access to the Mac mini's browser. The current
device must be able to use an authenticator registered to the npm account.

## Check the published version

Verify its registry integrity against the tested tarball, then install it in
a temporary HOME and exercise the extension:

```sh
npm view omo-route-panel@<version> version dist.integrity
omo install npm:omo-route-panel@<version>
```

The installation command above is for the isolated acceptance environment;
ordinary users run it with their normal OMO configuration. Update the dated
release evidence with actual results; see [0.1.1](release-0.1.1.md) and
[0.1.2](release-0.1.2.md).
The [first-release record](first-public-release.md) preserves the earlier
publication and authentication history.

## Existing first-release reservation

The first setup left `0.1.0-bootstrap.1` staged under tag `bootstrap`. Keep it
until the real version is published. Rejecting the only staged reservation
previously withdrew npm's placeholder and caused a 24-hour republish cooldown.
That incident and the retired OIDC attempt are preserved in the release
evidence; they are not the normal publishing procedure.
