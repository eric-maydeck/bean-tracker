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
