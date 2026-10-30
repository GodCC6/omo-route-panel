# Clean first source publication and staged npm release

## Current result

Verified: 2026-10-30. **`omo-route-panel@0.1.0` is published and installable.**
The registry records publication by `cc922` at `2026-10-30T14:37:32.804Z`;
`latest` points to `0.1.0`.

The maintainer requested ordinary account publishing instead of the custom
stage-only/OIDC process. Commit `4ad4f29` removed the release workflow,
publication-policy helpers and their seven dedicated tests. All product
behavior tests remain. Validation run `41064955866` passed on the public main.

| Check | Result |
| --- | --- |
| Retained base suite, strict compilation, lint and isolated build | 181 passed, zero failures/skips |
| Final 28-file tarball installed with npm and Bun | Both real-host acceptance runs passed |
| Published version and tested tarball | SHA-512 integrity identical |
| `omo install npm:omo-route-panel@0.1.0` | Exit 0 in a fresh, account-free temporary HOME |
| `omo list --no-approve` | Recognized the installed npm package |
| Real OMO loading the registry-installed factory | Complete edit/save/conflict/reload/undo acceptance passed |

The final package integrity is:

```text
sha512-sfXmwnvwKtQ+9Sb+nh+RR4iVne3LsAx0mWm45Xc51jaUSceB/KA8pmeoRaBgFHFvd40MMqGCuYuF+Mpcizg8FQ==
```

Publication used the ordinary `cc922` account. npm's own staging option let the
owner approve the tested artifact from the browser on their current remote
device; no working OIDC connection or Mac mini browser interaction was needed.
The extra bootstrap reservation was left untouched during publication.
The [release guide](releasing.md) describes the simple ongoing procedure.
Local registry-host proof is retained under `artifacts/public-npm-0.1.0-host`
(ignored, synthetic data only).

## Earlier rollout history

The remaining sections preserve the previous attempt and its superseded
stage-only requirements. They are not additional conditions for future releases.

Decision date: 2026-10-29.
Package: `omo-route-panel`, version `0.1.0`.
GitHub repository: `GodCC6/omo-route-panel`.
npm owner: `cc922`; the authenticated account reports 2FA for authentication
and writes.

Current direction (2026-10-30): use ordinary npm account publishing, with npm's
website approval on the owner's current device when working remotely. The
custom stage-only/OIDC workflow and its policy helpers have been removed.
The staged/OIDC sections below preserve the earlier attempt, not an active
publication requirement. Published-version verification is recorded at the end.

## Approved publication boundary

The maintainer approved a clean first public Git history, retaining the complete
earlier development history privately. Subsequent development follows one public
`main` lineage. The existing tracked source and ignored local agent state must
remain intact during the local metadata transition.

The npm channel is stage-only. GitHub Actions may build, validate and stage the
exact tested tarball; it may not approve a staged version or directly publish
one. Final `npm stage approve` requires the maintainer's own interactive 2FA
decision. A `0.0.0-stage` bootstrap placeholder does not make `0.1.0` publicly
installable.

## Verified staging implementation

The release workflow's `stage` input defaults to `false`. Its staging job is
bound to the GitHub `npm` environment, receives `id-token: write`, and invokes
`scripts/stage-release.mjs` on the retained artifact. That wrapper accepts exactly
one `.tgz`, invokes only `npm stage publish`, and propagates registry failures.
It does not run `npm stage approve` or direct `npm publish`.

Local `bun run validate:base` passed 188 tests with zero failures/skips,
including strict type checking, lint, isolated build and staging-boundary
regressions. The authenticated npm identity is `cc922`, with 2FA mode
`auth-and-writes`, verified on 2026-10-29. No password, token, recovery code or
OTP is part of this record.

## Rollout evidence

On 2026-10-29, `cc922` successfully staged the verified `0.1.0` bootstrap
tarball. The public registry exposes only `0.0.0-stage` with `cc922` as its
maintainer; formal `0.1.0` is not published. The bootstrap tarball contains
28 files with integrity:

```text
sha512-vDGTgZdLP+5o/hdd9to0QTw7yUc4xA4lVR/8hyHuKo9A5duUYFFrtv2CbnirDjtqghPTj5q04uO7CU7KdSMWzA==
```

Source-publication, remote CI and npm trusted-publisher results are recorded
only after the corresponding operations succeed. The earlier
[open-source readiness record](open-source-readiness.md) is evidence of its
dated local candidate, not a claim that a formal version was published.

### Public source history

The first public root is `c95ddc4eac253b4bfe4359be735b0ed208d701f1`.
Its tracked tree is `182f47f4416cc8ac493728bbfb53fa5f47283106`, exactly equal
to the verified private preparation snapshot. Its independent object store
contained exactly one commit object, including unreachable objects; the old
private preparation commit was absent.

All 46 pre-public commits, refs, reflog, index and original repository metadata
remain in a private local archive outside the public repository. The current
workspace now follows public `main`; tracked source and ignored local agent
state stayed in place. Public commits use the maintainer's GitHub noreply
identity. The first push used the existing SSH agent authenticated as
`GodCC6`, without expanding the earlier OAuth token's permissions.

### Initial remote verification and correction

Validation run `40855218288` passed the macOS base and real native-host jobs.
Its Ubuntu base job exposed an existing deleted-executable case:
`realpath /proc/<pid>/exe` returned `ENOENT` after a same-path, same-digest
launcher replacement. The existing regression expected verification refusal,
not an uncaught filesystem error.

Commit `0610fa4` returns unverified for that missing mapped path while retaining
device/inode and digest checks. No assertion was removed or weakened. The
complete local base suite still passed 188 tests. Remote Validation run
`40856498051` then passed all three jobs: base on Ubuntu, base on macOS and
native host acceptance on macOS.

### Publication controls

The GitHub `npm` environment permits only tag refs matching `v*`. npm package
policy was set through the official interactive client to require 2FA for
publication and disallow automation-token overrides. Trusted-publisher
registration and final tagged CI staging require their own verified results;
neither statement grants formal-version approval.

### Tagged CI candidate and owner-verification handoff

The annotated `v0.1.0` tag points to
`0832a641a49382984f6d58c0e79630cf7548aad2`. Main Validation run `40857416133`
passed all jobs. Tagged workflow run `40857672848`, explicitly dispatched with
`stage=false`, passed its verification job and skipped its registry-writing job.
Its downloaded 28-file tarball matched the SHA-512 reported by both npm and Bun
real-host installation checks:

```text
sha512-yMrAlq2sRwU2XWAY7zoA+ZAxlALKA7na+qRXtX1+Lw0h3/Soj5OwOMRBrPQlODFtIzqYdt96dOpBnkCxnVJGNA==
```

The npm settings page was inspected through the owner's already logged-in
browser session, without reading credentials. It confirmed `cc922`, the
restrictive 2FA package policy, and no saved trusted-publisher connection.
The correct GitHub form was prepared with direct publish and dist-tag access
unchecked, but remained unsubmitted when the owner-help window elapsed. The
browser session was then closed without starting another authentication flow.

Remaining work requires the owner to complete that single browser setup and
its 2FA confirmation. After verifying the saved stage-only connection, reject
only this task's bootstrap stage, run `release.yml` with `stage=true`, and check
the CI/OIDC-produced staged version and provenance. Do not approve the staged
formal version as part of this rollout. Tagged CI verification alone does not
prove that OIDC registration or registry staging has succeeded.

See [the maintained release procedure](releasing.md) for clean-history
publication, bootstrap staging, stage-only OIDC configuration and the
maintainer's final approval boundary.

## Owner confirmation and registry cooldown

The owner subsequently completed the same-page browser confirmation. npm showed
the saved connection for `GodCC6/omo-route-panel`, `release.yml`, environment
`npm`, with only `npm stage publish` permitted. Direct publish and dist-tag
permissions were absent. The connection was pending initial validation, with a
displayed deadline of `2026-10-31T11:31Z`.

Rejecting the original sole bootstrap stage then also removed npm's
`0.0.0-stage` placeholder. Registry metadata records that unpublication at
`2026-10-29T11:34:39.919Z`; the package settings page became unavailable. This
was a flaw in the original bootstrap procedure, not a failed owner login.

OIDC workflow run `40866607725` passed verification but failed its staging job
with `E401`. A separate recovery attempt using the same verified compiled
build, with only a temporary manifest version of `0.1.0-bootstrap.1`, was
explicitly rejected with `E403`: the name cannot be republished until 24 hours
have passed. That reservation was not created or published.

The retry window is scheduled for `2026-10-30T11:36:40Z`, allowing two minutes
after the registry cooldown. Recovery must retain the distinct prerelease
reservation, recheck or restore the stage-only connection, and retry the failed
CI staging job without moving the public `v0.1.0` tag. The persisted state of the
connection after npm's placeholder removal has not yet been verified.

No formal `0.1.0` version has been approved or made publicly installable. The validated
CI tarball and the complete private source-history archive remain intact.

## Recovery after the registry cooldown

Verification date: 2026-10-30.

The owner's expired CLI login was renewed through npm's official attended
browser flow, and `npm whoami` confirmed `cc922`. The distinct reservation
`0.1.0-bootstrap.1` was successfully staged under tag `bootstrap` at
`2026-10-30T12:28:12.446Z`, with stage ID
`49a30480-6ae7-4a5c-b50b-d5bf82244d4c`.

`npm stage view` confirmed that reservation remains staged and has SHA-1
`ad3c865b10526c349aa5bdfb1ba2752f4704f437`. Its SHA-512 integrity is:

```text
sha512-/CoOTbTXh/M6+EM6+5447wHoJAoMpGXhJxkd/vm8se3uFnSNQxPNwiJXNUxQHqWdDwsXScUrGfWrXTBvCi77ZQ==
```

The public `0.0.0-stage` placeholder and `cc922` ownership are restored. The
reservation must remain staged until a real version has been approved; it is
not an installable `0.1.0` release.

The restored settings page shows the restrictive 2FA policy but no saved
trusted-publisher connection. The connection did not survive the placeholder
removal. A replacement stage-only form was prepared, but owner verification
reported an error and no saved connection has been observed. Recovery has not
rerun CI/OIDC staging or requested formal-version approval.
