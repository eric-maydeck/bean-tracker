# Coffee data standards

One stored form per coffee field. Every entry point normalizes to it: the add and edit forms, Fill from URL, Bean Base fills, BQ import and backfills. Existing rows are converted once to the same rules. Tracking issue: #76.

## General
- G1. External sources never change the site's order, separator, accents or capitalization. When a value matches any spelling already on the site ignoring case and accents, the site's spelling wins, and the accented one when the site has both (`Narino` → `Nariño`).
- G2. List fields (variety, region, certification, tasting notes) are separated by `, `. Never ` / `, ` // ` or ` And `.
- G3. Placeholders (`N/A`, `????????`, `-`) become blank.
- G4. A value that cannot be parsed is never guessed: it goes to review.

## Fields
| Field | Stored form | Examples |
|---|---|---|
| Cost | Number rounded to cents, shown in USD (`$20.99`). Per-user currency is a separate item. | `20.9900000000016` → `20.99` |
| Elevation | Thousands comma, ` masl` suffix, range with a spaced hyphen; `~` and `+` (and above) attach to the number; `>2,000` becomes `2,000+`. | `1,850 masl`, `1,700 - 1,900 masl`, `2,000+ masl`, `2,300 - 2,500+ masl`; `60-250` → `60 - 250 masl` |
| Farm | As named. Filled from the producer split below when blank. | `Finca Example` |
| Harvest | `2026`, `2025/26`, `January 2026`, `Q3 2025`, `Late 2025`; ranges `December 2025 - January 2026` (year on both sides). No year → review. | `January-April 2026` → `January 2026 - April 2026`; `2026 New Crop` → `2026` |
| Origin | Country name. | `Colombia` |
| Processing | Modifiers first, base method (Washed, Natural, Honey) last; one spelling per method from an alias table. Decaf reads `EA Decaf <base>`. | `Fully Washed` → `Washed`; `Tyoxidator Washed` → `Tyoxy Washed`; `Washed Decaf` → `EA Decaf Washed` |
| Producer | People joined with ` & `; a person with a company as `Person (Company)`. No honorifics (`Mr.`), `FCS` in capitals, `aka` lowercase, nicknames capitalized. A source that gives a farm goes to Farm; when the coffee name names a person and the source gives a washing station or exporter, the person is the producer, otherwise the station or exporter stays. | `Mr. Ana Example` → `Ana Example`; `Example Fcs` → `Example FCS`; `Ana and Luis Example` → `Ana & Luis Example`; `Ana Example, Example Co` → `Ana Example (Example Co)`; `Example Co by Ana Example` → `Ana Example (Example Co)` |
| Region | Smallest to largest, `, `-separated, no country (Origin holds it). Admin suffixes (County, Department, Zone) kept as given; G1 keeps the site's form. | `Huila, Colombia` → `Huila`; `Sidama, Town` → `Town, Sidama` |
| Roast level | One form per level; mixed levels lighter first. | `Medium/Light` → `Light/Medium` |
| Tasting notes | `, `-separated, each note in Title Case, no duplicates, misspellings fixed from an alias table. Descriptors (Juicy, Syrupy, Clean) are kept. | `peach, white tea` → `Peach, White Tea`; `Canteloupe` → `Cantaloupe` |
| Variety | One name per variety from an alias table, `Canonical (alias)` when a second name helps; listed in natural alphabetical order, numbers first. | `SL-28` → `SL28`; `Landraces` → `Landrace`; `JARC 74158` → `74158`; `SL9, Gesha Inca` → `SL9 (Inca Gesha)`; `SL34, SL28, Batian` → `Batian, SL28, SL34` |

## Producer and farm split
Only when the farm field is blank. Split the producer at its last ` - `, `, ` or ` / ` when the trailing part starts with Finca, Fincas, Hacienda, Granja or Estate, ends with Farm, or equals a farm already on the site. Anything else goes to review.

`Ana & Luis Example - Finca Example` → producer `Ana & Luis Example`, farm `Finca Example`.

## Entry points
Rules for any form or Fill from URL that writes coffee data. Other entry points (gear) follow them with their own field table in this doc.
- E1. A check runs on Save (add, clone, edit) and on Fill from URL. The dialog opens only when something would change; otherwise the action proceeds as before. Nothing is written until Save in the dialog.
- E2. The dialog has one row per field: Now, Proposed, and an approve/reject choice. Rows start undecided. Buttons: Approve all, Reject all, Cancel, Save. Save stays disabled until every choosable row is decided; its tooltip names the undecided fields.
- E3. Locked fields (elevation, origin, cost, harvest) have no reject option, shown with a lock. The lock covers format only: both sides are shown in the standard form, and a format-only change is applied silently (it appears read-only when the dialog opens for another row). A different value from a source can still be rejected.
- E4. A locked value that can't be formatted and has no formatted alternative blocks Save; the row says why and the only way on is Cancel and fix. A source value that can't be formatted is never filled.
- E5. Rejectable fields (everything else, including roast level, since people draw roast thresholds differently): a rejected value is stored as submitted. A value that can't be parsed is saved as typed, with a note and no toggle.
- E6. A blank roast date, cost or weight on Save adds a row that must be decided: Leave blank, or Cancel to fill it in. Fill from URL does not add these rows.
- E7. Fill from URL lists only fields where the fill would replace a non-empty value. Blank fields fill silently with the standard form; fields the source lacks stay empty. Cancel restores the exact prior state and keeps the URL.
- E8. Edit and clone check only fields changed since the last check (the source coffee for clone), so an answered value is not asked again. Add checks every non-blank field.
- E9. Roaster: a name matching a roaster already on the site (ignoring case and accents) proposes the site's spelling, otherwise the source's. If the user rejects a proposal that matches saved coffees, the field shows `N coffees already saved as "<name>"` with a See coffees link to the filtered coffee list.
- E10. Coffee name has no format rules; a roaster's own style (for example all lowercase) is kept.
- E11. Source order per field: the first usable value from the product page, then Loffee Labs. Accents: the site's spelling, then the product page's, then Loffee Labs'.
- E12. Automatic paths with no person to ask (BQ import) standardize and skip values that can't be parsed.
- E13. No new or background network calls: only the page fetch and Loffee Labs lookup a user triggers.
