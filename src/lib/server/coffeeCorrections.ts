// One-off data corrections to coffees, applied once at boot under their own
// marker by applyCoffeeFixes (coffees.ts), like the product page backfills: a
// fix only lands while the field still holds `from` (and the roaster matches).
import type { CoffeeFixBatch } from './coffees';

const R = 'Shoebox';

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
  },
  {
    // User-approved 2026-10-17: Shoebox rest windows start at 45 days (caffeinated) and run
    // 30-60 days (decaf).
    marker: 'coffee_corrections_2026_10_d',
    fixes: [
      { coffee_id: 3, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 38, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 39, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 192, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 193, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 216, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 217, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 218, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 231, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 255, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 26, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 48, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 51, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 53, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 54, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 293, roaster: R, field: 'rest_days_low', from: 56, to: 45 },
      { coffee_id: 108, roaster: R, field: 'rest_days_low', from: 42, to: 45 },
      { coffee_id: 243, roaster: R, field: 'rest_days_low', from: 42, to: 45 },
      { coffee_id: 123, roaster: R, field: 'rest_days_low', from: 60, to: 45 },
      { coffee_id: 167, roaster: R, field: 'rest_days_low', from: 28, to: 30 },
      { coffee_id: 168, roaster: R, field: 'rest_days_low', from: 28, to: 30 },
      { coffee_id: 109, roaster: R, field: 'rest_days_low', from: 2, to: 30 },
      { coffee_id: 109, roaster: R, field: 'rest_days_high', from: 14, to: 60 },
      { coffee_id: 110, roaster: R, field: 'rest_days_low', from: 2, to: 30 },
      { coffee_id: 110, roaster: R, field: 'rest_days_high', from: 14, to: 60 }
    ],
    websites: [],
    tavilyCalls: []
  },
  {
    // Bean origin insights (spec 2026-11-02, reviewed table): consolidate producer, farm and variety
    // spellings so the leaderboards group them. Every `from` and roaster copied from prod
    // (scripts/queries/origin-fix-check.sql).
    marker: 'coffee_corrections_2026_11_a',
    fixes: [
      // producers
      { coffee_id: 244, roaster: 'Anamorphic', field: 'producer', from: 'Tamiru Tadesse', to: 'Tamiru Tadesse Tesema' },
      { coffee_id: 245, roaster: 'Anamorphic', field: 'producer', from: 'Tamiru Tadesse', to: 'Tamiru Tadesse Tesema' },
      { coffee_id: 143, roaster: 'XLIII', field: 'producer', from: 'Dwight Aguilar', to: 'Dwight Aguilar Masías' },
      { coffee_id: 220, roaster: 'Scenery', field: 'producer', from: 'Yulisa Carhuallocllo Arévalo', to: 'Yulisa Carhuallocllo' },
      { coffee_id: 21, roaster: 'The Picky Chemist', field: 'producer', from: 'Bernard Uhe, Finca El Dorado', to: 'Bernard Uhe' },
      { coffee_id: 231, roaster: 'Shoebox', field: 'producer', from: 'Eyla365, Abner Caballero', to: 'Abner Caballero, Eyla365' },
      { coffee_id: 276, roaster: 'Scenery', field: 'producer', from: 'Mayole Coffee (Ture Waji)', to: 'Ture Waji' },
      { coffee_id: 48, roaster: 'Shoebox', field: 'producer', from: 'Mr. Tadese Teko', to: 'Tadese Teko' },
      { coffee_id: 275, roaster: 'Wooly Lamb Coffee Roasters', field: 'producer', from: 'Mr. Tadese Teko', to: 'Tadese Teko' },
      { coffee_id: 2, roaster: 'Scenery', field: 'producer', from: 'Haider Aba Mecha, Kebena Estate', to: 'Haider Aba Mecha' },
      { coffee_id: 291, roaster: "Bean's Beans", field: 'producer', from: 'Giorgio & Gina Bressani', to: 'Bressani family' },
      // farms
      { coffee_id: 90, roaster: 'Flower Child', field: 'farm', from: 'El Paraiso', to: 'Finca El Paraiso' },
      { coffee_id: 213, roaster: "Bean's Beans", field: 'farm', from: 'La Terraza', to: 'Finca La Terraza' },
      { coffee_id: 209, roaster: "Bean's Beans", field: 'farm', from: 'Llactapata', to: 'Finca Llaqtapata' },
      // varieties: formatVariety(from), found by the LIKE query (rows it leaves unchanged are omitted)
      { coffee_id: 20, roaster: 'H&S', field: 'variety', from: 'Bourbon Ají', to: 'Ají' },
      { coffee_id: 24, roaster: 'Lume', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 25, roaster: 'H&S', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 49, roaster: 'H&S', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 77, roaster: "Bean's Beans", field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 128, roaster: 'Hydrangea', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 129, roaster: 'Hydrangea', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 229, roaster: 'H&S', field: 'variety', from: 'Typica Mejorado', to: 'Mejorado' },
      { coffee_id: 58, roaster: "Bean's Beans", field: 'variety', from: 'Landrace, mostly 74158', to: 'Landrace, 74158' },
      { coffee_id: 99, roaster: 'Sey', field: 'variety', from: 'Field Blend', to: 'Field blend' },
      { coffee_id: 120, roaster: 'Luminous', field: 'variety', from: 'Bourbon Sidra', to: 'Sidra' },
      { coffee_id: 300, roaster: 'delicate coffee roasters', field: 'variety', from: 'Kurume, Welicho', to: 'Kurume, Wolisho' }
    ],
    websites: [],
    tavilyCalls: []
  }
];
