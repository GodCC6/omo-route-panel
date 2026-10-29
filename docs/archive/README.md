# Documentation Archive

Archive organized: 2026-10-29. Everything here describes a dated source revision,
an earlier environment or a superseded proposal. Commands, interfaces, support
claims and license/publication decisions in these records are historical, not
current installation guidance or fresh release checks. Personal absolute paths
may be generalized; test results and known failures are retained.

Use the [current documentation](../README.md) for native extension onboarding,
contracts, contribution and release procedures.

## Retired Web implementation

The browser, HTTP/SSE API, standalone server, launchd service and Tailscale
deployment are no longer product surfaces. The records below do not authorize
starting or changing old personal services, DNS or tailnet state.
The old executable Web-backend spike and its exclusive fixtures were removed
from the maintained script/test tree on 2026-10-29. Its dated feasibility report
remains evidence of that experiment, not an available validation command.

- [Open-source refactoring plan, 2026-10-27](web/open-source-refactoring-plan.md)
- [Open-source implementation diary, 2026-10-27](web/open-source-implementation.md)
- [Initial browser QA, 2026-10-25](web/qa-2026-10-25.md)
- [Browser scroll-owner probe, 2026-10-25](web/scroll-owners-2026-10-25.md)
- [Background browser QA, 2026-10-26](web/qa-background-2026-10-26.md)
- [Recovery and remote access incident, 2026-10-26](web/recovery-2026-10-26.md)
- [Desktop release-preparation QA, 2026-10-27](web/qa-open-source-2026-10-27.md)
- [Live control-endpoint catalog evidence, 2026-10-27](web/catalog-source-2026-10-27.md)
- [Former remote-access instructions](web/tailscale-access.md)
- [Former HTTP and transaction contract](web/api-contract.md)
- [Former server/native adapter contract](web/native-contract.md)
- [Former SDK/control-endpoint catalog contract](web/metadata-contract.md)
- [Extension-host feasibility spike, 2026-10-28](web/extension-host-spike-2026-10-28.md)
- [Superseded extension-host Web-backend proposal](web/extension-host-refactoring-plan.md)

The [legacy screenshot directory](web/images/README.md) contains synthetic
English/Chinese Web captures. They illustrate the retired browser, not the
current English-only terminal UI.

## Native TUI decisions and dated evidence

- [Four-section implementation, 2026-10-28](native/tui-implementation-2026-10-28.md)
- [Readability and host peer correction, 2026-10-28](native/tui-readability-2026-10-28.md)
- [Previous product baseline v1.1](native/tui-product-requirements-v1.1.md)
- [Interaction redesign proposal revision 3, 2026-10-29](native/tui-interaction-redesign-2026-10-29.md)
- [Compact editor implementation, 2026-10-29](native/tui-redesign-implementation-2026-10-29.md)
- [Local installation chronicle, 2026-10-29](native/local-installation-2026-10-29.md)
- [Terminal boundaries and local activation, 2026-10-29](native/tui-boundaries-2026-10-29.md)

The redesign diary preserves its native source-evidence failure and distinguishes
baseline, corrected-source and reviewer results. The later boundary record
reports 179 base tests and real-host acceptance in light/dark at `120x40`,
`70x24`, `40x12` and `18x8`. None of those counts certifies a newly packaged
release. Temporary `/tmp` and local `.omo/evidence` references are artifact
locators from those sessions, not files shipped with this documentation.
