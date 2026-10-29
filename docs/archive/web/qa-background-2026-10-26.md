# Historical QA Record: Background Task State & Model Display (2026-10-26)

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

*Historical Evidence Note: This document records the 2026-10-26 verification of background memory task switches and model strategy display against OMO 5.1.48 (commit `6602beb`). Any temporary paths mentioned below are historical test artifacts.*

## Scope of the 2026-10-26 Fix

- **Shared effective switch calculation**: Overview and Background sections share the same effective switch state, applying verified built-in memory defaults when fields are omitted and distinguishing built-in defaults, merged config layers, and new-task identity overrides.
- **Global master switch & Sync boundary**: The global `memory.enabled` master switch is not overridden by `identity.enabled`, and the Sync runner consumes global `memory.sync` settings only, matching upstream runtime consumption.
- **Category & dynamic fork display**: Recall displays its bound category candidate chain; Reflection and Dream display their category candidates alongside the parent-session dynamic fork strategy, with Dream sharing the Reflection category.
- **Facts precedence**: Facts distinguishes an explicit model override, user-configured `quick` candidates (excluding built-in fallback items appended by the native loader), and session model inheritance.
- **Local & on-demand tasks**: Nudge and Sync switches are displayed separately without fabricating model chains; Compaction, lexical search/projection, and helper completion are shown as on-demand policies.
- **Conservative unknown boundary**: Editors still write explicit global fields only, and unattributable git/session identity overrides remain explicitly labeled `unverified` / `unknown`.

## Automated Checks (2026-10-26)

`bun run check`, `bun run build`, `bun run lint`, and `bun run test` passed (**84/84 Node tests passed, 0 failed**), covering:

- Built-in default switches, global master switch gating, and file/harness/profile layer precedence.
- Attributable identity model and per-feature overrides vs. ignored `identity.enabled` and `identity.sync` overrides.
- Facts user `quick` candidate filtering, native projection sanitization, and application-level preview, save, and undo state transitions.
- TypeScript LSP diagnostics and `git diff --check` passed with zero warnings.

## Browser & Service Verification (2026-10-26)

- Tested in a headless browser using a temporary `HOME`, synthetic catalog, and synthetic configuration without touching personal routing files.
- Verified Overview and Background sections across light and dark themes (including previewing and saving removal of explicit Dream/Facts switches and adding two user `quick` candidates).
- Confirmed zero horizontal document overflow and verified that `document` remained the primary scroll container, with only the native Facts model listbox acting as a scoped local scroll container.
- Temporary screenshot artifacts were written to a local scratch directory (`/tmp/route-background-ui-*`) and not committed to Git.
- After independent functional and visual review rounds passed, the local managed service was restarted via `launchctl kickstart -k` under explicit user authorization, confirming HTTP `200` for static assets (matching the compiled `app.js` SHA-256 digest `4ad423823a40b5931e2134aae7de4034d595a76bc23ea78b08ecb3989123a2c2`) and HTTP `401` for unauthenticated `/api/snapshot` requests.
