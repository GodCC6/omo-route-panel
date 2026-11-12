# 0.1.2 release evidence

Released: 2026-11-12 through the automated pipeline for the first time, which
also validated the trusted-publisher binding configured the same day (its
two-day validation deadline was 2026-11-14T06:39Z).

## Pipeline record

- Version bump `341009d` triggered the first automated run: base (macOS and
  Ubuntu), native and real-host suites passed, but the publish job failed
  before authentication because npm parsed the bare `artifacts/...tgz`
  argument as a GitHub repository shorthand and ran `git ls-remote` against
  it. Prefixing local tarball paths with `./` fixed spec resolution in
  `ec86a94`; the workflow and both documented manual commands now use it.
- The retry run (`ec86a94`, run 43171475386) passed the same validation
  jobs, packed `omo-route-panel-0.1.2.tgz` with `bun run pack`, published it
  with `npm publish --ignore-scripts --access public` under OIDC trusted
  publishing (no npm token anywhere), and pushed the `v0.1.2` tag.
- The published extension code is unchanged from the accepted `0.1.1` build;
  CI's native job installed the packed tarball in a real OMO host and drove
  the extension (`test:package-host`) on this exact commit.

## Registry verification (checked 2026-11-12)

- `npm view omo-route-panel version` reports `0.1.2` and `dist-tags.latest`
  is `0.1.2`; registry metadata lagged the publish by a few minutes because
  of CDN propagation.
- `dist.integrity`:
  `sha512-lLM6F6sTHC+AL1P6j/99oPcgMhyxHml2kGjT/qdcphPltJqaeUxfUdSR692S+F8OYFO3Ypv60qE1XqaweooZ0Q==`
  (matches the publish log of run 43171475386).
- `dist.attestations` carries a provenance attestation with predicate type
  `https://slsa.dev/provenance/v1`; the publish log recorded the signed
  statement in the Sigstore transparency log (log index 3827379202).
