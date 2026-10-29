# Open-source desktop acceptance

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

The catalog implementation described here predates the subsequent live TUI
source correction. See [live catalog evidence](catalog-source-2026-10-27.md)
for the current catalog, freshness and transaction verification.

Verification date: 2026-10-27. Final source identity, lockfile digest and automated
suite results are recorded in [implementation evidence](open-source-implementation.md).

## Environment and isolation

macOS arm64, Node `26.11.1`, Bun CLI `1.3.14`, Chrome `156.0.8078.48`,
installed OMO `5.1.48`, SDK `2026.10.23-1`.
The candidate was built in a separate source copy with fresh output. All write
work used the manual QA fixture's temporary HOME, synthetic configuration and
synthetic model catalog, with the real installed native report adapter.
The ephemeral authorization token was delivered privately over a Unix socket.
The personal service and its build output were not restarted or replaced.

## Complete desktop matrix

Each cell below covers all seven navigation sections: Overview, Categories,
Agents, Background & Memory, Main Session & Compaction, Pending Changes, and
Compatibility & Diagnostics. Captures include the top and bottom of each page,
two unsaved save groups, an expanded route and a valid native preview.

| CSS width | English light | English dark | Chinese light | Chinese dark |
| --- | --- | --- | --- | --- |
| 1280 | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages |
| 1440 | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages |
| 1920 | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages | PASS, 7 pages |

Total: **84 page states, 168 top/bottom captures, zero horizontal document
overflows**. Document remains the main vertical scroll owner. Bounded catalog
result lists are the only observed local vertical scrollers. Long paths,
native ladders, empty effective chains and warnings remain visible.

The first 1280px English pass found an overly narrow provider filter inside
field cards. Its layout now stacks according to the component's available
width rather than a phone breakpoint; the complete matrix above uses the fix.
No mobile emulation or phone certification was performed.

## Actual browser zoom, keyboard and long IDs

The task-owned Chrome profile's actual default zoom was set to **200%** through
its internal appearance setting, rather than pinch scaling or CSS zoom.
The observed layout viewport was 720 CSS pixels at device pixel ratio 2,
with visual viewport scale 1 and a 1440-pixel capture.
All seven sections passed in both languages and themes: **28 additional page
states**, zero horizontal overflow, with content and actions accessible through
document scrolling.

Actual Tab input reached the provider filter with `:focus-visible`, a solid
2px outline, and the selected full identifier displayed in metadata in all four
language/theme combinations. The long test identifier retained both provider
and complete raw ID; the full value was not shortened to fit the page.
The browser profile's zoom was restored to 100% afterwards.
The explicit cold browser integration harness uses mock/basic credential
storage for its synthetic profile rather than the user's OS credential store.

## Capability and connection states

Six synthetic browser-response scenarios were inspected in both languages and
themes: read-only, native unverified with unknown catalog, native incompatible
with fresh catalog, stale retained results, fresh empty data, and disconnected
SSE. All **24 captures** had no horizontal overflow and presented the relevant
state and next action. Unverified is not labeled incompatible; a failed native
check does not claim catalog refresh is unavailable or imply a version whitelist.
SSE disconnection was observed after its bounded reconnect cycle, using a DOM
event subscription rather than a fixed test sleep.

These client-response scenarios verify presentation, not server authorization.
Server-side gates and native failure/recovery are covered separately by the
base and supplied-installation suites.

## State-preserving localization

The real Chromium regression (`test/i18n.browser.ts`) verifies:

- First-use English, explicit local language persistence, and no other stored
  state.
- Usable first-use English and in-memory switching even when the browser throws
  on access to the `localStorage` property itself.
- Drafts, operation payloads, snapshot/preview IDs, filters, navigation,
  active editor query, focus and selection retained across both switch directions.
- Existing draft summaries, editor errors, preview warnings, notices, and
  invalidation reasons re-rendered from message identifiers and parameters.
- A preview response delivered after a language switch rendered in the current
  language, without another preview request.
- Unknown external message IDs, model IDs, user values and serialized JSON text
  preserved verbatim.
- No API request caused by a language switch; a valid preview remained usable.
- Native unverified and native incompatible displayed distinct explanations.

Typed dictionary tests separately check language/parameter parity, preference
values, immutable cached explanations, and external-value preservation. They
compare machine-consumed values or shipped dictionary entries, not pinned prose.

## Real temporary-config write workflow

Through the production browser handlers and real application:

1. Staged a Native reasoning change and an independent Settings draft, then
   generated a Native preview.
2. Switched English to Chinese: API call delta was **0**. The subsequent save
   used the same preview ID.
3. Explicitly saved Native. The file contained the intended reasoning value;
   memory configuration and Settings remained unchanged. The Settings draft
   remained pending.
4. Prepared a new undo preview and explicitly saved it. Parsed Native nodes
   matched the initial document.
5. Prepared a Settings preview, then applied a separate synthetic external edit.
   SSE invalidated the preview while retaining the draft. Committing the old ID
   through the authenticated API returned **409 (`stale`)**. The external field
   survived and the unsaved reasoning change did not reach disk.
6. Refreshed and generated a new preview. A synthetic 409 save response verified
   cached error translation in both languages and themes without another API
   request during switching. This last client error display is synthetic; the
   preceding server conflict rejection was real.

## Capture locations and scope

Full local captures are in the ignored directory
`artifacts/open-source-2026-10-27/`:

- `<width>-<language>-<theme>-<section>-top.png` and `-bottom.png`
- `zoom-200-<language>-<theme>-<section>.png`
- `state-<scenario>-<language>-<theme>.png`
- `keyboard-long-id-<language>-<theme>.png`
- `conflict-<language>-<theme>.png`

The two reviewed public screenshots are
[`images/desktop-en.png`](images/desktop-en.png) and
[`images/desktop-zh.png`](images/desktop-zh.png). They contain temporary synthetic
paths and values, not personal routing or account data.

This is a functional desktop and localization acceptance record, not a new
visual redesign or a blanket Lighthouse/HIG certification. The existing
editor's separate candidate-add and draft-apply buttons can both carry primary
styling; that pre-existing hierarchy was not redesigned in this localization
increment.
