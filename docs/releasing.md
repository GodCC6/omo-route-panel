# Releasing on npm

Updated: 2026-10-30.
Package: `omo-route-panel`. Maintainer: `cc922`.

Releases use the maintainer's normal npm account. GitHub Actions runs tests;
it does not publish. There is no custom release workflow, OIDC binding
requirement, repository approval environment, or publication wrapper.

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

## Publish the tested artifact

After updating the version and changelog, publish the verified tarball:

```sh
npm whoami
npm publish artifacts/omo-route-panel-<version>.tgz --access public --ignore-scripts
```

npm performs its normal account verification. Complete login and any required
2FA yourself; do not send credentials or verification codes to an agent.

For remote work, npm's own staging feature avoids a browser prompt on the build
machine:

```sh
npm stage publish artifacts/omo-route-panel-<version>.tgz --access public --ignore-scripts
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
[release evidence](first-public-release.md) with actual results.

## Existing first-release reservation

The first setup left `0.1.0-bootstrap.1` staged under tag `bootstrap`. Keep it
until the real version is published. Rejecting the only staged reservation
previously withdrew npm's placeholder and caused a 24-hour republish cooldown.
That incident and the retired OIDC attempt are preserved in the release
evidence; they are not the normal publishing procedure.
