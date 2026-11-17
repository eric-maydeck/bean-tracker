// Bean Base reconcile batches (private/scripts/bean-base-reconcile.ts + backfill-review.py fields-export).
// Each is applied once at boot under its own marker (applyCoffeeFixes, coffees.ts). Data only, generated:
// never type or edit a `from` by hand. The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const BEAN_BASE_BACKFILLS: CoffeeFixBatch[] = [
{
  "marker": "bean_base_backfill_2026_11",
  "fixes": [
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Mint, Peach, White Tea"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Orange, Malted, Fudge"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Baho Coffee"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Pomegranate, Zesty, Blackberries, Syrupy, Lime Zest"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Orange, Rose"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "tasting_notes",
      "from": null,
      "to": "Vanilla, Lavender, Gooseberry, Nectarine"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Eudis Orosco Tanat"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "SL9 (Inca Gesha)"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Mandarin, Floral"
    },
    {
      "coffee_id": 12,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Gesha"
    },
    {
      "coffee_id": 12,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Floral, Panela"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Lemon, Pecan"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Oolong Tea, Sour, Cherry"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Gikirima FCS"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Ruiru 11, SL28, SL34"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Blackcurrant, Elderflower, Kiwi"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Gilber Huayllas Huaman"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "SL9 (Inca Gesha)"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Stonefruit, Lemon Tea"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Blossoms, Starfruit, Orange"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Faysel Abdosh Yonis"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Floral, Peach, Citrus"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Pomegranate, Lemonade, Pineapple"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Blossoms, Floral, Apple, Mandarin, White Tea, Orange, Raspberry, Redcurrant"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Berries, Rose, Fruity, Floral, Honey, Orchid"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Syrupy, Fig, Jam, Apricot, Spruce Tips"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Apple, Blackcurrant, Floral, Fruity, Honeysuckle, Lemon, Raspberry, Rose Water, Spiced"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Blackcurrant, Blueberries, Hibiscus, Raspberry, Rose, Syrupy"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Citrus, Fruity, Orange, Rose"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Black Forest, Floral, Mandarin, Rose, Redcurrant, Lemongrass"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Blossoms, Floral, Apple, Mandarin, White Tea, Orange, Raspberry, Redcurrant"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Navel Orange, Raspberry"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "producer",
      "from": null,
      "to": "Gilber Huayllas Huaman"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Honeysuckle, Lime, Meyer Lemon"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blueberries, Rose, White Grape, Grapes"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blueberries, Rose, White Grape, Grapes"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Rose, Grapefruit, Juice, Watermelon"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Rose, Grapefruit, Juice, Watermelon"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach Rings, Jasmine, Honey"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "elevation",
      "from": null,
      "to": "1,650 - 1,800 masl"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Blackcurrant, Tomato, Lime"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Bright, Rhubarb, White Tea, Lively, High Sweetness"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Honeysuckle, Sweet, Violets, Bergamot, Floral, Juicy, Buttery, Silky Mouthfeel"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Lime Zest, Apricot, Zesty, Bergamot"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Violets, Peach, Chamomile"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "region",
      "from": null,
      "to": "Chelbesa, Gedeb, Gedeo"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "variety",
      "from": null,
      "to": "74110"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "elevation",
      "from": null,
      "to": "2,000 masl"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "harvest_time",
      "from": null,
      "to": "2026"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Mandarin, Nectarine, Floral"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Mango, Banana Pudding, Gummy Bears"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Cantaloupe, Honeycomb"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Red Tea, Apricot, Grapefruit, Candied"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Dwight Aguilar Masías"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry, Pineapple, Currants"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Rift Valley Coffee Caucus"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Tart, Cherry, Raspberry, Orange"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Dwight Aguilar Masías"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Blueberries, Blackberries, Strawberry"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Oolong Tea, Tamarind, Osmanthus"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry Blossom, Plumcot, Buttercream, Rose, Blossoms"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Lime, Passionfruit, Mango"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Tamarind, Jasmine, Raspberry, Lemongrass, Melon, Orange"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Amaybamba, Cusco"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Alejandrina Maytan"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "SL9"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "elevation",
      "from": null,
      "to": "2,280 masl"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "November 2025"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Jammy, Strawberry, Tropical Fruit, Fruity"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Mate Matiwos"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Tropical Fruit, Bergamot, Berries, Fruity"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Mikuba Hills"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Raspberry, Red Grape, Grapes, Hibiscus"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Coconut, Lychee, Pineapple, Lavender"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Hibiscus, Starfruit, Apricot, Green Tea"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Yessica Parra"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Blackberries, Jasmine"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Orange, Mango, Bright, Tamarind, Tangerine, Apricot, Raspberry"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Pluot, Lilac"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Kamwangi Factory"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Apple, Grapefruit, Floral, Juice"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Canned Peaches, Chamomile, Vanilla"
    },
    {
      "coffee_id": 72,
      "roaster": "Intelligentsia",
      "field": "tasting_notes",
      "from": null,
      "to": "Ube, Strawberry, Violets"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": null,
      "to": "Heza Washing Station"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Ume, Magnolia, Syrupy, Green Mango"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Squash, Grapes, Blossoms, Pear, Red Grape"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Dried, Rose"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Demeka Becha"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Pineapple, Earl Grey, Jasmine"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Sike Bokasso Community"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Peach, Lemongrass"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Elegant, Bergamot, Violets, Citric, Floral, Sweet, Honeysuckle, Peach"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Bergamot, Confit, Lemon"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "elevation",
      "from": null,
      "to": "2,200 masl"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "harvest_time",
      "from": null,
      "to": "December 2024 - January 2025"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "tasting_notes",
      "from": null,
      "to": "Apricot, Blossoms, Elegant, Orange, Vibrant, Watermelon"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry, Red Wine, Grapes"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "tasting_notes",
      "from": null,
      "to": "Brownies, Nougat"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "tasting_notes",
      "from": null,
      "to": "Pink Lady, Bing Cherries, Honey"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "tasting_notes",
      "from": null,
      "to": "Orange, Floral, Grapes, Marigold, Coffee Blossoms, Currants, Oolong Tea, Citrus"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "producer",
      "from": null,
      "to": "Luis Enrique Cuellar"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Berries, Compote, Custard, Grapefruit, Hi-Chew, Lime, Strawberry"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Lime, Cheesecake, Lychee"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Raspberry, Banana, Sweet"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "1,550 - 1,700 masl"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Plum, Cherry Blossom, Tangerine, Green Tea"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Bukeye Washing Station"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Gingerbread, Honey"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Berries, Softness"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry, Grapefruit, Peach, Jasmine, Zesty, Plum, Valencia Oranges, Rose, Lime Zest"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Key Lime, Pomegranate"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Blueberries, Cheesecake, Cherry, Cordial, Hibiscus"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Syrupy, Brown Sugar, Juice, Cherry"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Syrupy, Brown Sugar, Juice, Cherry"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Nestor Lasso"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "variety",
      "from": null,
      "to": "Pink Bourbon"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Key Lime"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Dragonfruit, Lily, Fruity, Honeysuckle"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Gitega Hills Washing Station"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Hibiscus, Apple, Peach"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Fig, Blueberries, Black Tea, Jam"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "region",
      "from": null,
      "to": "Nariño"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Mango, Starfruit, Meyer Lemon"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Lemonade, Matcha, Elderflower"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Lavender, Sweet, Tropical Fruit"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Tropical Fruit, Floral"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Yuzu, Grapefruit, Black Cherry, Bergamot"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "elevation",
      "from": null,
      "to": "2,000 masl"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "harvest_time",
      "from": null,
      "to": "July 2025"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Lemon, Calpico, Honey, White Tea, Peach"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "tasting_notes",
      "from": null,
      "to": "Mandarin, Ripe, Lemon, Floral, Mango"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Starfruit, Pomelo, Pineapple, Oolong Tea, Bergamot"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Fruity, Lime, Stonefruit"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Wild Flowers, Orange, Honey, Chamomile"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Wild Flowers, Orange, Honey, Chamomile"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Testi Coffee"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Floral, Citrus, Green Tea"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Alo Coffee"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Magnolia, Bergamot, Honey, Watermelon, Lime, Juice, Peach"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Dried Apple, Strawberry, Jasmine"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Apricot, Jam, Bergamot, Peach, Jasmine"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Honeycomb, Raspberry, Rhubarb"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Peach, Blood Orange, Dense"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Ginger, Candy, Starfruit"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Ginger, Candy, Starfruit"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Mango, Cardamom, Black Tea"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Blood Orange, Jasmine, Champagne"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Orange, Blossoms, Bergamot, Berries"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Apricot, Pink Lady, Apple, Lychee"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Wild Flowers, Zesty, Peach, Honey, Lemon Zest"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Syrupy, Toffee, Raw Honey, Blackberries"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Dragonfruit, Lily, Fruity, Honeysuckle"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Syrupy, Brown Sugar, Juice, Cherry"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Syrupy, Brown Sugar, Juice, Cherry"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Giku Hills"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Oolong Tea, Dried Apricot, Meyer Lemon"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Blossoms, Floral, Apple, Mandarin, White Tea, Orange, Raspberry, Redcurrant"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Black Forest, Floral, Mandarin, Rose, Redcurrant, Lemongrass"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "region",
      "from": null,
      "to": "Huila"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "tasting_notes",
      "from": null,
      "to": "Currants, Mango, Yuzu, Redcurrant, Blood Orange, Passionfruit"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "tasting_notes",
      "from": null,
      "to": "Complex, Fruity, Floral, Funky, Boozy, Intense"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "tasting_notes",
      "from": null,
      "to": "Pineapple, Peach, Almond, Dried"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "producer",
      "from": null,
      "to": "Kihuyo"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Passionfruit, Stonefruit, Tropical Fruit"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "producer",
      "from": null,
      "to": "Gakuyuini"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "tasting_notes",
      "from": null,
      "to": "Currants, Plum, Blackberries, Blackcurrant, Fruity, Caramel"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "producer",
      "from": null,
      "to": "Kii Factory (Rungeto FCS)"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "tasting_notes",
      "from": null,
      "to": "Blood Orange, Bright, Clean, Juicy, Lily, Mikan"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Cranberry, Strawberry, Cherry Blossom, Blossoms"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Honeydew, Berries"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jam, Hibiscus, Grenadine, Strawberry"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "tasting_notes",
      "from": null,
      "to": "Balanced, Bergamot, Bright, Green Tea, Lilikoi, Sweet"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "tasting_notes",
      "from": null,
      "to": "Funky, Boozy, Intense"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Quindío"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Caturra, Pink Bourbon"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Orange, Cherry, Candy"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Raspberry, Tangerine, Strawberry"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Pineberry, Citrus, Peach, Mango, Juicy, Plum"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Meyer Lemon, Jasmine, Peach, Ice Cream, Green Tea"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jam, Hibiscus, Grenadine, Strawberry"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "producer",
      "from": null,
      "to": "Dwight Aguilar Masías"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Peach, Jasmine, Orange"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "producer",
      "from": null,
      "to": "Gitwe Farmer's Coop"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "tasting_notes",
      "from": null,
      "to": "Honey, Redcurrant, Mango, Melon"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Alo Coffee"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Magnolia, Bergamot, Honey, Watermelon, Lime, Juice, Peach"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Starfruit, Jasmine, Plum"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Gara Agena Washing Station"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Mangosteen, Lime, Apricot"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Raspberry, Candy, Berries, Blackcurrant"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Faysel Abdosh Yonis"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Floral, Peach, Citrus"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Red Tea, Creamsicle, Creamy, Rooibos Tea, Tropical Fruit, Citrus, Honeysuckle, Floral, Orange"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Tangerine, Elderflower, Honeysuckle"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Hibiscus, Kiwi"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Peach Rings, Blood Orange, Honeysuckle, Lemongrass"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Sugarcane, Rose, Lemonade, Rainier Cherry"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Lemon Balm, Orange, Blossoms, Calamansi, Fruity, Honey"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Peony, Peach, Oolong Tea"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Goji Berries, Honey, Wild Flowers"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Hojicha, Blueberries, Sarsaparilla"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Pineapple, Fig, Bergamot"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Pineapple, Fig, Bergamot"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Milky, Lime, Floral, Sweet, White Tea, Redcurrant, Caramel"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Blossoms, Floral, Apple, Mandarin, White Tea, Orange, Raspberry, Redcurrant"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Black Forest, Floral, Mandarin, Rose, Redcurrant, Lemongrass"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Honey, Tangerine, Berries, Roselle"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Honey, Tangerine, Berries, Roselle"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Testi Coffee"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Floral, Citrus, Green Tea"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Violets, Peach, Chamomile"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Lemon Lime, Soda, Peach, Jasmine, Green Tea, Candy, Bergamot, Chrysanthemum"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "region",
      "from": null,
      "to": "Gedeo"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "elevation",
      "from": null,
      "to": "2,100 masl"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Mango, Rose, Hibiscus"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Peach, Bergamot"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Peach, Bergamot"
    },
    {
      "coffee_id": 243,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 243,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Candied, Cloves, White Tea, Zesty, Orange, Juice, Pineapple, Cardamom"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Honeydew, Dried Mango, Jasmine"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "tasting_notes",
      "from": null,
      "to": "Pear, White Tea, Yuzu"
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Quindío"
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Caturra, Pink Bourbon"
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Orange, Cherry, Candy"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Mugaga FCS"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Limeade, Black Tea, Nectarine"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Mugaga FCS"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Limeade, Black Tea, Nectarine"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Kamoko FCS"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Blackcurrant, Plum, Berries, Creamy, Raspberry, Candy"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Kamoko FCS"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Blackcurrant, Plum, Berries, Creamy, Raspberry, Candy"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "harvest_time",
      "from": null,
      "to": "March 2025 - July 2025"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry, Apple, Kiwi, Rooibos Tea"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Rhubarb, Guava, Rose, Bergamot, Jasmine"
    },
    {
      "coffee_id": 255,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Strawberry, Meyer Lemon, Earl Grey, Jam"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Faysel Abdosh Yonis"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Nectarine, Strawberry, Creamy, Lychee, Red Grape, Grapes"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Citrus, Berries, Apricot, Jasmine"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "producer",
      "from": null,
      "to": "Faysel Abdosh Yonis"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Lemon, Floral, Grapes, Shine Muscat, Muscat Grape, Peach"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "tasting_notes",
      "from": null,
      "to": "Juice, Orange, Apple, Sweet, Peach, Apricot"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "region",
      "from": null,
      "to": "Sidama"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "producer",
      "from": null,
      "to": "Basha Bekele"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "variety",
      "from": null,
      "to": "74158, Landrace"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "elevation",
      "from": null,
      "to": "2,350 - 2,500 masl"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "tasting_notes",
      "from": null,
      "to": "Starfruit, Lychee, Lavender, Jam, Guava, Jasmine Tea, Mango, Blueberries, Blackberries"
    },
    {
      "coffee_id": 267,
      "roaster": "Love Letters Charming Coffees",
      "field": "variety",
      "from": null,
      "to": "74112, 74158"
    },
    {
      "coffee_id": 267,
      "roaster": "Love Letters Charming Coffees",
      "field": "tasting_notes",
      "from": null,
      "to": "Coconut, Jasmine, Gummies, Citrus, Fragrant"
    },
    {
      "coffee_id": 268,
      "roaster": "Love Letters Charming Coffees",
      "field": "region",
      "from": null,
      "to": "Yirgacheffe"
    },
    {
      "coffee_id": 268,
      "roaster": "Love Letters Charming Coffees",
      "field": "producer",
      "from": null,
      "to": "Chelchele"
    },
    {
      "coffee_id": 268,
      "roaster": "Love Letters Charming Coffees",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 268,
      "roaster": "Love Letters Charming Coffees",
      "field": "tasting_notes",
      "from": null,
      "to": "Nectarine, White Tea, Sweet, Lemongrass, Syrupy, Refreshing, Simple Syrup, Spearmint, Korean Pear, Meyer Lemon, Green Tea, Honeydew, Jasmine"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "processing",
      "from": null,
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "region",
      "from": null,
      "to": "Gedeb"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "producer",
      "from": null,
      "to": "Chorso Bule"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "variety",
      "from": null,
      "to": "Landrace"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Ripe, Honeysuckle, Melon, Peach"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Inoi FCS"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Hibiscus, Blackberries, Fresh, Rhubarb, Soda, Brown Sugar, Rose, Jam, Blackcurrant, Ripe, Tomato"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Senel Campos Valverde"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Molasses, Phosphoric, Ginger, Cake, Dried Fig, Fruity, Tropical Fruit, Dates, Raspberry, Liqueur, Jam, Syrupy, Blackcurrant, Pineapple, Cola"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Cyesha Washing Station"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Sweet, Jam, Assam Tea, Passionfruit, Star Anise, Baking Spice, Cloves, Plum, Black Tea, Milk Chocolate, Malty, Spiced, Muscovado, Ripe, Cinnamon, Dried Strawberry"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Lavender, Orange"
    },
    {
      "coffee_id": 275,
      "roaster": "Wooly Lamb Coffee Roasters",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Peach, Honey"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Coriander Seeds, Floral, Violets, Strawberry, Zesty, Blood Orange, Lavender, Raspberry, Rose, Citrus, Bergamot, Blueberries"
    },
    {
      "coffee_id": 277,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Quindío"
    },
    {
      "coffee_id": 277,
      "roaster": "Ceto",
      "field": "variety",
      "from": null,
      "to": "Caturra, Pink Bourbon"
    },
    {
      "coffee_id": 277,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Orange, Cherry, Candy"
    },
    {
      "coffee_id": 278,
      "roaster": "Ceto",
      "field": "region",
      "from": null,
      "to": "Narok County"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "region",
      "from": null,
      "to": "Narok County"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "variety",
      "from": null,
      "to": "Batian, Ruiru 11, SL28"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "elevation",
      "from": null,
      "to": "1,700 - 1,900 masl"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "tasting_notes",
      "from": null,
      "to": "Apple, Cherry, Currants"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "tasting_notes",
      "from": null,
      "to": "Lavender, Mango, Peach, Soda, Spearmint"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "region",
      "from": null,
      "to": "Palanda, Amazonia"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Felipe Luzon"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "variety",
      "from": null,
      "to": "Typica"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "elevation",
      "from": null,
      "to": "1,500 masl"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapes, Hibiscus, Red Grape, Green Apple"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "producer",
      "from": null,
      "to": "Halo Beriti"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Lavender, Pear, Raspberry"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Tangerine, Hibiscus, Guava"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "tasting_notes",
      "from": null,
      "to": "Citrus, Herbal, Berries"
    },
    {
      "coffee_id": 289,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 289,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Gardenia, Bergamot, D'anjou Pear, Stonefruit, Floral"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "producer",
      "from": null,
      "to": "Nemecio Ramos"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Grapefruit, Plum, Cherry"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Finger Lime, Jasmine, Sencha, Apricot"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Soda, Taffy, Lemon Lime, Starfruit"
    },
    {
      "coffee_id": 294,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Halo Beriti"
    },
    {
      "coffee_id": 294,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Blood Orange, Lemonade, Strawberry, Bergamot"
    },
    {
      "coffee_id": 295,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Halo Beriti"
    },
    {
      "coffee_id": 295,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Blood Orange, Lemonade, Strawberry, Bergamot"
    },
    {
      "coffee_id": 296,
      "roaster": "Shoebox",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 296,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Grapes, Pomegranate, Red Grape"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Cantaloupe, Honeycomb"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "tasting_notes",
      "from": null,
      "to": "Vanilla, Honey, Peach, Earl Grey"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "producer",
      "from": null,
      "to": "Multiple Smallholders"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "tasting_notes",
      "from": null,
      "to": "Jam, Rhubarb, Strawberry, Floral"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Lemonade, Raw Honey, Earl Grey, Dandelion, Bergamot, Arnold Palmer, Apricot"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Milk Tea, Rose Hips, Elderberry"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Fuji Apple, Limoncello, Raw Honey"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "region",
      "from": null,
      "to": "California"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Cream Soda, Tangelo"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "tasting_notes",
      "from": null,
      "to": "Orange, Peach, Black Cherry"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Mango, Green Tea, Sweet"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Nectarine, Sencha"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "region",
      "from": null,
      "to": "Arsi Nensebo"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "producer",
      "from": null,
      "to": "Gesha Village"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "variety",
      "from": null,
      "to": "Gesha 1931"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "tasting_notes",
      "from": null,
      "to": "Boysenberry, Elderflower, Bergamot"
    },
    {
      "coffee_id": 310,
      "roaster": "Noumenon Coffee",
      "field": "tasting_notes",
      "from": null,
      "to": "Honeysuckle, Silver Needle Tea"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Black Tea, Cherry, Apple, Lemon, Tomato, Tangerine, Orange, Plum, Floral"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Apple, Mango, Cantaloupe, Blossoms, Pear, White Grape, Wine, Grapes, Meyer Lemon, Granny Smith, Lemongrass, Riesling, Oolong Tea"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "region",
      "from": null,
      "to": "Kerugoya"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "producer",
      "from": null,
      "to": "Inoi FCS"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "variety",
      "from": null,
      "to": "Batian, Ruiru 11, SL28, SL34"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "elevation",
      "from": null,
      "to": "1,650 - 1,900 masl"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Hibiscus, Blackberries, Fresh, Rhubarb, Soda, Brown Sugar, Rose, Jam, Blackcurrant, Ripe, Tomato"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "tasting_notes",
      "from": null,
      "to": "Cookies, Satsuma, Pear, Blueberries, Orange, Fresh, Buttery"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "producer",
      "from": null,
      "to": "Chelbesa"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "tasting_notes",
      "from": null,
      "to": "Violets, Marmalade, Oolong Tea, Grapes, Floral"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "producer",
      "from": null,
      "to": "Rungeto FCS (Karimikui Factory)"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "tasting_notes",
      "from": null,
      "to": "Cola, Blackberries, Winey"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "producer",
      "from": null,
      "to": "Habtamu Fikadu"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "tasting_notes",
      "from": null,
      "to": "Sencha, Champagne, Honey, Peach, Floral"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Long Miles Coffee"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Orange, Cola"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Long Miles Coffee"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Orange, Cola"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Kigezi Valley Coffee"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Gummy Bears, Lavender, Raspberry"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Kigezi Valley Coffee"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Gummy Bears, Lavender, Raspberry"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Jorge 'Pikudo' Andrade"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Strawberry, Blueberries, Orange"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "producer",
      "from": null,
      "to": "Jorge 'Pikudo' Andrade"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "tasting_notes",
      "from": null,
      "to": "Blossoms, Strawberry, Blueberries, Orange"
    },
    {
      "coffee_id": 327,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Green Tea, Nectarine"
    },
    {
      "coffee_id": 328,
      "roaster": "norml coffee ppl",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Green Tea, Nectarine"
    },
    {
      "coffee_id": 329,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Rhubarb, Guava, Rose, Bergamot, Jasmine"
    },
    {
      "coffee_id": 330,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Geranium, Pomelo, Dried Strawberry, Lime, Rose, Raspberry, Floral, Lychee, Jam, Lemon Zest, Zesty, Cider, Oolong Tea, Boozy"
    },
    {
      "coffee_id": 331,
      "roaster": "Scenery",
      "field": "tasting_notes",
      "from": null,
      "to": "Floral, Ripe, Yuzu, Peach, Lime, Citra Hops, Guava, Intense, White Sugar, Loquat, Soda"
    },
    {
      "coffee_id": 332,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Meyer Lemon, Bergamot, Blossoms, Apple, Acai Berries, Lemon Verbena"
    },
    {
      "coffee_id": 333,
      "roaster": "Shoebox",
      "field": "tasting_notes",
      "from": null,
      "to": "Jasmine, Lemon Lime, Rose, Bergamot, Soda, Peach"
    },
    {
      "coffee_id": 334,
      "roaster": "Flower Child",
      "field": "producer",
      "from": null,
      "to": "Danche Washing Station"
    },
    {
      "coffee_id": 334,
      "roaster": "Flower Child",
      "field": "tasting_notes",
      "from": null,
      "to": "Cherry, Honeysuckle, Peach, Ripe"
    },
    {
      "coffee_id": 335,
      "roaster": "Flower Child",
      "field": "tasting_notes",
      "from": null,
      "to": "Apple, Guava, Grapes, Wild Berries, Wild Flowers, Honey, Coffee Blossoms, Citrus"
    },
    {
      "coffee_id": 336,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Fruity, Sparkly Acidity, Tropical Fruit, Floral, Softness"
    },
    {
      "coffee_id": 337,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Mango, Floral, Lychee, Jasmine"
    },
    {
      "coffee_id": 338,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Coffee Blossoms, Peach, Honeydew"
    },
    {
      "coffee_id": 339,
      "roaster": "Sey",
      "field": "tasting_notes",
      "from": null,
      "to": "Plum, Lemon Verbena, Melon"
    },
    {
      "coffee_id": 340,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Peach, Bergamot, Strawberry"
    },
    {
      "coffee_id": 341,
      "roaster": "H&S",
      "field": "tasting_notes",
      "from": null,
      "to": "Pomegranate, Jasmine"
    },
    {
      "coffee_id": 342,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Bergamot, Finger Lime, Jasmine, Sencha, Apricot"
    },
    {
      "coffee_id": 343,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Watermelon, Elderflower"
    },
    {
      "coffee_id": 344,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Cobbler, Blueberries, Mangosteen, Gardenia"
    },
    {
      "coffee_id": 345,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Cobbler, Blueberries, Mangosteen, Gardenia"
    },
    {
      "coffee_id": 346,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Yuzu, Jasmine, Peach, Milk Tea"
    },
    {
      "coffee_id": 347,
      "roaster": "Bean's Beans",
      "field": "tasting_notes",
      "from": null,
      "to": "Rhubarb, Tomato, Apple, Blossoms, Candied"
    },
    {
      "coffee_id": 351,
      "roaster": "Botz",
      "field": "producer",
      "from": null,
      "to": "Tamiru Tadessa"
    },
    {
      "coffee_id": 351,
      "roaster": "Botz",
      "field": "tasting_notes",
      "from": null,
      "to": "Tropical Fruit, Fruity, Hawaiian Punch, Fresh, Strawberry, Syrupy, Peach"
    },
    {
      "coffee_id": 352,
      "roaster": "Goût & Co Specialty Coffee Roastery",
      "field": "harvest_time",
      "from": null,
      "to": "January 2026"
    },
    {
      "coffee_id": 352,
      "roaster": "Goût & Co Specialty Coffee Roastery",
      "field": "tasting_notes",
      "from": null,
      "to": "Purple Grape, Grapes, Sweet, Pineapple, Dried Fruit, Fruity, Kiwi"
    },
    {
      "coffee_id": 353,
      "roaster": "Goût & Co Specialty Coffee Roastery",
      "field": "tasting_notes",
      "from": null,
      "to": "Dried Fig, Wine, Jam, Rose, Cherry"
    },
    {
      "coffee_id": 354,
      "roaster": "Love Letters Charming Coffees",
      "field": "tasting_notes",
      "from": null,
      "to": "Syrupy, Coconut, Candy, Milk Tea, Jammy, Pistachio, Citric, Saffron, Rose, Blossoms, Grapes, Peach, Candied, Ice Cream, Orange, Sweet, Lavender, Soda, Jasmine, Gummies"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "farm",
      "from": null,
      "to": "La Chirimoya"
    },
    {
      "coffee_id": 12,
      "roaster": "GWO",
      "field": "farm",
      "from": null,
      "to": "Finca Pacpa"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "farm",
      "from": null,
      "to": "Finca El Diviso"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "processing",
      "from": "Natural",
      "to": "Anaerobic Natural"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "producer",
      "from": "James Kungu Kariuki",
      "to": "James Kungu Kariuki Aka Bob"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "producer",
      "from": "Tadese Teko",
      "to": "Mr. Tadese Teko"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "elevation",
      "from": "1,820 masl",
      "to": "1,820-1,900 masl"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "elevation",
      "from": "1,820 masl",
      "to": "1,820-1,900 masl"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "producer",
      "from": "Alina Milagros",
      "to": "Alina Milagros Solona"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "region",
      "from": "Caranavi Province, La Paz",
      "to": "Caranavi Province, La Paz Department"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "region",
      "from": "Gedeb, Gedeo",
      "to": "Chelbesa, Gedeb, Gedeo"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "producer",
      "from": "Rambagirakawa",
      "to": "Rambagirakawa Cooperative"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "processing",
      "from": "Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "region",
      "from": "Cusco",
      "to": "La Convencion, Cusco"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "elevation",
      "from": "1,820 masl",
      "to": "1,820-1,900 masl"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "variety",
      "from": "Gesha",
      "to": "Yellow Gesha"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "elevation",
      "from": "1,820 masl",
      "to": "1,820-1,900 masl"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "producer",
      "from": "Marcelo Assis and Flavio Silva",
      "to": "Marcelo Assis And Flavio Silva // Bioma Cafe"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "processing",
      "from": "Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "producer",
      "from": "Zerihun Birhanu",
      "to": "Zerihun Birhanu Halo Shashamane"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "region",
      "from": "Cusco",
      "to": "La Convencion, Cusco"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "elevation",
      "from": "1,820 masl",
      "to": "1,820-1,900 masl"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "region",
      "from": "Sidama",
      "to": "Sidama, Keramo"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "region",
      "from": "Embu",
      "to": "Embu County"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "producer",
      "from": "Gilber Huayllas",
      "to": "Gilber Huayllas Huaman"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "harvest_time",
      "from": "2026",
      "to": "January 2026"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": "74158",
      "to": "JARC 74158 (Walega)"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "variety",
      "from": "74158",
      "to": "JARC 74158 (Walega)"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "variety",
      "from": "Milenio",
      "to": "H10 (Milenio)"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "processing",
      "from": "Washed",
      "to": "Anaerobic Washed"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 332,
      "roaster": "Shoebox",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 336,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 339,
      "roaster": "Sey",
      "field": "processing",
      "from": "Washed",
      "to": "Extended Ferment Washed"
    },
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "32875"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "29733"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "31670"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "31256"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "bean_base_id",
      "from": null,
      "to": "33687"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "32883"
    },
    {
      "coffee_id": 12,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "32888"
    },
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "35461"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "33273"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "31257"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "31584"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "35430"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28299"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "35429"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30095"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "35428"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "31202"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "21504"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "18523"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "23921"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30096"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30095"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "39008"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "39017"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "35131"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "35131"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35385"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35385"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "bean_base_id",
      "from": null,
      "to": "35723"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "36663"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "36664"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "36537"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35402"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "30666"
    },
    {
      "coffee_id": 50,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "36654"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35731"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35719"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35720"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "28194"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "29794"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "28195"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "35914"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "35913"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "32073"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "33699"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "37201"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "37202"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "37350"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "36167"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37323"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "37351"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "36166"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "37729"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "36863"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "38079"
    },
    {
      "coffee_id": 72,
      "roaster": "Intelligentsia",
      "field": "bean_base_id",
      "from": null,
      "to": "37854"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37320"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37322"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37321"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "36731"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "36732"
    },
    {
      "coffee_id": 80,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "36535"
    },
    {
      "coffee_id": 81,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "36536"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "bean_base_id",
      "from": null,
      "to": "18140"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "bean_base_id",
      "from": null,
      "to": "37460"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "bean_base_id",
      "from": null,
      "to": "25692"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "bean_base_id",
      "from": null,
      "to": "25696"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "bean_base_id",
      "from": null,
      "to": "24974"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "bean_base_id",
      "from": null,
      "to": "25370"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "22663"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "24710"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "24712"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "24711"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "24798"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "24800"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "25948"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "25107"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "22189"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27311"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27311"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "23016"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "26662"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "26663"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "26664"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "25877"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "26105"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "26891"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "26889"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "27333"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "27332"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "bean_base_id",
      "from": null,
      "to": "27331"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "26104"
    },
    {
      "coffee_id": 129,
      "roaster": "Hydrangea",
      "field": "bean_base_id",
      "from": null,
      "to": "20709"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "25885"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "25885"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28300"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28302"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "25599"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27607"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "28792"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "28793"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "28959"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "28959"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "28969"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "25768"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27843"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "28245"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "28244"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "28958"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "26662"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27311"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27311"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "28403"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30095"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30096"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "bean_base_id",
      "from": null,
      "to": "28459"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "bean_base_id",
      "from": null,
      "to": "24998"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "bean_base_id",
      "from": null,
      "to": "30507"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "bean_base_id",
      "from": null,
      "to": "30509"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "bean_base_id",
      "from": null,
      "to": "30508"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "bean_base_id",
      "from": null,
      "to": "23772"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "29283"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "30106"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "30104"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "bean_base_id",
      "from": null,
      "to": "23774"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "bean_base_id",
      "from": null,
      "to": "24999"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "28922"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "28921"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "bean_base_id",
      "from": null,
      "to": "29682"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "30107"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "30104"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "bean_base_id",
      "from": null,
      "to": "28197"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "bean_base_id",
      "from": null,
      "to": "32837"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28302"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "31602"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28307"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28298"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28299"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "31603"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "31612"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "31756"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "32015"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "32019"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "32017"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "32018"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "32016"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "31671"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "26414"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "26414"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30097"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30095"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "bean_base_id",
      "from": null,
      "to": "30096"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "31227"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "31227"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28300"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "30666"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "31203"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "bean_base_id",
      "from": null,
      "to": "35313"
    },
    {
      "coffee_id": 239,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "37906"
    },
    {
      "coffee_id": 240,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "37906"
    },
    {
      "coffee_id": 243,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "38078"
    },
    {
      "coffee_id": 244,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "37799"
    },
    {
      "coffee_id": 245,
      "roaster": "Anamorphic",
      "field": "bean_base_id",
      "from": null,
      "to": "37798"
    },
    {
      "coffee_id": 246,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "28922"
    },
    {
      "coffee_id": 247,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "38360"
    },
    {
      "coffee_id": 248,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "38360"
    },
    {
      "coffee_id": 249,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "36668"
    },
    {
      "coffee_id": 250,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "36668"
    },
    {
      "coffee_id": 251,
      "roaster": "Ordinary",
      "field": "bean_base_id",
      "from": null,
      "to": "38222"
    },
    {
      "coffee_id": 253,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37319"
    },
    {
      "coffee_id": 255,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "27842"
    },
    {
      "coffee_id": 258,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "36671"
    },
    {
      "coffee_id": 259,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "33609"
    },
    {
      "coffee_id": 260,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "28306"
    },
    {
      "coffee_id": 261,
      "roaster": "Big Sur",
      "field": "bean_base_id",
      "from": null,
      "to": "36670"
    },
    {
      "coffee_id": 266,
      "roaster": "Love Letters Charming Coffees",
      "field": "bean_base_id",
      "from": null,
      "to": "38476"
    },
    {
      "coffee_id": 267,
      "roaster": "Love Letters Charming Coffees",
      "field": "bean_base_id",
      "from": null,
      "to": "37326"
    },
    {
      "coffee_id": 268,
      "roaster": "Love Letters Charming Coffees",
      "field": "bean_base_id",
      "from": null,
      "to": "35541"
    },
    {
      "coffee_id": 270,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "38729"
    },
    {
      "coffee_id": 271,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "38808"
    },
    {
      "coffee_id": 272,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "38806"
    },
    {
      "coffee_id": 273,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "40196"
    },
    {
      "coffee_id": 274,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "39015"
    },
    {
      "coffee_id": 275,
      "roaster": "Wooly Lamb Coffee Roasters",
      "field": "bean_base_id",
      "from": null,
      "to": "40997"
    },
    {
      "coffee_id": 276,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "37296"
    },
    {
      "coffee_id": 277,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "28922"
    },
    {
      "coffee_id": 278,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "33243"
    },
    {
      "coffee_id": 279,
      "roaster": "S&W Craft Roasting",
      "field": "bean_base_id",
      "from": null,
      "to": "37865"
    },
    {
      "coffee_id": 281,
      "roaster": "Moonwake Coffee Roasters",
      "field": "bean_base_id",
      "from": null,
      "to": "22322"
    },
    {
      "coffee_id": 285,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "40191"
    },
    {
      "coffee_id": 286,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "40177"
    },
    {
      "coffee_id": 287,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "40176"
    },
    {
      "coffee_id": 288,
      "roaster": "GWO",
      "field": "bean_base_id",
      "from": null,
      "to": "25549"
    },
    {
      "coffee_id": 289,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "38832"
    },
    {
      "coffee_id": 290,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "38834"
    },
    {
      "coffee_id": 291,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40392"
    },
    {
      "coffee_id": 293,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "39257"
    },
    {
      "coffee_id": 294,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "39263"
    },
    {
      "coffee_id": 295,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "39263"
    },
    {
      "coffee_id": 296,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "39258"
    },
    {
      "coffee_id": 297,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "35719"
    },
    {
      "coffee_id": 298,
      "roaster": "Base Coat Coffee Drops",
      "field": "bean_base_id",
      "from": null,
      "to": "36218"
    },
    {
      "coffee_id": 299,
      "roaster": "Base Coat Coffee Drops",
      "field": "bean_base_id",
      "from": null,
      "to": "39464"
    },
    {
      "coffee_id": 300,
      "roaster": "delicate coffee roasters",
      "field": "bean_base_id",
      "from": null,
      "to": "39280"
    },
    {
      "coffee_id": 301,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "38833"
    },
    {
      "coffee_id": 302,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "39689"
    },
    {
      "coffee_id": 303,
      "roaster": "Noumenon Coffee",
      "field": "bean_base_id",
      "from": null,
      "to": "33346"
    },
    {
      "coffee_id": 305,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "bean_base_id",
      "from": null,
      "to": "38736"
    },
    {
      "coffee_id": 306,
      "roaster": "PORT2050 COFFEE ROASTERS",
      "field": "bean_base_id",
      "from": null,
      "to": "37694"
    },
    {
      "coffee_id": 308,
      "roaster": "Noumenon Coffee",
      "field": "bean_base_id",
      "from": null,
      "to": "37497"
    },
    {
      "coffee_id": 309,
      "roaster": "Noumenon Coffee",
      "field": "bean_base_id",
      "from": null,
      "to": "38203"
    },
    {
      "coffee_id": 310,
      "roaster": "Noumenon Coffee",
      "field": "bean_base_id",
      "from": null,
      "to": "37496"
    },
    {
      "coffee_id": 311,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "38438"
    },
    {
      "coffee_id": 312,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "38807"
    },
    {
      "coffee_id": 313,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "38808"
    },
    {
      "coffee_id": 314,
      "roaster": "Luna",
      "field": "bean_base_id",
      "from": null,
      "to": "37698"
    },
    {
      "coffee_id": 315,
      "roaster": "Luna",
      "field": "bean_base_id",
      "from": null,
      "to": "36136"
    },
    {
      "coffee_id": 316,
      "roaster": "Luna",
      "field": "bean_base_id",
      "from": null,
      "to": "36137"
    },
    {
      "coffee_id": 317,
      "roaster": "Luna",
      "field": "bean_base_id",
      "from": null,
      "to": "37728"
    },
    {
      "coffee_id": 318,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "37662"
    },
    {
      "coffee_id": 319,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "37662"
    },
    {
      "coffee_id": 320,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "37663"
    },
    {
      "coffee_id": 321,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "37663"
    },
    {
      "coffee_id": 322,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "33256"
    },
    {
      "coffee_id": 323,
      "roaster": "Ceto",
      "field": "bean_base_id",
      "from": null,
      "to": "33256"
    },
    {
      "coffee_id": 327,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "40722"
    },
    {
      "coffee_id": 328,
      "roaster": "norml coffee ppl",
      "field": "bean_base_id",
      "from": null,
      "to": "40722"
    },
    {
      "coffee_id": 329,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "37319"
    },
    {
      "coffee_id": 330,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "40151"
    },
    {
      "coffee_id": 331,
      "roaster": "Scenery",
      "field": "bean_base_id",
      "from": null,
      "to": "39212"
    },
    {
      "coffee_id": 332,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "40039"
    },
    {
      "coffee_id": 333,
      "roaster": "Shoebox",
      "field": "bean_base_id",
      "from": null,
      "to": "40038"
    },
    {
      "coffee_id": 334,
      "roaster": "Flower Child",
      "field": "bean_base_id",
      "from": null,
      "to": "18818"
    },
    {
      "coffee_id": 335,
      "roaster": "Flower Child",
      "field": "bean_base_id",
      "from": null,
      "to": "39294"
    },
    {
      "coffee_id": 336,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "39886"
    },
    {
      "coffee_id": 337,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "39874"
    },
    {
      "coffee_id": 338,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "38964"
    },
    {
      "coffee_id": 339,
      "roaster": "Sey",
      "field": "bean_base_id",
      "from": null,
      "to": "39876"
    },
    {
      "coffee_id": 340,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "40510"
    },
    {
      "coffee_id": 341,
      "roaster": "H&S",
      "field": "bean_base_id",
      "from": null,
      "to": "40509"
    },
    {
      "coffee_id": 342,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40392"
    },
    {
      "coffee_id": 343,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40388"
    },
    {
      "coffee_id": 344,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40391"
    },
    {
      "coffee_id": 345,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40391"
    },
    {
      "coffee_id": 346,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40390"
    },
    {
      "coffee_id": 347,
      "roaster": "Bean's Beans",
      "field": "bean_base_id",
      "from": null,
      "to": "40389"
    },
    {
      "coffee_id": 351,
      "roaster": "Botz",
      "field": "bean_base_id",
      "from": null,
      "to": "39814"
    },
    {
      "coffee_id": 352,
      "roaster": "Goût & Co Specialty Coffee Roastery",
      "field": "bean_base_id",
      "from": null,
      "to": "39122"
    },
    {
      "coffee_id": 353,
      "roaster": "Goût & Co Specialty Coffee Roastery",
      "field": "bean_base_id",
      "from": null,
      "to": "34314"
    },
    {
      "coffee_id": 354,
      "roaster": "Love Letters Charming Coffees",
      "field": "bean_base_id",
      "from": null,
      "to": "39342"
    }
  ],
  "websites": [],
  "tavilyCalls": []
},
];
