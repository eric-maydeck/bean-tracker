# UI rules

The design language in one place. Each rule says whether `checkLayout`
(`tests/ui/checkLayout.ts`, run by `npm run test:ui`) enforces it. UI feedback
from the user's manual phone checks becomes a new rule here, plus an assertion
when it can be automated.

| # | Rule | Enforced by `checkLayout`? |
|---|------|---|
| 1 | No sideways page scroll at any width (360–1280, and the user's phone in portrait 480×909 and landscape 1003×333). Wide tables scroll inside their own `.table-scroll`. | Yes |
| 2 | Buttons, badges and chips never wrap onto a second line. Exempt: picker buttons and Image Suggest candidate rows, whose titles and notes are content (badges inside them still never wrap). | Yes |
| 3 | No clipped or overflowing text in buttons, badges, chips or table cells. | Yes |
| 4 | Tap targets are at least 44×44 px on phones (≤480 px wide; CSS applies it ≤640). Exempt: column sort headers (`.sort-button` directly in a `th`): list view is dense by design, and compact is the phone view. | Yes (≤480; sort headers exempt) |
| 5 | Buttons sharing a row line up: same top, same height. | Yes |
| 6 | One place per action. An action lives in one spot, not duplicated across the page. | No (review) |
| 7 | Consistent wording: "Sign in" / "Sign out", the same verb for the same action everywhere. | No (review) |
| 8 | One icon set: Phosphor regular paths in `Icon.svelte` (fill only for the current tab); no emoji in navigation. | No (review) |
| 9 | Compact-view edit icons stay on one row; list-view edit actions are two fixed rows (save/cancel/delete over status actions). | Partly (rules 2 and 5) |
| 10 | Stats tiles are sized in `cqw` (container units), never fixed `rem`/`px` offsets. | Partly (rule 3 catches spill) |
| 11 | A viewport-conditional CSS override goes right after its base rule (equal specificity → source order wins). | No (review) |
| 12 | Every page/view state is in the URL (defaults omitted, case-insensitive, bad values ignored); inline edit state never is. | No (unit tests per parser) |
| 13 | Real-phone check (Firefox/Android, portrait and landscape) over the LAN dev server before pushing UI changes; `test:ui` passes first. | No (process) |
| 14 | Every group of options in a picker/select has a header, including a top/suggested group (user feedback 2026-10-04). | Yes for `role="option"` pickers (checkLayout rule 7); native selects: review |
| 15 | Chips and badges use short forms where a well-known one exists (e.g. BQ for Bean Conqueror); the full name stays in editors/forms (user feedback 2026-10-04). | No (review) |
| 16 | Bag text ("1.5kg (1.2kg left)") never wraps onto a second line, in any view (user requirement 2026-10-04). | Yes |
| 17 | A row of buttons on a phone never leaves one button orphaned on its own line at a different width: the buttons share the row evenly (grow to fill each line, no doubled gaps). Mark the row `data-button-row` (user feedback 2026-10-05). | Yes for `[data-button-row]` at ≤640 px (checkLayout rule 8) |
| 18 | Images are never cropped: show the whole image (`object-fit: contain`) on a fill color computed from it (`coffeeImage().fill`, neutral `#e6ddd2` until computed) (user feedback 2026-10-05). | Yes (checkLayout rule 9: any image whose box shape differs from its own) |
| 19 | An inline edit form always shows its Save and Cancel/Discard under the form, reachable in the viewport from where the user is editing; never only above it or missing (user feedback 2026-10-05). | Per state: `expectActionsUnderForm` (`layout.spec.ts`, `coffees-*-inline-edit-actions`) |
| 20 | An inline edit's action row (Save/Cancel/Delete/status icons) under the form stays on one line at phone width whenever its buttons fit, and looks the same in Cards, List and Compact (user feedback 2026-10-05). | Per state: `expectActionsUnderForm` |
| 21 | An inline edit's action buttons are all within the viewport at phone width, and inside their own card or row at every width (they wrap rather than spill into the next card), in every view (List's wide table must not push them off-screen) (user feedback 2026-10-05). | Per state: `expectActionRow` (`coffees-*-inline-edit-action-row`) |
| 22 | The spacing above and below an inline edit's action row is the same in every view (about 16 px above, 12-18 px below) (user feedback 2026-10-05). | Per state: `expectActionRow` |
| 23 | An inline edit's action row starts at the form's left edge, lined up with the form's own buttons (Clone, Edit), in every view (user feedback 2026-10-06). | Per state: `expectActionsUnderForm` |
| 24 | Buttons come in three tiers: solid primary (`.button`, one per area; `.button-solid` for a solid one in a variant's hue, e.g. green Save), tonal secondary (`.button-secondary`/`-danger`/`-success`: tint fill, same-hue text), and ghost (`.button-ghost`, text only) for navigation, cancel and discard. Hover and keyboard focus invert the fill (hover only where the device can hover); disabled buttons dim and don't react; no state changes the button's size. Text is at least 4.5:1 against its fill in both themes, at rest and on hover. View toggles keep their own look with a gentle accent-tint hover (user decision 2026-10-08). | No (review) |
| 25 | Every tab or panel carries a purposeful, substantial amount of content; sibling views stay balanced (no 15 tiles in one and 2 in the other) (user decision 2026-10-10). | No (review) |
| 26 | A tile affected by a mode switch (e.g. Settled/All ratings) carries that switch itself; every copy drives the same URL param, so all copies stay in sync (user feedback 2026-10-10). | No (review; `insights-ratings-switch-sync` state checks the insights copies) |
| 27 | Mode switches and mode labels get a concise tooltip that works on hover, touch and keyboard: a `title` + `aria-describedby` on the switch options, and the label's mode word as a small button opening a native `popover` (user feedback 2026-10-10). | No (review; `insights-ratings-tip` state checks the insights one) |
| 28 | Panels don't leave visible empty space (e.g. a lone tile in a 4-column row); flag it in reviews and fill it as tiles and charts arrive (user feedback 2026-10-10). | No (review) |

Opting out: put `data-layout-ignore="<why, and the backlog item that tracks it>"`
on the element. An empty reason fails the check.
