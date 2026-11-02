// Bean data backfill batches (docs/bean-data-contract.md). Each is applied once at boot under its
// own marker (applyCoffeeFixes, coffees.ts). Data only, appended by
// `python3 -I scripts/backfill-review.py fields-export`: never type or edit a `from` by hand.
// The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const BEAN_DATA_BACKFILLS: CoffeeFixBatch[] = [
{
  "marker": "bean_data_backfill_2026_11",
  "deletes": [
    { "coffee_id": 74, "roaster": "Bean's Beans", "coffee_name": "Gesha Village Oma Natural 26/147" }
  ],
  "fixes": [
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Acevedo, Huila"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Nyaruguru"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,900masl"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Samuel Diego Bermudez"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1960 masl"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Chelbesa Washing Station"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Worka Chelbesa, Gedeb, Gedeo"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1900 - 2200 masl"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 25/26"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "producer",
      "from": null,
      "to": "Gakenke Washing Station"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "variety",
      "from": null,
      "to": "Yellow Bourbon"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "region",
      "from": null,
      "to": "Kayanza"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "elevation",
      "from": null,
      "to": "1.650-1.950"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "farm",
      "from": null,
      "to": "Bnivaans Estate"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "James Kungu Kariuki"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Ndarugo Ward, Kiambu"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Batian, Ruiru 11"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "1930 masl"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "harvest_time",
      "from": null,
      "to": "November 2025 - January 2026"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "farm",
      "from": null,
      "to": "Gititu Coffee Factory"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Gititu Coffee Growers Cooperative Society"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Githunguri, Kiambu"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, Batian"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "1850 masl"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "harvest_time",
      "from": null,
      "to": "November 2025 - January 2026"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Fortuna"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Fortuna"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Bourbon Aji"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Heirloom"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2,100 m"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 11, 2025"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "producer",
      "from": null,
      "to": "Luz Helena Salazar"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "region",
      "from": null,
      "to": "Quindío"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "elevation",
      "from": null,
      "to": "1500 masl"
    },
    {
      "coffee_id": 23,
      "roaster": "Lume",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, Batian"
    },
    {
      "coffee_id": 23,
      "roaster": "Lume",
      "field": "region",
      "from": null,
      "to": "Iveti"
    },
    {
      "coffee_id": 23,
      "roaster": "Lume",
      "field": "elevation",
      "from": null,
      "to": "1700-1800 masl"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "farm",
      "from": null,
      "to": "Finca Soledad"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "region",
      "from": null,
      "to": "Imbabura"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "elevation",
      "from": null,
      "to": "1515 masl"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Juan Peña"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Hacienda La Papaya"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Saraguro"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Bench Maji"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1909 – 2063 m"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "08/01/2025 - 16/01/2025"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Bench Maji"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1909 – 2063 m"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "17/01/2025 - 22/01/2025"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Bench Maji – Oma"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1931 – 2049 m"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Emerson Felipe Narváez"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Turpial"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Cumbitara, Nariño"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "2,200 m"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Bernard Uhe"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Dorado"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "variety",
      "from": null,
      "to": "74158, 74112"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "region",
      "from": null,
      "to": "Ako, Sidama"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "farm",
      "from": null,
      "to": "Finca Llaqtapata"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "variety",
      "from": null,
      "to": "SL9 / Inca Gesha"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "region",
      "from": null,
      "to": "Inkawasi, Cusco"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "elevation",
      "from": null,
      "to": "2,300 masl"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Gedeb, Yirgacheffe"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "74110, 74112"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "2000+ masl"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Gedeb, Yirgacheffe"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "74110, 74112"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "2000+ masl"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Shakiso, Guji"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Shakiso, Guji"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "producer",
      "from": null,
      "to": "Aaga Dinsa"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "variety",
      "from": null,
      "to": "Heirloom"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "elevation",
      "from": null,
      "to": "2000+ masl"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Kianderi Factory"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "SL-34, Batian, SL-28, Ruiru 11"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Ruera Estate"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Kiambu"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Batian, SL-34, SL-28, Ruiru 11"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1577 masl"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Hacienda La Esmeralda"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Cañas Verdes"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Cañas Verdes"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Geisha"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "+1700 masl"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "December 23rd, 2025"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Worka, Yirgacheffe"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Abel Salinas"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca Arashi"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Shakiso"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "2000-2150masl"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Getachew Zeleke"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Tero Farm"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Chelbasa"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Nueva Alianza"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Mejorado"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1820 masl"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Rift Valley Coffee Caucus"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Ruiru 11, Batian, SL28"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "Western Rift Valley"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1800 - 1900 masl"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Nueva Alianza"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Sidra"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1820 masl"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Landrace, mostly 74158"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Gute Village, Bona Zuria, Sidama"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "2350 masl"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Neel and Kavita Vohora"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "farm",
      "from": null,
      "to": "Gaia Estate"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Karatu, Arusha"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1650-1800 masl"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Jhon Didier Trujillo"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "farm",
      "from": null,
      "to": "Villa Flor"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Chiroso"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "Urrao, Antioquia"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "1950 masl"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Alina Milagros"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Inca Gesha"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "2400 masl"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "harvest_time",
      "from": null,
      "to": "September 2025"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Keramo, Sidama"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,300 masl"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Kayanza"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Bressani family"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "farm",
      "from": null,
      "to": "Finca San Jerónimo Miramar"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Sidra"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "Panimaquib"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "1,450-1500 masl"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "harvest_time",
      "from": null,
      "to": "February 2026"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Bressani family"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "farm",
      "from": null,
      "to": "Finca San Jerónimo Miramar"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Typica San Roque"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "Panimaquib"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "1,524 masl"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "harvest_time",
      "from": null,
      "to": "February 2026"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Ikizere woman's group"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Nyaruguru District"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1700 - 2000 masl"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "El Mirador"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Ashenafi Getaneh"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Aricha, Yirgacheffe"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "2100masl"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Batian, Ruiru"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1700-1800masl"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Mulish, Guji"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1800-1950masl"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Bench Maji"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1931-2040 masl"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Butanyerera"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Local Bourbon cultivars"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1900-2200 masl"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Yulissa Chambi"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Red Catuai"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Caranavi Province, La Paz Department"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1550 masl"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Juan Peña"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Yunguilla Valley, Azuay"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1400-1700 masl"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Landrace"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Bona Zuria, Sidama"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,200 masl"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Landrace"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,250 - 2,400 masl"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Bench Maji – Surma"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1909 – 2063 m"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Bench Maji – Oma"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1931 – 2049 m"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "region",
      "from": null,
      "to": "Tolima"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "farm",
      "from": null,
      "to": "El Espejo"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "producer",
      "from": null,
      "to": "Elver Rodriguez"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "farm",
      "from": null,
      "to": "El Mirador"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "elevation",
      "from": null,
      "to": "1770 masl"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "producer",
      "from": null,
      "to": "Rambagirakawa"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "region",
      "from": null,
      "to": "Gakenke District"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "elevation",
      "from": null,
      "to": "1800-2200 masl"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 90,
      "roaster": "Flower Child",
      "field": "variety",
      "from": null,
      "to": "Sidra"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "region",
      "from": null,
      "to": "Murumvya"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "elevation",
      "from": null,
      "to": "1,700-2,100 meters"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "farm",
      "from": null,
      "to": "La Pradera"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "region",
      "from": null,
      "to": "Santa María, Huila"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "elevation",
      "from": null,
      "to": "2,050 meters"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "harvest_time",
      "from": null,
      "to": "August 2025"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Elkin Guzman"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "1550-1700 masl"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Elkin Guzman"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "1550-1700 masl"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Elkin Guzman"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "1550-1700 masl"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Elkin Guzman"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "farm",
      "from": null,
      "to": "El Mirador"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Orange Bourbon"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "Semester 2025 Q3"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Field Blend"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Muramvya"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,700 - 2,100 masl"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "May 2025"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "William Ortiz"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "farm",
      "from": null,
      "to": "La Cabaña"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Pitalito, Huila"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,700 masl"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "August 2025"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Shibru Dube"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Dega, Kurume"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "Gedeb, Yirgacheffe"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "2,100 masl"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Diego Parra"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "farm",
      "from": null,
      "to": "La Hacienda"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Pitalito, Huila"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,700 masl"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "October 2025"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Mario Jose Hervas"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Finca El Meridiano"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Mejorado"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Nanegal, Pichincha"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1350-1500 masl"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 25/26"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Matte Matosa"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "JARC 74158 & 74112"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Doko, Bensa, Sidama"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Ombligon"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Ombligon"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Pablo Guerrero"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "El Obraje"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Emiliano"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Finca El Holguín"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "La Esperanza, La Plata, Colombia"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,880masl"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Wilbert Almanza"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "SL9"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Inkawasi, Cusco"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,900 masl"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Armando Hurtado"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "SL9"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Pacaypata, Cusco"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,100 masl"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Yuri Ordoñez"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "farm",
      "from": null,
      "to": "El Salado"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "San Pedro de Cartago, Nariño"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "2000 masl"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "Sept 2025"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Eymar Rosero"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "farm",
      "from": null,
      "to": "El Hatillo"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Buesaco, Nariño"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "2000 masl"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "August 2025"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Yilver Pajoy"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Finca El Arrayan"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Alto Cañada, La Plata, Colombia"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1860masl"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Long Miles Coffee Project"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "Bourbon"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Muramvya"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "1760 masl"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Long Miles Coffee Project"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "Bourbon"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Muramvya"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "1760 masl"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2300 m"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 – January 2026"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Heirloom"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1900–2100 m"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 – January 2026"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Dwight Aguilar"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Nueva Alianza"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "Cusco"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1820 masl"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Samuel Diego Bermudez"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1960 masl"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Simon Brown & Merlith Cruz"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Las Etiopes"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "El Porvenir, Jaén, Cajamarca"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1950 - 2050 masl"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "25/26"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Wilson Mamani Contreras"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Carmenpata"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Mesapata, Yanatile, Calca, Cusco"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "2025 masl"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "September 2025"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Mario Fernando Gómez"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "La Soledad"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Ají"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Acevedo, Huila"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1600 masl"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "25/26"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Diofanor Ruiz"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Divisa"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Java"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Quindio"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Diofanor Ruiz"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Divisa"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Papayo"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Quindio"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Diwan Coffee by Yessica & Diego Parra"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Pitalito, Huila"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Mario Jose Hervas"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Finca El Meridiano"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Mejorado"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "San Jose de Minas, Nanegal, Pichincha"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1350-1500 masl"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "crop 25/26"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Diwan Coffee by Yessica & Diego Parra"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Aji"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila, Colombia"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Diwan Coffee by Yessica & Diego Parra"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Aji"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila, Colombia"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "local bourbon varietals"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Songwe, Tanzania"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Dwight Aguilar Masías"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Nueva Alianza"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "Santa Teresa, La Convención, Cusco"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1,820 meters above sea level"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Luis Edgar Camacho"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "La Palma"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Fragrancia"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Palestina, Huila, Colombia"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,720masl"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Lisbeth Quispe"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "SL9"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Sandia Valley, Puno"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,950 masl"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "November 2025"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "William Ortiz"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Chiroso"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Pitalito, Huila"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "1,700 masl"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "February 2026"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marcelo Assis and Flavio Silva"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Arara, IBC12, Paraiso"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Campo Altos, Minas Girais, Brazil"
    },
    {
      "coffee_id": 166,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 166,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Caturra field blend"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Ombligon"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Ombligon"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Gikungere, Butaganzwa, Kayanza Province"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1600-1750 masl"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "25/26"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Emerson Felipe Narváez"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Turpial"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Cumbitara, Nariño"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "2,200 m"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "producer",
      "from": null,
      "to": "Lino Rodriguez"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "farm",
      "from": null,
      "to": "Finca Betania"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "elevation",
      "from": null,
      "to": "1800 masl"
    },
    {
      "coffee_id": 175,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Kageyo Washing Station"
    },
    {
      "coffee_id": 175,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Nyamasheke"
    },
    {
      "coffee_id": 175,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Teodomiro Jiménez"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca La Toronja"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Typica field blend"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "producer",
      "from": null,
      "to": "Zerihun Birhanu"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "variety",
      "from": null,
      "to": "74112"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "elevation",
      "from": null,
      "to": "2000-2150masl"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "variety",
      "from": null,
      "to": "SL-09"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Batian, Ruiru 11"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "elevation",
      "from": null,
      "to": "1600-1800 masl"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "region",
      "from": null,
      "to": "Kirinyaga County"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Ngozi"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Local Bourbon varietals"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Jeisson Burbano"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Finca Costa Rica"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Narino"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,930masl"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "producer",
      "from": null,
      "to": "Hazel Juliana Guevara"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "farm",
      "from": null,
      "to": "Finca La Terraza"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "variety",
      "from": null,
      "to": "Chiroso"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "elevation",
      "from": null,
      "to": "1650-1900 masl"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "variety",
      "from": null,
      "to": "Sudan Rume"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "region",
      "from": null,
      "to": "Risaralda"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "elevation",
      "from": null,
      "to": "1750-1800masl"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "El Placer, Quindío"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "producer",
      "from": null,
      "to": "Abel Salinas"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "farm",
      "from": null,
      "to": "Finca Arashi"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "variety",
      "from": null,
      "to": "Mejorado"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "elevation",
      "from": null,
      "to": "1900 masl"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "harvest_time",
      "from": null,
      "to": "late 2025"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "variety",
      "from": null,
      "to": "SL9"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "region",
      "from": null,
      "to": "Pacaybamba, Cusco"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "elevation",
      "from": null,
      "to": "2,200 meters above sea level"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "harvest_time",
      "from": null,
      "to": "October 2025"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Carlos Estrella"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "La Estrella"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Narino"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "2,000masl"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "producer",
      "from": null,
      "to": "Javier Cantillo Vega"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "farm",
      "from": null,
      "to": "Finca Los Delirios"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "region",
      "from": null,
      "to": "Divino Niño, Suaza, Huila"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "elevation",
      "from": null,
      "to": "1730 masl"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "producer",
      "from": null,
      "to": "Oscar Riascos"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "farm",
      "from": null,
      "to": "La Macarena"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "elevation",
      "from": null,
      "to": "1,900 masl"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "farm",
      "from": null,
      "to": "Nueva Alianza"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Orange Gesha"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "elevation",
      "from": null,
      "to": "1820 masl"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "variety",
      "from": null,
      "to": "SL28"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "region",
      "from": null,
      "to": "Kiambu"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "harvest_time",
      "from": null,
      "to": "Dec-Jan 2025/26"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Heirloom"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1900–2100 m"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 – January 2026"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Ernedis Rodriguez"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Gigante"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Caturra field blend"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2035-2250 masl"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 - January 2026"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "farm",
      "from": null,
      "to": "Kivanga Estate"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Morris Njage"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Embu County"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,800 m"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "November 2025"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Heirloom"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2,100 m"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 11, 2025"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "El Cerro"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Efrain Carhuallocllo"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Corazon de Chirinos"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Idelsa Geraldo Facundo"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "farm",
      "from": null,
      "to": "Finca El Barejon"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "La Coipa, San Ignacio, Cajamarca, Peru"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "1800 masl"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "harvest_time",
      "from": null,
      "to": "May 2025 - October 2025"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "farm",
      "from": null,
      "to": "Granja Paraiso 92"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "elevation",
      "from": null,
      "to": "1950masl"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Gilber Huayllas"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "SL-09"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Inkawasi, Cusco, Peru"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "2400 masl"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Eduardo Armero"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "farm",
      "from": null,
      "to": "El Mirador"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "La Argentina, Huila, Colombia"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1700 masl"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Juliana Guevara and Wbeimar Lasso"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "farm",
      "from": null,
      "to": "La Terraza"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Java"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "La Argentina, Huila, Colombia"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1950 masl"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Rex Raguni"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Blue Mountain, Caturra, Mundo Novo"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Western Highlands, Papua New Guinea"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1850 masl"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Juan Peña"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Sidra"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Zamora-Chinchipe, Ecuador"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1800 masl"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "El Edén"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Mesitas, Garzón, Huila"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1800 - 1900 masl"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Nyaruguru"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,700-2,000masl"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Yulisa Carhuallocllo Arévalo"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "El Cerro"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "El Corazón, Chirinos, Jaén, Cajamarca"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1875 - 1950 masl"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "crop 25/26"
    },
    {
      "coffee_id": 221,
      "roaster": "Lume",
      "field": "region",
      "from": null,
      "to": "Kayanza"
    },
    {
      "coffee_id": 221,
      "roaster": "Lume",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Thiririka Farmers Cooperative Society"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Kiambu"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Ruiru 11, Batian, SL28, SL34"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Bernard Uhe"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Dorado"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Emerson Felipe Narváez"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Turpial"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Cumbitara, Nariño"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "2,200 m"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "San Agustín Crop Management"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,740 masl"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "San Agustín Crop Management"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,740 masl"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2300 m"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 – January 2026"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Abel Salinas"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca Arashi"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "producer",
      "from": null,
      "to": "Abel Salinas"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "farm",
      "from": null,
      "to": "Finca Arashi"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "variety",
      "from": null,
      "to": "Mejorado"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "elevation",
      "from": null,
      "to": "1900 masl"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "harvest_time",
      "from": null,
      "to": "Late 2025"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Eyla365, Abner Caballero"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Volcan"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,500masl"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "variety",
      "from": null,
      "to": "Heirloom"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Ethiopian landrace"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Gedeb, Gedeo"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,200 masl"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Ethiopian landrace"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Gedeb, Gedeo"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,200 masl"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 243,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Shakiso"
    },
    {
      "coffee_id": 243,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Tamiru Tadesse"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "farm",
      "from": null,
      "to": "Alo Coffee Murgo Station"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "JARC 74158"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Alo village, Bensa woreda, Sidama"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "2340 - 2480 masl"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 - January 2026"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": null,
      "to": "Tamiru Tadesse"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "farm",
      "from": null,
      "to": "Alo village main station"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": null,
      "to": "JARC 74158"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "region",
      "from": null,
      "to": "Alo village, Bensa woreda, Sidama"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "elevation",
      "from": null,
      "to": "2340 - 2480 masl"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 - January 2026"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, Batian"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1,700–1,800 masl"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, Batian"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1,700–1,800 masl"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Othaya, Nyeri"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,800–1,850 meters"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Othaya, Nyeri"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,800–1,850 meters"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "producer",
      "from": null,
      "to": "Mubuga Washing Station"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "variety",
      "from": null,
      "to": "Bourbon"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "region",
      "from": null,
      "to": "Ngozi"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "elevation",
      "from": null,
      "to": "1,661 masl"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Gesha Village Coffee Estate"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Bench Maji"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1931-2040 masl"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Samuel Diego Bermudez"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1960 masl"
    },
    {
      "coffee_id": 255,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Yoiner Mosquera"
    },
    {
      "coffee_id": 255,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 255,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Palestina, Huila"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Landrace (Heirloom)"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2,350–2,400 meters"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025 – January 2026"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Joaquina Montoya"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "farm",
      "from": null,
      "to": "Finca Los Pinos"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Intibucá"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,770 masl"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January–April 2026"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Ethiopian heirloom"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1900-2200 masl"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "December 20-24, 2025"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "2,300 meters"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 265,
      "roaster": "Love Letters Charming Coffees",
      "field": "producer",
      "from": null,
      "to": "Richard Arauz"
    },
    {
      "coffee_id": 265,
      "roaster": "Love Letters Charming Coffees",
      "field": "region",
      "from": null,
      "to": "Boquete"
    },
    {
      "coffee_id": 265,
      "roaster": "Love Letters Charming Coffees",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 267,
      "roaster": "Love Letters Charming Coffees",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 269,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Tamiru Tadesse Tesema"
    },
    {
      "coffee_id": 269,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 269,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Alo Village, Bensa, Sidama"
    },
    {
      "coffee_id": 269,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,400 - 2,550 masl"
    },
    {
      "coffee_id": 269,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "variety",
      "from": null,
      "to": "74158"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "region",
      "from": null,
      "to": "Bensa, Sidama"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "elevation",
      "from": null,
      "to": "2,410 masl"
    },
    {
      "coffee_id": 275,
      "roaster": "Wooly Lamb Coffee Roasters",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 275,
      "roaster": "Wooly Lamb Coffee Roasters",
      "field": "variety",
      "from": null,
      "to": "Ethiopian Landrace"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "JARC 74110 & 74112"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Gora Kebele, Haro Wolabu, Guji Zone"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "2200 - 2500 masl"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "producer",
      "from": null,
      "to": "Deiro Garcia"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "farm",
      "from": null,
      "to": "Finca Lord Voldemort"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "region",
      "from": null,
      "to": "Pitalito, Huila"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "elevation",
      "from": null,
      "to": "1600masl"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Heirloom Ethiopian varieties"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "region",
      "from": null,
      "to": "Gedeb, Yirgacheffe"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "elevation",
      "from": null,
      "to": "2100–2300 masl"
    },
    {
      "coffee_id": 289,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 289,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "74112"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca Galaxia"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Tarqui, Huila"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Caturra"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Giorgio & Gina Bressani"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "farm",
      "from": null,
      "to": "Finca San Jerónimo Miramar"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": null,
      "to": "Volcán Atitlán"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "elevation",
      "from": null,
      "to": "1500-1700 masl"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "25 smallholders in San Pedro Ocopetatillo"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "San Pedro Ocopetatillo, Sierra Mazateca, Oaxaca"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Mundo Nuvo, Typica, Bourbon, Caturra"
    },
    {
      "coffee_id": 294,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 294,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 295,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 295,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 296,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 296,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Getachew Zeleke"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Tero Farm"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "producer",
      "from": null,
      "to": "Mikiyas Bogale"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "elevation",
      "from": null,
      "to": "1950-2150 masl"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "elevation",
      "from": null,
      "to": "1700 masl"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "producer",
      "from": null,
      "to": "Tesfaye Bekele"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "farm",
      "from": null,
      "to": "Suke Quto"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "variety",
      "from": null,
      "to": "Kurume, Welicho"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "region",
      "from": null,
      "to": "Guji"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "certification",
      "from": null,
      "to": "Organic, Rainforest Alliance"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "El Silencio"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Jailer Plazas"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Palestina"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Alexia Meija"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "Finca Liquidambar"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "variety",
      "from": null,
      "to": "Parainema"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Francisco Morazan"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,650masl"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "producer",
      "from": null,
      "to": "The Rift Valley Coffee Caucus"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "variety",
      "from": null,
      "to": "Batian, Ruiri, SL28"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "region",
      "from": null,
      "to": "Western Rift Valley"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "elevation",
      "from": null,
      "to": "1800-1900 masl"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "producer",
      "from": null,
      "to": "Fabio Caballero Jr."
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "farm",
      "from": null,
      "to": "Las Virginias"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "region",
      "from": null,
      "to": "Marcala"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "elevation",
      "from": null,
      "to": "1750masl"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "farm",
      "from": null,
      "to": "Finca San Jerónimo Miramar"
    },
    {
      "coffee_id": 310,
      "roaster": "Noumenon Coffee",
      "field": "variety",
      "from": null,
      "to": "74110 and 74112"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Dahwe CWS"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Gisagara District, Southern Province"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1630 masl"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "74110 & 74112"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Tima, Odo Shakiso, Guji"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "2000 - 2150 masl"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "farm",
      "from": null,
      "to": "La Cartagena"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "variety",
      "from": null,
      "to": "Chiroso"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "region",
      "from": null,
      "to": "Urrao"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "harvest_time",
      "from": null,
      "to": "Feb 2026"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "variety",
      "from": null,
      "to": "Kurume & Wolisho"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "region",
      "from": null,
      "to": "Chelbesa, Gedeb"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "harvest_time",
      "from": null,
      "to": "Dec-Jan 2025/26"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, & Batian"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "harvest_time",
      "from": null,
      "to": "Dec-Jan 2025/26"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "variety",
      "from": null,
      "to": "Kurume, Dega & Wolisho"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "region",
      "from": null,
      "to": "Gedeb"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "harvest_time",
      "from": null,
      "to": "Dec-Jan 2025/26"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kayanza"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Field blend"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1,760masl"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kayanza"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Field blend"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1,760masl"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kigezi"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Nyasaland"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "2200 masl"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Kigezi"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Nyasaland"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "2200 masl"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Palestina"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Rosado/Pink Bourbon"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1900 masl"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Palestina"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Rosado/Pink Bourbon"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "elevation",
      "from": null,
      "to": "1900 masl"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Yoniser"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "farm",
      "from": null,
      "to": "El Mirador"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Cajamarca"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "elevation",
      "from": null,
      "to": "1,990 masl+"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "harvest_time",
      "from": null,
      "to": "August 2026"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Amal Al-Ofairi"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Kent"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Bani Ofair, Maghrib Ans"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Yulisa Carhuallocllo"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Miel"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Corazon de Chirinos"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Yulisa Carhuallocllo"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "La Miel"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Corazon de Chirinos"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 147,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Jamison Savage"
    },
    {
      "coffee_id": 147,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca Deborah"
    },
    {
      "coffee_id": 147,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Boquete"
    },
    {
      "coffee_id": 147,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 26/27"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Cyesha"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/products/rwanda-cyesha-natural-26-27"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Haider Aba Mecha, Kebena Estate"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Kebena Estate"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "JARC 74112, 74110"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Kamese Kebele, Galle, Limu Kossa Woreda, Jimma Zone"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1865 - 2090 masl"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 24/25"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Alemayahu Tilahun"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Wolisho, Dega, JARC"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "coffee_name",
      "from": "Ecuador - Finca El Dorado - Washed Geisha",
      "to": "Ecuador - Finca El Dorado - Washed Gesha"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Bernard Uhe, Finca El Dorado"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Dorado"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "producer",
      "from": null,
      "to": "Pepe Jijon"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Abner Caballero, Eyla365"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Volcan"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,500masl"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "harvest_time",
      "from": null,
      "to": "December 2025"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "coffee_name",
      "from": "Ethiopia Gesha Village - Lot #28/048 - Oma",
      "to": "Ethiopia Gesha Village - Lot #25/048 - Oma"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "coffee_name",
      "from": "Colombia - Finca El Turpial - Washed Geisha",
      "to": "Colombia - Finca El Turpial - Washed Gesha"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "producer",
      "from": null,
      "to": "Andcoffee"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1800-1950masl"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1800-1950masl"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "coffee_name",
      "from": "Panama HLE Trapiche 2 AFB",
      "to": "Panama Hacienda La Esmeralda Trapiche 2 AFB"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Mr. Tadese Teko"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "coffee_name",
      "from": "Abel Salinas Mejorado",
      "to": "Ecuador Abel Salinas"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "coffee_name",
      "from": "Nueva Alianza Natural Mejorada",
      "to": "Nueva Alianza Mejorada #4732"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "La Convencion, Cusco"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "product_url",
      "from": "https://x.com/xliiicoffee/status/2058805264200188159?lang=bg",
      "to": "https://xliiicoffee.com/en/product/rift-valley-coffee-caucus-03757/"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "coffee_name",
      "from": "Rift Valley Caucus Natural SL28/Batian/Ruiru",
      "to": "Rift Valley Coffee Caucus #03757"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "coffee_name",
      "from": "Nueva Alianza Natural Sidra",
      "to": "Nueva Alianza Sidra #4736"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "La Convencion, Cusco"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Gute Washing Station"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "La Convencion, Cusco"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Honey"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "amount_g",
      "from": 63,
      "to": 62.5
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "amount_g",
      "from": 63,
      "to": 62.5
    },
    {
      "coffee_id": 82,
      "roaster": "Prodigal",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 82,
      "roaster": "Prodigal",
      "field": "variety",
      "from": null,
      "to": "Chiroso"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "region",
      "from": null,
      "to": "Gedeb"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "variety",
      "from": null,
      "to": "Wolisho, Kurume"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "producer",
      "from": null,
      "to": "Snap Coffee Exporters"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "producer",
      "from": null,
      "to": "Yerly Marcela Morales"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "variety",
      "from": null,
      "to": "Sidra"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "producer",
      "from": null,
      "to": "Cesar Dario"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "region",
      "from": null,
      "to": "Amazonas"
    },
    {
      "coffee_id": 90,
      "roaster": "Flower Child",
      "field": "producer",
      "from": null,
      "to": "Ernedis Rodriguez"
    },
    {
      "coffee_id": 90,
      "roaster": "Flower Child",
      "field": "farm",
      "from": null,
      "to": "El Paraiso"
    },
    {
      "coffee_id": 90,
      "roaster": "Flower Child",
      "field": "elevation",
      "from": null,
      "to": "1840masl"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "Semester 2025 Q3"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "Semester 2025 Q3"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "Semester 2025 Q3"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "processing",
      "from": "Tartaric Acid Natural Cold Room",
      "to": "Natural"
    },
    {
      "coffee_id": 97,
      "roaster": "Substance",
      "field": "variety",
      "from": null,
      "to": "SL34, SL28, Ruiru-11, Batian"
    },
    {
      "coffee_id": 97,
      "roaster": "Substance",
      "field": "region",
      "from": null,
      "to": "Embu"
    },
    {
      "coffee_id": 97,
      "roaster": "Substance",
      "field": "elevation",
      "from": null,
      "to": "1600–1800masl"
    },
    {
      "coffee_id": 98,
      "roaster": "Substance",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 98,
      "roaster": "Substance",
      "field": "variety",
      "from": null,
      "to": "Heirloom"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Samuel Diego Bermudez"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1960masl"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Samuel Diego Bermudez"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Castillo"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Cauca"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1960masl"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Natural, EA Decaf",
      "to": "Natural"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Natural, EA Decaf",
      "to": "Natural"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Nyamagabe"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Roger Chilcon and Eli Espinoza"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Geisha"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Cajamarca"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "processing",
      "from": "Cherry Anaerobic & Mucilage Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "producer",
      "from": null,
      "to": "Libardo Lopez"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "variety",
      "from": null,
      "to": "Bourbon Sidra"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "region",
      "from": null,
      "to": "Buesaco, Nariño"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "processing",
      "from": "Fermented in GrainPro Bags & Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/finca-soledad-typica-mejorada-tyoxidator-washed"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Pepe Jijon"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Imbabura"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "1515 masl"
    },
    {
      "coffee_id": 128,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca Soledad"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/typica-mejorada-washed-finca-putushio-ultralight"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "producer",
      "from": null,
      "to": "Jose Jijon"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "variety",
      "from": null,
      "to": "Typica Mejorado"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "elevation",
      "from": null,
      "to": "2,222 masl"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "farm",
      "from": null,
      "to": "Finca Putushio"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "variety",
      "from": null,
      "to": "Inca Gesha"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 140,
      "roaster": "Big Sur",
      "field": "region",
      "from": null,
      "to": "Amazonas"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "processing",
      "from": "Decaffeinated Thermal Shock Washed",
      "to": "Thermal Shock Washed"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "processing",
      "from": "Bioreactor + Mosto Anoxic Natural",
      "to": "Anoxic Natural"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "coffee_name",
      "from": "Colombia Yessica Parra Aji Washed",
      "to": "Colombia Yessica & Diego Parra Aji Washed"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "coffee_name",
      "from": "Colombia Yessica Parra Aji Washed",
      "to": "Colombia Yessica & Diego Parra Aji Washed"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "500 smallholder farmers organized through Iyenga washing station"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "coffee_name",
      "from": "Tanzania Iyenga AMCOS Washed",
      "to": "Tanzania Iyenga AMCOS PB Washed"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Fragrancia Washed",
      "to": "Washed"
    },
    {
      "coffee_id": 166,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Santa Maria Washing Station"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "producer",
      "from": null,
      "to": "Bernard Uhe"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "farm",
      "from": null,
      "to": "Finca El Dorado"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "region",
      "from": null,
      "to": "Loja"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "amount_g",
      "from": 200,
      "to": 100
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "cost",
      "from": 38,
      "to": 19
    },
    {
      "coffee_id": 175,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-rwanda-kageyo"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "region",
      "from": null,
      "to": "Gedeb"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "producer",
      "from": null,
      "to": "Juan Valenzuela"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "harvest_time",
      "from": null,
      "to": "2024-2025"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Marlon Bolaños"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Sebastian Ramirez"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Sebastian Ramirez"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "producer",
      "from": null,
      "to": "Lisbeth Mariño"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "farm",
      "from": null,
      "to": "The Three Coffee Farmers"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "coffee_name",
      "from": "Nueva Alianza Washed Orange Gesha",
      "to": "Nueva Alianza Orange Gesha #4737"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "region",
      "from": null,
      "to": "Cusco"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "harvest_time",
      "from": null,
      "to": "2025"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Hugo González Díaz"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "farm",
      "from": null,
      "to": "Llactapata"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 25/26"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "115 woman-owned smallholder farms"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "coffee_name",
      "from": "Marlon Bolanos",
      "to": "Colombia Marlon Bolaños Gesha Washed"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "coffee_name",
      "from": "Marlon Bolanos",
      "to": "Colombia Marlon Bolaños Gesha Washed"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 233,
      "roaster": "Brainwave Roasters",
      "field": "farm",
      "from": null,
      "to": "Finca San Miguel Urias"
    },
    {
      "coffee_id": 233,
      "roaster": "Brainwave Roasters",
      "field": "producer",
      "from": null,
      "to": "Hector and Lilian Leal"
    },
    {
      "coffee_id": 233,
      "roaster": "Brainwave Roasters",
      "field": "region",
      "from": null,
      "to": "Antigua Valley"
    },
    {
      "coffee_id": 233,
      "roaster": "Brainwave Roasters",
      "field": "elevation",
      "from": null,
      "to": "1460–1540 masl"
    },
    {
      "coffee_id": 233,
      "roaster": "Brainwave Roasters",
      "field": "variety",
      "from": null,
      "to": "Caturra, H1, Bourbon"
    },
    {
      "coffee_id": 234,
      "roaster": "Brainwave Roasters",
      "field": "farm",
      "from": null,
      "to": "Finca San Miguel Urias"
    },
    {
      "coffee_id": 234,
      "roaster": "Brainwave Roasters",
      "field": "producer",
      "from": null,
      "to": "Hector and Lilian Leal"
    },
    {
      "coffee_id": 234,
      "roaster": "Brainwave Roasters",
      "field": "region",
      "from": null,
      "to": "Antigua Valley"
    },
    {
      "coffee_id": 234,
      "roaster": "Brainwave Roasters",
      "field": "elevation",
      "from": null,
      "to": "1460–1540 masl"
    },
    {
      "coffee_id": 234,
      "roaster": "Brainwave Roasters",
      "field": "variety",
      "from": null,
      "to": "Caturra, H1, Bourbon"
    },
    {
      "coffee_id": 235,
      "roaster": "Brainwave Roasters",
      "field": "farm",
      "from": null,
      "to": "Finca San Miguel Urias"
    },
    {
      "coffee_id": 235,
      "roaster": "Brainwave Roasters",
      "field": "producer",
      "from": null,
      "to": "Hector and Lilian Leal"
    },
    {
      "coffee_id": 235,
      "roaster": "Brainwave Roasters",
      "field": "region",
      "from": null,
      "to": "Antigua Valley"
    },
    {
      "coffee_id": 235,
      "roaster": "Brainwave Roasters",
      "field": "elevation",
      "from": null,
      "to": "1460–1540 masl"
    },
    {
      "coffee_id": 235,
      "roaster": "Brainwave Roasters",
      "field": "variety",
      "from": null,
      "to": "Caturra, H1, Bourbon"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Neguesse Debela"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Neguesse Debela"
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Sebastian Ramirez"
    },
    {
      "coffee_id": 254,
      "roaster": "Hydrangea",
      "field": "processing",
      "from": "Decaffeinated Thermal Shock Washed",
      "to": "Double Anaerobic Thermal Shock Washed"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Extended Fermentation, Three-Stage Slow-Drying Natural",
      "to": "Natural"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed (72 Hours Wet Fermentation + 21 Days Drying On Raised Beds)",
      "to": "Washed"
    },
    {
      "coffee_id": 267,
      "roaster": "Love Letters Charming Coffees",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2450masl"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "SL28, SL34, Ruiru 11, Batian"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Kirinyaga"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1,650-1,900 masl"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Milenio"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "El Cola Roja, Don Senel Micromill"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "San Jerónimo de San Pedro, Brunca"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1,700-1,800 masl"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Red Bourbon"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Nyamasheke District, Western Province"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1,450-1,800 masl"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "producer",
      "from": null,
      "to": "Alo Coffee, Safo Station"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 275,
      "roaster": "Wooly Lamb Coffee Roasters",
      "field": "producer",
      "from": null,
      "to": "Mr. Tadese Teko"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Mayole Coffee (Ture Waji)"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "farm",
      "from": null,
      "to": "Gora Borawa drying station"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "Crop 25/26"
    },
    {
      "coffee_id": 277,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Sebastian Ramirez"
    },
    {
      "coffee_id": 278,
      "roaster": "Ceto",
      "field": "farm",
      "from": null,
      "to": "Mara Estate"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "farm",
      "from": null,
      "to": "Mara Estate"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "processing",
      "from": "Natural, Special Prep",
      "to": "Natural"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/kii-pb"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Kii Farm"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "region",
      "from": null,
      "to": "Gichugu Division, Kirinyaga"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Batian, SL28, SL34, Ruiru 11"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "elevation",
      "from": null,
      "to": "1,600-1,900 masl"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "elevation",
      "from": null,
      "to": "1,600 masl"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "elevation",
      "from": null,
      "to": "60-250 masl"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "producer",
      "from": null,
      "to": "FRINJ"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "producer",
      "from": null,
      "to": "Bressani family"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "region",
      "from": null,
      "to": "Volcán Atitlán"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "farm",
      "from": null,
      "to": "Gesha Village"
    },
    {
      "coffee_id": 310,
      "roaster": "Noumenon Coffee",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 310,
      "roaster": "Noumenon Coffee",
      "field": "region",
      "from": null,
      "to": "Danche"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "1400 smallholder producers, Muraho Trading Company"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "26/27"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Ture Waji"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "harvest_time",
      "from": null,
      "to": "25/26"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "producer",
      "from": null,
      "to": "Victor Florez"
    },
    {
      "coffee_id": 326,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "WASHED - 60 HOUR CHERRY FERMENTATION + 48 HOUR DRY FERMENTATION",
      "to": "Washed"
    },
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-efren-rodriguez"
    },
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Efren Rodriguez"
    },
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Gigante"
    },
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Caturra field blend"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-efren-rodriguez"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Efren Rodriguez"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraiso"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Gigante"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Caturra field blend"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-peru-roger-x-eli"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-peru-roger-x-eli"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Roger Chilcon and Eli Espinoza"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Cajamarca"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-yemen-al-ofairi"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-peru-yulisa-carhuallocllo"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-peru-yulisa-carhuallocllo"
    },
    {
      "coffee_id": 147,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/panama-deborah-aril-2025"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "coffee_name",
      "from": "El Paraiso Decaf",
      "to": "Castillo - Thermal Shock Decaf - Finca El Paraiso"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "coffee_name",
      "from": "El Paraiso Decaf",
      "to": "Castillo - Thermal Shock Decaf - Finca El Paraiso"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "coffee_name",
      "from": "El Paraiso Decaf",
      "to": "Castillo - Thermal Shock Decaf - Finca El Paraiso"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "coffee_name",
      "from": "Castillo\nThermal Shock Decaf\nFinca El Paraiso",
      "to": "Castillo - Thermal Shock Decaf - Finca El Paraiso"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/felipe-luzon"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "farm",
      "from": null,
      "to": "Finca El Paraíso"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Wil Edilberto Armijo"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Parainema"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "region",
      "from": null,
      "to": "Santa Bárbara, Las Vegas"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "elevation",
      "from": null,
      "to": "1,550 masl"
    },
    {
      "coffee_id": 42,
      "roaster": "norml coffee ppl",
      "field": "cost",
      "from": 26.45,
      "to": 19.8
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "coffee_name",
      "from": "Yulisa Carhuallocllo: Corazon de Chirinos",
      "to": "Yulisa Carhuallocllo: Corazón de Chirinos"
    },
    {
      "coffee_id": 132,
      "roaster": "Macs Roasters",
      "field": "roast_level",
      "from": "Nordic",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 133,
      "roaster": "Macs Roasters",
      "field": "roast_level",
      "from": "Nordic",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 134,
      "roaster": "Macs Roasters",
      "field": "roast_level",
      "from": "Nordic",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 135,
      "roaster": "Macs Roasters",
      "field": "roast_level",
      "from": "Nordic",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 151,
      "roaster": "Shoebox",
      "field": "amount_g",
      "from": 125,
      "to": 100
    },
    {
      "coffee_id": 152,
      "roaster": "Shoebox",
      "field": "amount_g",
      "from": 125,
      "to": 100
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "roast_level",
      "from": "Nordic",
      "to": "Light"
    },
    {
      "coffee_id": 203,
      "roaster": "H&S",
      "field": "coffee_name",
      "from": "MCL JUNE 2026",
      "to": "Angine de Caféine (MCL JUNE 2026)"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "coffee_name",
      "from": "Yulisa Carhuallocllo: Corazon de Chirinos",
      "to": "Yulisa Carhuallocllo: Corazón de Chirinos"
    },
    {
      "coffee_id": 237,
      "roaster": "Eymen",
      "field": "amount_g",
      "from": 18,
      "to": 18.1
    },
    {
      "coffee_id": 238,
      "roaster": "Eymen",
      "field": "roast_level",
      "from": "Light",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 238,
      "roaster": "Eymen",
      "field": "amount_g",
      "from": 18,
      "to": 18.1
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "roast_level",
      "from": "Ultralight",
      "to": "Nordic Light"
    },
    {
      "coffee_id": 256,
      "roaster": "norml coffee ppl",
      "field": "cost",
      "from": 26.45,
      "to": 19.8
    }
  ],
  "websites": [],
  "tavilyCalls": []
},
];
