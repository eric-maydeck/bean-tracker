# Bean Conqueror `.xlsx` export — observed schema

Reference notes for the Bean Conqueror integration: the sheets and columns of Bean Conqueror's
`.xlsx` export. Sample values below are invented examples of each column's type and format.

The workbook has 4 sheets. Column numbers below are 1-indexed as they appear
in the file.

## `Beans` sheet

| # | Column | Sample value | Notes |
|---|--------|--------------|-------|
| 1 | Name | `"012 - Sample Washed Lot"` | Bean Conqueror prefixes with a running number |
| 2 | Roaster | `"Sample Roasters"` | |
| 3 | Roast date | `"01/15/2025"` | MM/DD/YYYY string |
| 4 | Roast type | `"Filter"` | |
| 5 | Degree of Roast | `2` | Numeric, likely maps to this app's `roast_levels.degrees_of_roast` |
| 6 | Roast type (again — duplicate header) | `null` | Second "Roast type" column, usually empty |
| 7 | Custom degree of Roast | `"-"` | |
| 8 | Blend | `"Single Origin"` | |
| 9 | Weight | `250` | Grams, maps to this app's `amount_g` |
| 10 | Cost | `20` | Maps to this app's `cost` |
| 11 | Flavor profile | `null` | |
| 12 | Cupping points | `null` | |
| 13 | Decaffeinated | `false` | Boolean, maps to this app's `decaf` |
| 14 | Website | `null` | |
| 15 | EAN / Articlenumber | `null` | |
| 16 | Notes | `null` | |
| 17 | Rating | `8` | 1-10 user rating — no equivalent field in this app today |
| 18 | Creation date | `"01/20/2025 09:00:00"` | MM/DD/YYYY HH:MM:SS |
| 19 | Bean Id | `"00000000-0000-4000-8000-000000000001"` | UUID — stable identity for diffing on re-import |
| 20 | Archived | `true` | Boolean — Bean Conqueror's own archived flag (distinct from this app's `status`) |
| 21 | 1. Country | `"Colombia"` | Maps to this app's `origin` (imprecisely — see below) |
| 22 | 1. Region | `null` | |
| 23 | 1. Farm | `null` | |
| 24 | 1. Farmer | `null` | |
| 25 | 1. Elevation | `null` | |
| 26 | 1. Variety | `null` | |
| 27 | 1. Processing | `"Washed"` | Maps to this app's `processing` |
| 28 | 1. Harvested | (not sampled) | |
| 29 | 1. Percentage | (not sampled) | Bean Conqueror supports multi-origin blends — "1. Country" etc. repeat as "2. Country" for blend component 2, and so on |
| 30 | 1. Bean certification | (not sampled) | |

## `Brews` sheet

| # | Column | Sample value | Notes |
|---|--------|--------------|-------|
| 1 | Grind Setting | `"1.5.0"` | |
| 2 | Ground Coffee (gr) | `18` | |
| 3 | Brew Temperature | `93` | |
| 4 | Preparation method | `"Cone Dripper - Paper A"` | |
| 5 | Bean Type | `"Sample Washed Lot"` | Free-text, not the bean name itself |
| 6 | Grinder | `"Hand Grinder A"` | |
| 7 | Grind Speed (rpm) | `0` | |
| 8 | Grind Time | `"0"` | |
| 9 | Profile | `null` | |
| 10 | Preparation tools | `null` | |
| 11 | Temperature Time | `"0"` | |
| 12 | Time | `"180"` | Brew time, seconds presumably |
| 13 | Bloom Time / Pre-infusion | `"0"` | |
| 14 | First drip time | `"0"` | |
| 15 | Amount of water | `300` | |
| 16 | Coffee Type | `null` | |
| 17 | Coffee Concentration | `null` | |
| 18 | Rating | `8` | Per-brew rating, 1-10 |
| 19 | Notes | `null` | |
| 20 | Beverage quantity | `0` | |
| 21 | Total dissolved solids % | `0` | |
| 22 | Extraction Yield % | `"0"` | |
| 23 | Creation Date | `"02/01/2025 08:30:00"` | MM/DD/YYYY HH:MM:SS |
| 24 | Brew Ratio | `"1 / 16.67"` | |
| 25 | Bean Age | `17` | Days, presumably (creation date - bean roast date) |
| 26 | Archived | `true` | |
| 27 | Bean Id | `"00000000-0000-4000-8000-000000000001"` | FK to `Beans.Bean Id` |
| 28 | Preparation Id | `"00000000-0000-4000-8000-000000000002"` | FK to `Methods.Preparation Id` |
| 29 | Mill Id | `"00000000-0000-4000-8000-000000000003"` | FK to `Grinders.Mill Id` |
| 30 | Water | `"Drop Mix A - bright"` | |

## `Methods` sheet

`Preparation method | Name | Preparation style | Preparation tools | Notes |
Archived | Creation date | Preparation Id`

## `Grinders` sheet

`Name | Notes | Archived | Creation date | Mill Id`

## Import notes

- Every sheet has a stable UUID identity column (`Bean Id`, `Preparation Id`,
  `Mill Id`) — this is what a diff-based, non-destructive import should key
  on, not name/date matching.
- `Beans` has its own `Archived` flag, separate from this app's
  `status`/`drank` lifecycle — needs a decision on whether/how these relate,
  or whether the Bean Conqueror table stays fully independent of `coffees`.
- Blend beans repeat the "1. Country" family of columns as "2. Country",
  "3. Country", etc. — column count varies per export depending on the
  highest blend-component count present. A real import needs to handle a
  variable number of "N. *" columns, not a fixed 30.
- Dates are MM/DD/YYYY (and MM/DD/YYYY HH:MM:SS for creation timestamps) —
  different format from this app's ISO 8601 storage.
