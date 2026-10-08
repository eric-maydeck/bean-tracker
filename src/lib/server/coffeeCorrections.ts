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
  }
];
