# Clean first source publication and staged npm release

Decision date: 2026-10-29.
Package: `omo-route-panel`, version `0.1.0`.
GitHub repository: `GodCC6/omo-route-panel`.
npm owner: `cc922`; the authenticated account reports 2FA for authentication
and writes.

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

See [the maintained release procedure](releasing.md) for clean-history
publication, bootstrap staging, stage-only OIDC configuration and the
maintainer's final approval boundary.
