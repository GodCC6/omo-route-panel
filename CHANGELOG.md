# Changelog

User-visible changes are recorded here. Version numbers follow Semantic
Versioning; a `0.x` minor release may change extension or configuration
contracts. Dates identify releases, not local verification runs.

## 0.1.2 - 2026-11-12

### Added

- Automated npm publishing: merging a version bump to `main` validates the
  change and publishes the tarball through npm trusted publishing (OIDC),
  then records a `v<version>` tag. Versions without a bump skip publishing.

### Changed

- The release guide describes the automated flow, the trusted-publisher
  binding and the manual fallback.

## 0.1.1 - 2026-11-05

### Fixed

- A globally installed npm `omo-ai` host is recognized from its declared
  JavaScript launcher, so `/route-panel` no longer fails host verification on
  that installation layout.
- Host verification failures keep their safe stage/error code in the user-facing
  message instead of folding every failure into one generic sentence.
- npm host verification rejects packages changed after the host process started,
  including same-version replacements and reports rewritten with preserved mtimes.
  Restart the host after upgrading its installation.

## 0.1.0 - 2026-10-30

### Added

- Initial release as an independently loaded OMO extension,
  with `/route-panel` and a precompiled npm distribution.
- Native routing and background-task inspection, candidate-chain editing,
  explicit Apply, conflict detection, and durable last-save undo.
- An English keyboard-driven terminal interface, with English and Simplified
  Chinese onboarding documentation.
- MIT license, isolated package verification, contributor guidance, and
  ordinary npm account publishing.

### Changed

- Retired browser, HTTP server, daemon, and Tailscale deployment paths are
  historical material rather than supported installation methods.
