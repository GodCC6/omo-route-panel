# Compact routing editor implementation evidence

> Archived on 2026-10-29. This is dated evidence or a superseded plan, not current
> installation guidance or fresh release validation. See the [current documentation](../../README.md).
> Paths may be generalized for publication; recorded results and failures are retained.

Verification date: 2026-10-29.
Status: implemented and verified, with the pre-existing native evidence failure
documented below. The subsequent user-requested local installation is recorded
in [the installation evidence](local-installation-2026-10-29.md).
Contract: [interaction redesign revision 3](tui-interaction-redesign-2026-10-29.md).

## Baseline and reference

The implementation started from clean commit `73ea143`.
The official OMO Settings reference screenshot was supplied again by the user
on 2026-10-29. Its visible properties are a search prompt, ten aligned
label/value rows, one selection marker, a result position, a short description
and a short action footer. It is the visual reference, not evidence of this
extension's persistence semantics.

Before the TUI rewrite, the existing real-host acceptance was run with
`OMO_LAUNCHER_PATH=$HOME/.local/bin/omo`, isolated HOME directories,
synthetic providers and inference tripwires:

| Terminal | Theme | Baseline result |
| --- | --- | --- |
| 120 x 40 | dark | PASS, 1 test |
| 120 x 40 | light | PASS, 1 test |
| 70 x 24 | dark | PASS, 1 test |
| 70 x 24 | light | PASS, 1 test |
| 40 x 12 | dark | FAIL, existing scope-display assertion |
| 18 x 8 | dark | FAIL, existing scope-display assertion |

The two small-screen failures occur when the old acceptance expects the literal
`Current project` in a clipped frame. They are recorded as baseline failures,
not certified small-screen behavior or failures caused by the redesign.

Session-local baseline evidence is under
`/tmp/omo-redesign-baseline-{120,70}-{dark,light}` and
`/tmp/omo-redesign-baseline-{40,18}-dark`. Each directory contains real-host
`capture-*.json`, `events.json` and `terminal.ansi`. The `screens` directory
replays each captured component frame through xterm.js 5.5.0 and records PNG
and terminal-buffer text. There are 23 captured states per successful run and
9 states per small-screen run before its assertion failure.

The initial 120 x 40 dark render was inspected: it shows the retired four
sections, appended route details and full-height blank padding. These are
baseline observations, not the requested final layout.

## Boundaries

No personal installation, service, configuration, credential or upstream source
is changed by these tests. The personal extension is not reinstalled or reloaded.
Production installation is a separate handoff after implementation acceptance.

## Final verification

The native-only editor/declaration increment was independently checked with
strict TypeScript compilation, lint and 54 compiled Node regression cases, then
committed as `a0e3b7d`. The product documents were committed as `2f7a6ec`.

The final integrated `bun run validate:base` passed 178 tests, with zero
failures or skips. It includes strict type checking, lint, an isolated build,
compiled base tests and packaging checks. The TUI suite contains 46 regressions.
Language-server requests timed out waiting for fresh diagnostics; the strict
compiler, rather than those timeouts, is the type-check evidence.

The UI increment was committed as `86b40a8`. Field binding provenance was
added in `857f500`, separately from switch provenance. Identity/project
overrides remain distinct from the editable user leaf, including under a
disabled global gate. `9226d91` compacts individual JSONC declaration snippets
in Changes without exposing formatting newlines as escaped model text.

### Functional verdict

The real installed OMO host loaded this repository's compiled extension in
temporary HOME directories. Both host themes passed at 120 x 40, 70 x 24,
40 x 12 and 18 x 8. No inference or agent turn was started.

| Behavior | Result |
| --- | --- |
| Direct search, bracketed CJK/raw-ID paste, cursor/backspace/delete | PASS |
| Search Esc before close/discard, including action focus and no matches | PASS |
| More scope choices, immediate-parent cancellation, invalid category input | PASS |
| Route replacement, candidate reasoning and whole-chain acceptance | PASS |
| Two new categories, complete nested raw ID, added/reordered candidates | PASS |
| Hidden duplicate category is located without overwriting its chain | PASS |
| All four accepted-buffer comparison views and visible view chooser | PASS |
| Nudge/Sync read-only fields and local-processing details | PASS |
| Profile and Recall switch/category edits in the same native-file buffer | PASS |
| Dirty close defaults to Keep editing; explicit discard leaves bytes unchanged | PASS |
| Ordinary host reload discards accepted, uncommitted changes | PASS |
| One Apply writes native changes, preserves JSONC comment and Settings bytes | PASS |
| Save notification is observable before the real host reload | PASS |
| Undo after reopening restores the native declarations and keeps Settings intact | PASS |
| Catalog drift refuses stale Apply and emits no Saved notification | PASS |
| Reload failure reports Saved, clears the buffer, forbids a second Apply and permits reopened Undo | PASS |
| Pasted `apply`/`tab` remain search text while accepted changes stay unwritten | PASS |

All asynchronous assertions subscribe before their triggering key or control
event and use bounded event deadlines. Test controls alter only the synthetic
host registry or the synthetic reload boundary, never model inference.

### Visual verdict

Final real-host frame JSON, event histories and raw terminal streams are under
`/tmp/omo-redesign-final-{120,70,40,18}-{dark,light}`.
`screens/*.png` are xterm.js replays of the captured component frames, not
mockups. `sheet-*.png` provide contact sheets; the individual PNG and frame JSON
are authoritative if a contact-sheet crop is unclear.

The final matrix contains 63 frames per combination, 504 total.
ANSI-aware cell measurement found zero horizontal or vertical overflows:

| Terminal | Maximum component rows | Maximum cells per line |
| --- | --- | --- |
| 120 x 40 | 19 | 84 |
| 70 x 24 | 19 | 70 |
| 40 x 12 | 10 | 40 |
| 18 x 8 | 6 | 18 |

The host retains two rows outside the component. The PNG may therefore show
unused terminal area; the component itself does not pad to the full terminal.
The parent inspected the official reference, main light/dark layouts, compact
Changes, failure states, the 18-column contact sets, and the additional custom
category, reordered-chain, comparison and local-task screens. An independent
read-only reviewer inspected all 50 contact sheets from the earlier 44-state
matrix across both themes and all four dimensions, plus suspicious individual
PNGs, and returned a visual PASS. The later extra capture states were verified
by the parent; they were not part of that independent visual verdict.

Visual checks caught two issues before completion: host-generated ANSI was
being escaped and hiding a narrow selected Category row; and multiline JSONC
snippets produced literal formatting escapes in Changes. Both received source
fixes, regressions and fresh successful real-host matrix runs.

The first WebKit contact-sheet renderer sometimes clipped grid content even
when the individual PNG was correct. Contact sheets were regenerated with an
owned, synthetic-profile Chromium process; this was an evidence-tooling issue,
not a product-code fix. Temporary evidence is not a permanent image archive.

### Independent gate finding and correction

The independent review rejected the initial functional gate with one P1 finding:
bracketed-pasted `apply` could enter command dispatch and save an accepted
buffer; pasted `tab` could switch sections. This was a real implementation bug,
not an accepted limitation.

Commit `edb591b` separates printable/pasted text from decoded control keys before
dispatch. Text enters only the current input; a physical Space can still toggle
an editable boolean, but pasted Space cannot. Regressions exercise all 18 command
names as both bracketed paste and unwrapped text chunks, a child name input, and
the Space distinction. Actual-host dirty-buffer paste checks run in every final
matrix combination and confirm no write or section switch.

The parent verified the correction with the final 178-test base run and all eight
real-host acceptance runs. This correction was not submitted to a second
independent reviewer; the original rejection is preserved here rather than
misrepresented as approval of the corrected source.

### Task commits

| Commit | Verified increment |
| --- | --- |
| `2f7a6ec` | Product requirements, design and bilingual README |
| `a0e3b7d` | Native-only editor boundary and reasoning preservation |
| `86b40a8` | Compact TUI, focus and local child editors |
| `857f500` | Separate background binding provenance |
| `9226d91` | Compact JSONC declarations in Changes |
| `edb591b` | Printable/pasted text isolated from control commands |
| `527c53a` | Real-host workflow and failure-path acceptance |

The reviewer generated a local `.omo/evidence/` report despite the read-only
brief. The parent left that report untouched and uncommitted; it is not part of
the published source changes.

### Pre-existing native evidence failure

`OMO_LAUNCHER_PATH=$HOME/.local/bin/omo bun run validate:native`
completed with 19 passing tests and one failure:
`defaults: Recorded source contract for defaults is missing or ambiguous.`
The same command against clean pre-redesign source `73ea143` in an isolated
scratch copy completed with 14 passing tests and the identical one failure.
Neither run skipped or weakened the failing test.

This is the existing recorded background-source contract no longer matching
the selected installed OMO implementation. This redesign does not refresh
those source fragments or substitute guessed background semantics. Affected
task fields stay specifically unverified; explicit supported overrides remain
available, while Space cannot invert an unverified effective switch.

### Installed baseline cross-check

The historical acceptance fixture was also run directly against the existing
installed extension entry under `~/.local/share/omo-route-panel/9107f85`,
without replacing files or opening personal sessions. Results match the source
baseline: 120 x 40 and 70 x 24 pass in both themes; 40 x 12 and 18 x 8 fail the
old clipped `Current project` assertion in both themes. Evidence lives under
`/tmp/omo-redesign-installed-{120,70,40,18}-{dark,light}`.
These installed-baseline captures were collected after implementation began,
but still load the unchanged pre-redesign installed extension.
