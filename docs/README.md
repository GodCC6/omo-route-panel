# Documentation

Maintained index updated: 2026-10-29. Start with the current native-extension
guides below. Historical evidence is separated from current contracts and never
substitutes for release-candidate validation.

## Current user and maintainer guides

- [English and Simplified Chinese onboarding, installation and workflow](../README.md)
- [Contribution setup, architecture and isolated validation](../CONTRIBUTING.md)
- [Security boundaries and private reporting setup](../SECURITY.md)
- [Release, npm artifact verification and publication](releasing.md)
- [Open-source readiness and remaining release inputs](open-source-readiness.md)

## Current product and implementation contracts

- [Native TUI product requirements](tui-product-requirements.md)
- [Keyboard interaction, layout, changes and Apply](../DESIGN.md)
- [In-process extension and transaction API](api.md)
- [Native reports, installation identity and real/mirror equivalence](native-contract.md)
- [Current host model registry and complete identifiers](metadata-contract.md)
- [Installation-bound background semantics and source evidence](background-semantics.md)

These contracts describe new-task routing, not live sessions, provider health
or successful inference. The host supplies the registry and terminal; the panel
edits supported user-native configuration only.

## Historical evidence

The [archive index](archive/README.md) separates retired Web instructions and
screenshots from dated native TUI plans, implementation, acceptance and local
installation records. The 2026-10-29 terminal record reports 179 base tests and
real-host light/dark acceptance at four terminal sizes; it is historical evidence,
not a fresh test of the current package. The redesign record retains the native
source-evidence failure observed during that work.
