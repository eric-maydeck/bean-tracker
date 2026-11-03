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
  },
  {
    // Bean origin insights (spec 2026-11-02): regions in one shape for the map tip. Top level per
    // country = the level coffee origins use (Colombia department, Ethiopia zone, Kenya county, others
    // their first-level division); a part below it gets its parent appended. Reviewed at preview; the
    // table is in docs/backlog/bean-origin-insights.md. Every from and roaster is copied from prod
    // (scripts/queries/region-review.sql).
    marker: 'coffee_corrections_2026_11_b',
    fixes: [
      { coffee_id: 76, roaster: "Bean's Beans", field: 'region', from: 'Caranavi Province, La Paz Department', to: 'Caranavi Province, La Paz' }, // level suffix dropped
      { coffee_id: 164, roaster: 'Shoebox', field: 'region', from: 'Campo Altos, Minas Girais, Brazil', to: 'Campos Altos, Minas Gerais, Brazil' }, // spelling (municipality Campos Altos, state Minas Gerais)
      { coffee_id: 91, roaster: 'Flower Child', field: 'region', from: 'Murumvya', to: 'Muramvya' }, // spelling
      { coffee_id: 169, roaster: 'Scenery', field: 'region', from: 'Gikungere, Butaganzwa, Kayanza Province', to: 'Gikungere, Butaganzwa, Kayanza' }, // level suffix dropped
      { coffee_id: 5, roaster: 'H&S', field: 'region', from: 'Gigante', to: 'Gigante, Huila' }, // parent added: Gigante is in Huila
      { coffee_id: 116, roaster: 'Shoebox', field: 'region', from: 'La Esperanza, La Plata, Colombia', to: 'La Esperanza, La Plata, Huila, Colombia' }, // parent added: La Plata is in Huila
      { coffee_id: 123, roaster: 'Shoebox', field: 'region', from: 'Alto Cañada, La Plata, Colombia', to: 'Alto Cañada, La Plata, Huila, Colombia' }, // parent added: La Plata is in Huila
      { coffee_id: 149, roaster: 'H&S', field: 'region', from: 'Quindio', to: 'Quindío' }, // accent
      { coffee_id: 150, roaster: 'H&S', field: 'region', from: 'Quindio', to: 'Quindío' }, // accent
      { coffee_id: 183, roaster: 'Shoebox', field: 'region', from: 'Narino', to: 'Nariño' }, // accent
      { coffee_id: 192, roaster: 'Shoebox', field: 'region', from: 'Narino', to: 'Nariño' }, // accent
      { coffee_id: 200, roaster: 'H&S', field: 'region', from: 'Gigante', to: 'Gigante, Huila' }, // parent added: Gigante is in Huila
      { coffee_id: 211, roaster: 'H&S', field: 'region', from: 'Gigante', to: 'Gigante, Huila' }, // parent added: Gigante is in Huila
      { coffee_id: 314, roaster: 'Luna', field: 'region', from: 'Urrao', to: 'Urrao, Antioquia' }, // parent added: Urrao is in Antioquia
      { coffee_id: 25, roaster: 'H&S', field: 'region', from: 'Saraguro', to: 'Saraguro, Loja' }, // parent added: Saraguro is in Loja province
      { coffee_id: 2, roaster: 'Scenery', field: 'region', from: 'Kamese Kebele, Galle, Limu Kossa Woreda, Jimma Zone', to: 'Kamese Kebele, Galle, Limu Kossa Woreda, Jimma' }, // level suffix dropped
      { coffee_id: 51, roaster: 'Shoebox', field: 'region', from: 'Shakiso', to: 'Shakiso, Guji' }, // parent added: Shakiso woreda is in Guji zone
      { coffee_id: 54, roaster: 'Shoebox', field: 'region', from: 'Chelbasa', to: 'Chelbesa, Gedeb, Gedeo' }, // spelling + parents: Chelbesa kebele, Gedeb woreda, Gedeo zone
      { coffee_id: 83, roaster: 'Subtext', field: 'region', from: 'Gedeb', to: 'Gedeb, Gedeo' }, // parent added: Gedeb woreda is in Gedeo zone
      { coffee_id: 177, roaster: 'walnuts', field: 'region', from: 'Gedeb', to: 'Gedeb, Gedeo' }, // parent added: Gedeb woreda is in Gedeo zone
      { coffee_id: 243, roaster: 'Shoebox', field: 'region', from: 'Shakiso', to: 'Shakiso, Guji' }, // parent added: Shakiso woreda is in Guji zone
      { coffee_id: 276, roaster: 'Scenery', field: 'region', from: 'Gora Kebele, Haro Wolabu, Guji Zone', to: 'Gora Kebele, Haro Wolabu, Guji' }, // level suffix dropped
      { coffee_id: 315, roaster: 'Luna', field: 'region', from: 'Chelbesa, Gedeb', to: 'Chelbesa, Gedeb, Gedeo' }, // parent added: Gedeb woreda is in Gedeo zone
      { coffee_id: 317, roaster: 'Luna', field: 'region', from: 'Gedeb', to: 'Gedeb, Gedeo' }, // parent added: Gedeb woreda is in Gedeo zone
      { coffee_id: 233, roaster: 'Brainwave Roasters', field: 'region', from: 'Antigua Valley', to: 'Antigua Valley, Sacatepéquez' }, // parent added: Antigua is in Sacatepéquez
      { coffee_id: 234, roaster: 'Brainwave Roasters', field: 'region', from: 'Antigua Valley', to: 'Antigua Valley, Sacatepéquez' }, // parent added: Antigua is in Sacatepéquez
      { coffee_id: 235, roaster: 'Brainwave Roasters', field: 'region', from: 'Antigua Valley', to: 'Antigua Valley, Sacatepéquez' }, // parent added: Antigua is in Sacatepéquez
      { coffee_id: 288, roaster: 'GWO', field: 'region', from: 'Santa Bárbara, Las Vegas', to: 'Las Vegas, Santa Bárbara' }, // order: municipality first, department last
      { coffee_id: 302, roaster: 'Shoebox', field: 'region', from: 'Francisco Morazan', to: 'Francisco Morazán' }, // accent
      { coffee_id: 306, roaster: 'PORT2050 COFFEE ROASTERS', field: 'region', from: 'Marcala', to: 'Marcala, La Paz' }, // parent added: Marcala is in La Paz department
      { coffee_id: 23, roaster: 'Lume', field: 'region', from: 'Iveti', to: 'Iveti, Machakos' }, // parent added: Iveti hills are in Machakos county
      { coffee_id: 181, roaster: 'walnuts', field: 'region', from: 'Kirinyaga County', to: 'Kirinyaga' }, // level suffix dropped
      { coffee_id: 202, roaster: 'Big Sur', field: 'region', from: 'Embu County', to: 'Embu' }, // level suffix dropped
      { coffee_id: 26, roaster: 'Shoebox', field: 'region', from: 'Volcan', to: 'Volcán, Chiriquí' }, // accent + parent added: Volcán is in Chiriquí
      { coffee_id: 147, roaster: 'H&S', field: 'region', from: 'Boquete', to: 'Boquete, Chiriquí' }, // parent added: Boquete is in Chiriquí
      { coffee_id: 231, roaster: 'Shoebox', field: 'region', from: 'Volcan', to: 'Volcán, Chiriquí' }, // accent + parent added: Volcán is in Chiriquí
      { coffee_id: 265, roaster: 'Love Letters Charming Coffees', field: 'region', from: 'Boquete', to: 'Boquete, Chiriquí' }, // parent added: Boquete is in Chiriquí
      { coffee_id: 122, roaster: 'H&S', field: 'region', from: 'Corazon de Chirinos', to: 'Corazon de Chirinos, Cajamarca' }, // parent added: Chirinos is in Cajamarca
      { coffee_id: 205, roaster: 'H&S', field: 'region', from: 'Corazon de Chirinos', to: 'Corazon de Chirinos, Cajamarca' }, // parent added: Chirinos is in Cajamarca
      { coffee_id: 219, roaster: 'H&S', field: 'region', from: 'Corazon de Chirinos', to: 'Corazon de Chirinos, Cajamarca' }, // parent added: Chirinos is in Cajamarca
      { coffee_id: 3, roaster: 'Shoebox', field: 'region', from: 'Nyaruguru', to: 'Nyaruguru, Southern Province' }, // parent added
      { coffee_id: 66, roaster: "Bean's Beans", field: 'region', from: 'Nyaruguru District', to: 'Nyaruguru District, Southern Province' }, // parent added
      { coffee_id: 88, roaster: 'Sweet Bloom', field: 'region', from: 'Gakenke District', to: 'Gakenke District, Northern Province' }, // parent added
      { coffee_id: 113, roaster: 'H&S', field: 'region', from: 'Nyamagabe', to: 'Nyamagabe, Southern Province' }, // parent added
      { coffee_id: 175, roaster: 'H&S', field: 'region', from: 'Nyamasheke', to: 'Nyamasheke, Western Province' }, // parent added
      { coffee_id: 216, roaster: 'Shoebox', field: 'region', from: 'Nyaruguru', to: 'Nyaruguru, Southern Province' }, // parent added
      { coffee_id: 301, roaster: 'H&S', field: 'region', from: 'Palestina', to: 'Palestina, Huila' }, // parent added: Palestina is in Huila
      { coffee_id: 322, roaster: 'Ceto', field: 'region', from: 'Palestina', to: 'Palestina, Huila' }, // parent added: Palestina is in Huila
      { coffee_id: 323, roaster: 'Ceto', field: 'region', from: 'Palestina', to: 'Palestina, Huila' }, // parent added: Palestina is in Huila
      { coffee_id: 310, roaster: 'Noumenon Coffee', field: 'region', from: 'Danche', to: 'Danche, Gedeb, Gedeo' }, // parents added: Danche is in Gedeb woreda, Gedeo zone
      { coffee_id: 114, roaster: 'H&S', field: 'region', from: 'Bani Ofair, Maghrib Ans', to: 'Bani Ofair, Maghrib Ans, Dhamar' }, // parent added: Dhamar governorate
      { coffee_id: 272, roaster: 'Scenery', field: 'region', from: 'San Jerónimo de San Pedro, Brunca', to: 'San Jerónimo, Pérez Zeledón, San José' }, // rewritten: district, canton, province
      { coffee_id: 47, roaster: 'The Picky Chemist', field: 'region', from: 'Cañas Verdes', to: 'Cañas Verdes, Boquete, Chiriquí' }, // parents added: district Boquete, province Chiriquí
      { coffee_id: 29, roaster: 'The Picky Chemist', field: 'region', from: 'Bench Maji, Oma', to: 'Oma, Bench Maji' }, // order: part first, zone last
      { coffee_id: 81, roaster: 'The Picky Chemist', field: 'region', from: 'Bench Maji, Oma', to: 'Oma, Bench Maji' }, // order: part first, zone last
      { coffee_id: 80, roaster: 'The Picky Chemist', field: 'region', from: 'Bench Maji, Surma', to: 'Surma, Bench Maji' } // order only: the zone is the top level (the 2021 zone split is unsettled in sources)
    ],
    websites: [],
    tavilyCalls: []
  }
];
