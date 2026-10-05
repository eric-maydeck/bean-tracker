# UI rules

The design language in one place. Each rule says whether `checkLayout`
(`tests/ui/checkLayout.ts`, run by `npm run test:ui`) enforces it. UI feedback
from the user's manual phone checks becomes a new rule here, plus an assertion
when it can be automated.

| # | Rule | Enforced by `checkLayout`? |
|---|------|---|
| 1 | No sideways page scroll at any width (360–1280). Wide tables scroll inside their own `.table-scroll`. | Yes |
| 2 | Buttons, badges and chips never wrap onto a second line. | Yes |
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
| 13 | Real-phone check (Firefox/Android) over the LAN dev server before pushing UI changes; `test:ui` passes first. | No (process) |
| 14 | Every group of options in a picker/select has a header, including a top/suggested group (user feedback 2026-10-04). | No (review) |
| 15 | Chips and badges use short forms where a well-known one exists (e.g. BQ for Bean Conqueror); the full name stays in editors/forms (user feedback 2026-10-04). | No (review) |

Opting out: put `data-layout-ignore="<why, and the backlog item that tracks it>"`
on the element. An empty reason fails the check.
