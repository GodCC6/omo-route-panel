# Historical Layout & Scroll-Owner Probe: 2026-10-25

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

*Historical Evidence Note: This document records the browser DOM measurements taken on 2026-10-25 across 7 sections x 3 widths (390 / 1440 / 1920 CSS px) x light/dark themes (42 combinations). Under P4/P5, active product verification targets desktop widths (1280 / 1440 / 1920 CSS px); this 2026-10-25 record is preserved as historical evidence.*

## Scroll Owners

Visible elements with `overflowY` set to `auto` or `scroll` and `scrollHeight > clientHeight` were queried alongside `document.scrollingElement` and native `select[size]` listboxes:

| Section | 390px Light & Dark | 1440px & 1920px Light & Dark |
|---------|--------------------|------------------------------|
| `overview` | `document` | `document` |
| `categories` | `document` | `document` |
| `agents` | `document` | `document` |
| `background` | `document` + `picker:native:memory.facts.model-results` | Same |
| `main` | `document` + `picker:settings:tui-default-results` + `picker:settings:compaction.model-results` | Same |
| `drafts` (empty) | `document` | Content fits without scrolling |
| `compatibility` | `document` | `document` |

All three `picker:*` scroll elements are scoped native model selection listboxes rather than competing nested page scroll containers.

## Path Wrapping & Primary Action Hierarchy

The project `settings.json` path block in the `main` section uses wrappable monospace copy and was measured line by line with DOM text `Range` bounds:

| Viewport Width | Font Size | `clientWidth / scrollWidth` | Rightmost Text Edge / Container Right Edge |
|----------------|-----------|-------------------------------|--------------------------------------------|
| 390px | 17px | `316 / 316` | `347.17 / 353` |
| 1440px | 14px | `1115 / 1115` | `1371.59 / 1380` |
| 1920px | 14px | `1595 / 1595` | `1595.59 / 1860` |

Light and dark measurements were identical, with zero text clipping or container overflow. Across all 42 base combinations, each view had at most one visible, enabled primary action button (`btn-refresh-config` in the default browse state).

Interactive checks also confirmed:

- Staging a `Native` draft switches the header primary action to generate the `Native` preview.
- When a `Native` preview is already ready and a `Settings` draft is staged, the header action targets the `Settings` preview.
- When previews are ready for both groups, only the first valid save group is highlighted as primary while header buttons remain secondary navigation.
- While editing a candidate chain, "Add to drafts" takes primary prominence without competing with the header.

## Control Border Contrast

Computed browser styles for standard secondary buttons (such as "Refresh catalog") and inline selects (`.select-inline`):

- **Light theme**: Border `rgb(140, 140, 140)` against background `rgb(255, 255, 255)` -> **3.36:1** contrast ratio.
- **Dark theme**: Border `rgb(104, 111, 124)` against background `rgb(17, 19, 23)` -> **3.68:1** contrast ratio.

Primary action buttons use a high-contrast solid fill, and structural divider tokens are never used as interactive control borders.
