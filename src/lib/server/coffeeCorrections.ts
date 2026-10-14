// One-off data corrections to coffees, applied once at boot under their own
// marker by applyCoffeeFixes (coffees.ts), like the product page backfills: a
// fix only lands while the field still holds `from` (and the roaster matches).
import type { CoffeeFixBatch } from './coffees';

export const COFFEE_CORRECTIONS: CoffeeFixBatch[] = [
  {
    // Spotted by the archived backfill reviewers (2026-10-08), confirmed by the user.
    marker: 'coffee_corrections_2026_10_a',
    fixes: [
      // the bag and September's page read "Cantillo"
      { coffee_id: 194, roaster: 'September', field: 'coffee_name',
        from: 'Javier Castillo Copa de Oro #3 Washed Gesha', to: 'Javier Cantillo Copa de Oro #3 Washed Gesha' },
      // Scenery's page: Mario Hervas farms in Ecuador
      { coffee_id: 103, roaster: 'Scenery', field: 'origin', from: 'Colombia', to: 'Ecuador' },
      // Aviary's page: honey processed, "not a natural"
      { coffee_id: 101, roaster: 'Aviary', field: 'processing', from: 'Natural', to: 'Honey' }
    ],
    websites: [],
    tavilyCalls: []
  },
  {
    // Insights (2026-10-09): two imported labels that match no roast_levels row,
    // so roast-level ordering broke. Only these two prod coffees had them.
    marker: 'coffee_corrections_2026_10_b',
    fixes: [
      { coffee_id: 87, roaster: 'Sweet Bloom', field: 'roast_level', from: 'Med/Light', to: 'Medium/Light' },
      { coffee_id: 88, roaster: 'Sweet Bloom', field: 'roast_level', from: 'Light/Med', to: 'Light/Medium' }
    ],
    websites: [],
    tavilyCalls: []
  },
  {
    // The UTC "today" bug (fixed 2026-10-14): opened (and so thawed) 2026-10-04 23:07 MDT, recorded
    // as the UTC date. The only provable case on prod (read-only check, 2026-10-14).
    marker: 'coffee_corrections_2026_10_c',
    fixes: [{ coffee_id: 6, roaster: 'Still', field: 'frozen_end_date', from: '2026-10-05', to: '2026-10-04' }],
    websites: [],
    tavilyCalls: []
  }
];
