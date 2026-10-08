// Product page + image backfill batches (spec
// docs/superpowers/specs/2026-10-07-product-page-backfill-design.md §4). Each
// is applied once at boot under its own marker (applyCoffeeFixes, coffees.ts).
// Data only, appended by `python3 -I scripts/backfill-review.py export`: never
// type or edit a URL here by hand. The file must end with the `];` line.
import type { CoffeeFixBatch } from './coffees';

export const PRODUCT_PAGE_BACKFILLS: CoffeeFixBatch[] = [
{
  "marker": "product_page_backfill_2026_10_a",
  "fixes": [
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/028-jhon-didier-trujillo"
    },
    {
      "coffee_id": 60,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/028_tile.png?v=1778533034"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/029-alina-milagros"
    },
    {
      "coffee_id": 61,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/029_tile.png?v=1784044081"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/xx6-san-jeronimo-miramar"
    },
    {
      "coffee_id": 65,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/xx6_tile.png?v=1785887761"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gute-village"
    },
    {
      "coffee_id": 58,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/AloRedHoneyTransparent_1.png?v=1786429677"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/fugi-ikizere"
    },
    {
      "coffee_id": 66,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Fugitransparent.png?v=1788564747"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gaia-estate-airworks-exclusive"
    },
    {
      "coffee_id": 59,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/GaiaGeshaTransparent_1.png?v=1786430106"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gesha-village-oma-natural-26-147"
    },
    {
      "coffee_id": 74,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/omaTransparent.png?v=1788569761"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/heza"
    },
    {
      "coffee_id": 75,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Hezahoneytransparent.png?v=1788567750"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/yulissa-chambi"
    },
    {
      "coffee_id": 76,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Yulissatransparent.png?v=1788565587"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/yunguilla-juan-pena"
    },
    {
      "coffee_id": 77,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/YunguillaMejotransparent.png?v=1788565937"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/habtamu-fikadu-washed"
    },
    {
      "coffee_id": 36,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/Chelbesa.png?v=1785278628"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/habtamu-fikadu-washed"
    },
    {
      "coffee_id": 37,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/Chelbesa.png?v=1785278628"
    },
    {
      "coffee_id": 1,
      "roaster": "Ceto",
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/marlon-bolanos-washed-pb-decaf"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-la-fortuna-bourbon-aji"
    },
    {
      "coffee_id": 20,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/666-COL-La-Fortuna-WBA-A.png?v=1785694019"
    },
    {
      "coffee_id": 72,
      "roaster": "Intelligentsia",
      "field": "product_url",
      "from": null,
      "to": "https://www.intelligentsia.com/products/ethiopia-gesha-village-oma-natural"
    },
    {
      "coffee_id": 72,
      "roaster": "Intelligentsia",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0084/8802/6172/files/EthiopiaGeshaVillageOmaNatural_1.png?v=1789142053"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-alejandrina-maytan-kukipata-peru"
    },
    {
      "coffee_id": 62,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026AlejandrinaMaytan_Kukipata-Peru.png?v=1788402464"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-demeka-becha-ethiopia"
    },
    {
      "coffee_id": 78,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026DemekaBecha-Ethiopia.png?v=1787786573"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-ashenafi-getaneh-black-honey"
    },
    {
      "coffee_id": 69,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Ashenafi-shopify.png?v=1789315852"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-bookissa-natural"
    },
    {
      "coffee_id": 51,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Bookissa-shopify.png?v=1786216160"
    },
    {
      "coffee_id": 52,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-getachew-zeleke-washed2026"
    },
    {
      "coffee_id": 52,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Getachew_2026_-shopify.png?v=1786215988"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-getachew-zeleke-washed2026"
    },
    {
      "coffee_id": 53,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Getachew_2026_-shopify.png?v=1786215988"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-habtamu-fikadu-aga-washed"
    },
    {
      "coffee_id": 54,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Habtamu-shopify.png?v=1786215679"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/kenya-kamwangi-aa-washed"
    },
    {
      "coffee_id": 70,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/KamwangiAA-shopify.png?v=1788107841"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-mr-tadese-teko-washed2026"
    },
    {
      "coffee_id": 48,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Mr.Tadese_2026_-shopify.png?v=1785684555"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-mulish-washed"
    },
    {
      "coffee_id": 71,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Mulish-shopify.png?v=1789919305"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/panama-eyla-gesha-honey"
    },
    {
      "coffee_id": 26,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/EylaHoney-shopify_74c00abf-b9ca-4782-b926-cc152829d30f.png?v=1782056636"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "product_url",
      "from": null,
      "to": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "coffee_id": 232,
      "roaster": "Still",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0933/3142/3573/files/samii.jpg?v=1785098241"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "product_url",
      "from": null,
      "to": "https://sweetbloomcoffee.com/products/danche"
    },
    {
      "coffee_id": 43,
      "roaster": "Sweet Bloom",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0673/6999/2257/files/sweet-bloom-danche-26.png?v=1785878553"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/kenya-inoi-kianderi-aa-043-250g"
    },
    {
      "coffee_id": 44,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_da0d4805ca10426b8563ef4689b24bd8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/kenya-ruera-estate-pb-031-250g"
    },
    {
      "coffee_id": 46,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_4351ed6d97524c8ca05123c9cbf26074~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/030-san-jeronimo-miramar"
    },
    {
      "coffee_id": 68,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://aviary.coffee/cdn/shop/files/030tile.png?v=1785887650"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/ecuador-abel-salinas"
    },
    {
      "coffee_id": 49,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/677-ECU-Abel-A_731bef6c-c1eb-4460-90f8-0648259c0467.png?v=1779717451"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-la-fortuna-pink-bourbon"
    },
    {
      "coffee_id": 18,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/665-COL-La-Fortuna-WPB-A.png?v=1785693362"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/burundi-mikuba-8"
    },
    {
      "coffee_id": 64,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/718-BUR-Mikuba-A.png?v=1788706055"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-yessica-parra"
    },
    {
      "coffee_id": 67,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/656-COL-Yessica-A.png?v=1788705248"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "product_url",
      "from": null,
      "to": "https://lumeroasters.coffee/products/luz-helena-salazar-100g"
    },
    {
      "coffee_id": 22,
      "roaster": "Lume",
      "field": "image_url",
      "from": null,
      "to": "https://lumeroasters.coffee/cdn/shop/files/baglabel_productpage_3.png?v=1783620614"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-sike-bokasso-ethiopia"
    },
    {
      "coffee_id": 79,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026SikeBokasso-Ethiopia.png?v=1787784425"
    },
    {
      "coffee_id": 40,
      "roaster": "Still",
      "field": "product_url",
      "from": null,
      "to": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "coffee_id": 40,
      "roaster": "Still",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0933/3142/3573/files/samii.jpg?v=1785098241"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/colombia-finca-el-turpial-washed-geisha-125g"
    },
    {
      "coffee_id": 30,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_1e51446cd76a4a9996d10b55203c6ab8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-048-oma"
    },
    {
      "coffee_id": 29,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_eeaa68192b4b41e2abcd2629261200e8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/copie-de-panama-hacienda-la-esmeralda-lino-5-wb-washed-geisha"
    },
    {
      "coffee_id": 47,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_69f35f8b9e9445158c0c99d91f687fbb~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-faysel-abdosh-single-farm-premium-150g"
    },
    {
      "coffee_id": 19,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_36-1.png?v=1774340528"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "product_url",
      "from": null,
      "to": "https://normlppl.coffee/products/gilber-huayallas-sl9-50g-1-76oz-roasted-09-30-2026"
    },
    {
      "coffee_id": 34,
      "roaster": "norml coffee ppl",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0741/5880/1034/files/sl09shopify_a8214381-1472-4b65-9a37-f7447ab5e806.png?v=1790805405"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://beanhoard.com/roaster/scenery-coffee/ethiopia-kebena-natural-decaf"
    },
    {
      "coffee_id": 2,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0779/1961/7334/files/ethiopia_kebena_decaf_shopify.png?v=1777983100"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-mate-matiwos-keramo-ethiopia"
    },
    {
      "coffee_id": 63,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026MateMatiwos_Keramo-Ethiopia.png?v=1788392669"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-046"
    },
    {
      "coffee_id": 27,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_7f90e237d9f841b482a3975b5c9a36b5~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-047"
    },
    {
      "coffee_id": 28,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_73e0177125cb4f8dba45cd4cc5ef703a~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://x.com/xliiicoffee/status/2058805264200188159?lang=bg"
    },
    {
      "coffee_id": 56,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://pbs.twimg.com/media/HJIR24MbkAAN0w7?format=webp&name=large"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/gikirima"
    },
    {
      "coffee_id": 15,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": "https://gwo.coffee/cdn/shop/files/24.png?v=1780224281"
    },
    {
      "coffee_id": 4,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/el-paraiso-decaf"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/product/nueva-alianza-sidra-4736/"
    },
    {
      "coffee_id": 57,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://xliiicoffee.com/wp-content/uploads/2026/03/202603201017-Nueva-Alianza-Sidra-4736.webp"
    }
  ],
  "websites": [
    {
      "roaster": "Aviary",
      "url": "https://aviary.coffee/products/028-jhon-didier-trujillo"
    },
    {
      "roaster": "Aviary",
      "url": "https://aviary.coffee/products/029-alina-milagros"
    },
    {
      "roaster": "Aviary",
      "url": "https://aviary.coffee/products/xx6-san-jeronimo-miramar"
    },
    {
      "roaster": "H&S",
      "url": "https://hscoffeeroasters.com/products/colombia-la-fortuna-bourbon-aji"
    },
    {
      "roaster": "Intelligentsia",
      "url": "https://www.intelligentsia.com/products/ethiopia-gesha-village-oma-natural"
    },
    {
      "roaster": "Sey",
      "url": "https://www.seycoffee.com/products/2026-alejandrina-maytan-kukipata-peru"
    },
    {
      "roaster": "Sey",
      "url": "https://www.seycoffee.com/products/2026-demeka-becha-ethiopia"
    },
    {
      "roaster": "Still",
      "url": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "roaster": "Sweet Bloom",
      "url": "https://sweetbloomcoffee.com/products/danche"
    },
    {
      "roaster": "Aviary",
      "url": "https://aviary.coffee/products/030-san-jeronimo-miramar"
    },
    {
      "roaster": "H&S",
      "url": "https://hscoffeeroasters.com/products/ecuador-abel-salinas"
    },
    {
      "roaster": "H&S",
      "url": "https://hscoffeeroasters.com/products/colombia-la-fortuna-pink-bourbon"
    },
    {
      "roaster": "H&S",
      "url": "https://hscoffeeroasters.com/products/burundi-mikuba-8"
    },
    {
      "roaster": "H&S",
      "url": "https://hscoffeeroasters.com/products/colombia-yessica-parra"
    },
    {
      "roaster": "Lume",
      "url": "https://lumeroasters.coffee/products/luz-helena-salazar-100g"
    },
    {
      "roaster": "Sey",
      "url": "https://www.seycoffee.com/products/2026-sike-bokasso-ethiopia"
    },
    {
      "roaster": "Still",
      "url": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "roaster": "Scenery",
      "url": "https://beanhoard.com/roaster/scenery-coffee/ethiopia-kebena-natural-decaf"
    },
    {
      "roaster": "Sey",
      "url": "https://www.seycoffee.com/products/2026-mate-matiwos-keramo-ethiopia"
    },
    {
      "roaster": "XLIII",
      "url": "https://x.com/xliiicoffee/status/2058805264200188159?lang=bg"
    },
    {
      "roaster": "GWO",
      "url": "https://gwo.coffee/products/gikirima"
    },
    {
      "roaster": "XLIII",
      "url": "https://xliiicoffee.com/en/product/nueva-alianza-sidra-4736/"
    }
  ],
  "tavilyCalls": [
    "2026-10-07T07:42:02.654Z",
    "2026-10-07T07:42:04.674Z",
    "2026-10-07T07:42:06.762Z",
    "2026-10-07T07:42:08.487Z",
    "2026-10-07T07:42:11.778Z",
    "2026-10-07T07:42:13.465Z",
    "2026-10-07T07:42:16.407Z",
    "2026-10-07T07:42:18.200Z",
    "2026-10-07T07:42:20.483Z",
    "2026-10-07T07:42:22.752Z",
    "2026-10-07T07:42:26.050Z",
    "2026-10-07T07:42:28.911Z",
    "2026-10-07T07:42:31.384Z",
    "2026-10-07T07:42:33.591Z",
    "2026-10-07T07:42:35.500Z",
    "2026-10-07T07:42:38.518Z",
    "2026-10-07T07:42:42.451Z",
    "2026-10-07T07:42:43.095Z",
    "2026-10-07T07:42:45.582Z",
    "2026-10-07T07:42:49.943Z",
    "2026-10-07T07:42:52.069Z",
    "2026-10-07T07:42:55.820Z",
    "2026-10-07T07:42:57.551Z",
    "2026-10-07T07:43:00.427Z",
    "2026-10-07T07:43:03.066Z",
    "2026-10-07T07:43:04.406Z",
    "2026-10-07T07:43:06.831Z",
    "2026-10-07T07:43:10.012Z",
    "2026-10-07T07:43:12.655Z",
    "2026-10-07T07:43:14.604Z",
    "2026-10-07T07:43:16.776Z",
    "2026-10-07T07:43:18.698Z",
    "2026-10-07T07:43:20.749Z",
    "2026-10-07T07:43:23.071Z",
    "2026-10-07T07:43:27.038Z",
    "2026-10-07T07:43:30.282Z",
    "2026-10-07T07:43:32.224Z",
    "2026-10-07T07:43:36.298Z",
    "2026-10-07T07:43:38.051Z",
    "2026-10-07T07:43:39.670Z",
    "2026-10-07T07:43:42.991Z",
    "2026-10-07T07:43:44.888Z",
    "2026-10-07T07:43:48.355Z",
    "2026-10-07T07:43:50.520Z",
    "2026-10-07T07:43:51.379Z",
    "2026-10-07T07:43:53.631Z",
    "2026-10-07T07:43:55.432Z",
    "2026-10-07T07:43:58.723Z",
    "2026-10-07T07:44:00.818Z",
    "2026-10-07T07:44:02.515Z",
    "2026-10-07T07:44:05.148Z",
    "2026-10-07T07:44:07.149Z",
    "2026-10-07T07:44:08.789Z",
    "2026-10-07T07:44:12.355Z",
    "2026-10-07T07:44:14.309Z",
    "2026-10-07T07:44:17.316Z",
    "2026-10-07T07:44:18.769Z",
    "2026-10-07T07:44:23.604Z",
    "2026-10-07T07:44:25.492Z",
    "2026-10-07T07:44:26.872Z",
    "2026-10-07T07:44:29.183Z",
    "2026-10-07T07:44:30.709Z",
    "2026-10-07T07:44:33.897Z"
  ]
},
{
  "marker": "product_page_backfill_2026_10_archive_a",
  "fixes": [
    {
      "coffee_id": 13,
      "roaster": "Anamorphic",
      "field": "product_url",
      "from": null,
      "to": "https://anamorphiccoffee.com/products/bnivaans-aa"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "product_url",
      "from": null,
      "to": "https://anamorphiccoffee.com/products/bukeye-hills"
    },
    {
      "coffee_id": 136,
      "roaster": "Anamorphic",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0757/4201/9805/files/ac_mock_filter_26_5c64dd28-14a5-433e-810f-9cce025d2525.png?v=1770354440"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "product_url",
      "from": null,
      "to": "https://anamorphiccoffee.com/products/bukeye-hills"
    },
    {
      "coffee_id": 137,
      "roaster": "Anamorphic",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0757/4201/9805/files/ac_mock_filter_26_5c64dd28-14a5-433e-810f-9cce025d2525.png?v=1770354440"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "product_url",
      "from": null,
      "to": "https://anamorphiccoffee.com/products/finca-el-barejon"
    },
    {
      "coffee_id": 207,
      "roaster": "Anamorphic",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0757/4201/9805/files/BAR_mock_light_26.png?v=1780837809"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "product_url",
      "from": null,
      "to": "https://anamorphiccoffee.com/products/gitutu-aa"
    },
    {
      "coffee_id": 14,
      "roaster": "Anamorphic",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0757/4201/9805/files/mock_light_26_46b74965-171b-47d8-a78e-3a39061a53b2.png?v=1783244466"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/026-lino-rodriguez"
    },
    {
      "coffee_id": 172,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/026tile.png?v=1775852268"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/eduardo-armero"
    },
    {
      "coffee_id": 212,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/EduardoArmeroPBTransparent.png?v=1781286983"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gilber-huallyas"
    },
    {
      "coffee_id": 209,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/SL09Transparent.png?v=1781290103"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/la-terraza"
    },
    {
      "coffee_id": 213,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/LaTerazzaJavaTransparent.png?v=1781288969"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/rex-raguni"
    },
    {
      "coffee_id": 214,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/PNGMongslowdryTransparent_1.png?v=1781288257"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/yacuri-juan-pena"
    },
    {
      "coffee_id": 215,
      "roaster": "Bean's Beans",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/YacuriSidraTransparent.png?v=1781289516"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-faysel-abdosh-single-farm-premium-150g"
    },
    {
      "coffee_id": 204,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_36-1.png?v=1774340528"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-sidama-bura-keramo-gara-agena-g1-premium-washed-150g"
    },
    {
      "coffee_id": 201,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_39-1.png?v=1775619951"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-mascincho-premium"
    },
    {
      "coffee_id": 139,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_35-1_273ebb7d-5a26-4a25-9e8b-f0712c49fea3.png?v=1774339199"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-sewda-premium"
    },
    {
      "coffee_id": 141,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_34-1_0a4c39af-dfde-4f5b-a360-b9d9721e8c9f.png?v=1773382049"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-sewda-premium"
    },
    {
      "coffee_id": 199,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_34-1_0a4c39af-dfde-4f5b-a360-b9d9721e8c9f.png?v=1773382049"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "product_url",
      "from": null,
      "to": "https://botz-coffee.com/products/gakuyuini"
    },
    {
      "coffee_id": 180,
      "roaster": "Botz",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0266/5591/6066/files/GAKUYUINILABELS.png?v=1779280880"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "product_url",
      "from": null,
      "to": "https://botz-coffee.com/products/juan-valenzuela"
    },
    {
      "coffee_id": 178,
      "roaster": "Botz",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0266/5591/6066/files/JUANVALENZUELALABEL.png?v=1779280782"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "product_url",
      "from": null,
      "to": "https://botz-coffee.com/products/kihuyo"
    },
    {
      "coffee_id": 179,
      "roaster": "Botz",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0266/5591/6066/files/KIHUYO_c4086911-f9dd-4f5d-a9ef-c6af966d0bee.png?v=1779280757"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/sebastian-ramirez-red-fruits-decaf"
    },
    {
      "coffee_id": 188,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/redfruitsdecaf.png?v=1776468273"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/sebastian-ramirez-washed-decaf"
    },
    {
      "coffee_id": 189,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/WashedDecaf_555046f1-ee78-4d68-90ac-aa4269d27594.png?v=1776468644"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "product_url",
      "from": null,
      "to": "https://flowerchildcoffee.com/products/robinson-luis"
    },
    {
      "coffee_id": 92,
      "roaster": "Flower Child",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0623/3866/2579/files/IMG_1431.jpg?v=1766978369"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/eudis-orosco"
    },
    {
      "coffee_id": 11,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/1008/9083/7321/files/32.png?v=1782665802"
    },
    {
      "coffee_id": 12,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/finca-pacpa"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/nugise-jilo"
    },
    {
      "coffee_id": 16,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/1008/9083/7321/files/26_e3191e0e-817e-42eb-8158-b1ec4e243db9.png?v=1780602504"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/la-chirimoya"
    },
    {
      "coffee_id": 7,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/1008/9083/7321/files/23.png?v=1777299069"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/ecuador-abel-salinas"
    },
    {
      "coffee_id": 229,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/677-ECU-Abel-A_731bef6c-c1eb-4460-90f8-0648259c0467.png?v=1779717451"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/ecuador-juan-pena-natural-mejorado"
    },
    {
      "coffee_id": 25,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/622-ECU-La-Papaya-NTM-A.png?v=1785694359"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/peru-efrain-carhuallocllo"
    },
    {
      "coffee_id": 205,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/671-PER-Efrain-A.png?v=1780667233"
    },
    {
      "coffee_id": 221,
      "roaster": "Lume",
      "field": "product_url",
      "from": null,
      "to": "https://lumeroasters.coffee/products/masha-washing-station-100g"
    },
    {
      "coffee_id": 221,
      "roaster": "Lume",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0671/5939/2339/files/baglabel_productpage_2.png?v=1778941466"
    },
    {
      "coffee_id": 23,
      "roaster": "Lume",
      "field": "product_url",
      "from": null,
      "to": "https://lumeroasters.coffee/products/ngomano-factory-50g"
    },
    {
      "coffee_id": 23,
      "roaster": "Lume",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0671/5939/2339/files/baglabel_productpage_1.svg?v=1776376346"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "product_url",
      "from": null,
      "to": "https://lumeroasters.coffee/products/pepe-jijon-100g"
    },
    {
      "coffee_id": 24,
      "roaster": "Lume",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0671/5939/2339/files/bag_label_product_page_4.png?v=1784947312"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-gesha-washed-el-hatillo"
    },
    {
      "coffee_id": 121,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/elhatillo100cards-01.png?v=1773673793"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-gesha-washed-el-salado"
    },
    {
      "coffee_id": 119,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/elsaladoyuri-01.png?v=1773673933"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-natural-pink-champagne-pink-bourbon"
    },
    {
      "coffee_id": 94,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/pinkchapagnepinkbourbonnatural-01.png?v=1768889664"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-natural-tartaric-acid-pink-bourbon-cold-room"
    },
    {
      "coffee_id": 95,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/tartaricpinkbourboncoldroomnat-01.png?v=1772783873"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-sidra-honey-la-cruz"
    },
    {
      "coffee_id": 120,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/LACRUZHONEY100CARDS-01.png?v=1773673831"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-washed-pink-champagne-pink-bourbon"
    },
    {
      "coffee_id": 93,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/pinkchapagnepinkbourbonwashed-01.png?v=1763666047"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "product_url",
      "from": null,
      "to": "https://www.loveluminous.coffee/products/colombia-washed-tartaric-acid-orange-bourbon-cold-room"
    },
    {
      "coffee_id": 96,
      "roaster": "Luminous",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0634/4500/8484/files/tartaricoragnebourboncoldroomwash-01_51019b87-3bf8-4f0c-86a7-980e7030e2f8.png?v=1784825862"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "product_url",
      "from": null,
      "to": "https://normlppl.coffee/products/andcoffee-ako-sidama-200g-7-05oz-roasted-10-01-2026"
    },
    {
      "coffee_id": 33,
      "roaster": "norml coffee ppl",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0741/5880/1034/files/wholesale-no-box-42722667004042.png?v=1790656262"
    },
    {
      "coffee_id": 10,
      "roaster": "Ordinary",
      "field": "product_url",
      "from": null,
      "to": "https://shop.ordinarycoffeeroasters.com/products/gakenke-burundi-washed-bourbon"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "product_url",
      "from": null,
      "to": "https://specialitycoffee.ca/products/prodigal-el-espejo-ii-gesha"
    },
    {
      "coffee_id": 84,
      "roaster": "Prodigal",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/1013/7409/9739/files/WEBEspejoII_204cba03-40dc-480b-8878-ed5cdedb95b2.webp?v=1775078756"
    },
    {
      "coffee_id": 82,
      "roaster": "Prodigal",
      "field": "product_url",
      "from": null,
      "to": "https://www.kofio.co/coffee/colombia-las-perlitas-chiroso-prodigal-coffee/19683"
    },
    {
      "coffee_id": 82,
      "roaster": "Prodigal",
      "field": "image_url",
      "from": null,
      "to": "https://st.kofio.co/img_product/ljQWnINYqUXASgu/19683/sq_600_gWphIl7U4LA5NunT8JaB_118857.png"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "product_url",
      "from": null,
      "to": "https://beanbook.app/coffee/beans/rogue-wave--colombia-la-macarena-oscar-riascos-geisha-washed__bd89ffcb-aeea-4848-90f4-b37967012f7b"
    },
    {
      "coffee_id": 195,
      "roaster": "Rogue Wave",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0042/0773/8992/files/ColombiaLaMacarenaOscarRiascosGeishaWashed200gBAG.jpg?v=1779901486"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://beanhoard.com/roaster/scenery-coffee/burundi-giku-fw-lot-5-25-26"
    },
    {
      "coffee_id": 169,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0779/1961/7334/files/burundi_giku_fw_lot5_shopify.png?v=1775828849"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://beanhoard.com/roaster/scenery-coffee/colombia-hugo-gonzalez-s-gesha-copa-de-oro-grand-champion"
    },
    {
      "coffee_id": 206,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0779/1961/7334/files/colombia_hugo_gonzalez_shopify.png?v=1780669314"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "product_url",
      "from": null,
      "to": "https://september.coffee/products/abel-salinas-ecuador-washed-mejorado-2026"
    },
    {
      "coffee_id": 190,
      "roaster": "September",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0564/8557/6802/files/Abel_Salinas_-_May_2026_815fe02e-83bd-4390-ac45-ce491c9fd867.jpg?v=1778872832"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "product_url",
      "from": null,
      "to": "https://september.coffee/en-us/collections/coffee/products/abel-salinas-ecuador-washed-mejorado-2026"
    },
    {
      "coffee_id": 230,
      "roaster": "September",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0564/8557/6802/files/Abel_Salinas_-_May_2026_815fe02e-83bd-4390-ac45-ce491c9fd867.jpg?v=1778872832"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-armando-hurtado-los-pinos-peru"
    },
    {
      "coffee_id": 118,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026ArmandoHurtado_LosPinos-Peru.png?v=1772696158"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-bukeye-gaharo-hill-burundi"
    },
    {
      "coffee_id": 99,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026Bukeye_GaharoHill-Burundi.png?v=1769048026"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-diego-parra-la-hacienda-new-season-colombia"
    },
    {
      "coffee_id": 102,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026DiegoParra_LaHacienda_NewSeason-Colombia.png?v=1769699279"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-lisbeth-quispe-yanacocha-peru"
    },
    {
      "coffee_id": 162,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026LisbethQuispe_Yanacocha-Peru.png?v=1775722063"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-wilbert-almanza-bella-rosa-peru"
    },
    {
      "coffee_id": 117,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026WilbertAlmanza_BellaRosa-Peru.png?v=1772695608"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-william-ortiz-la-cabana-chiroso-colombia"
    },
    {
      "coffee_id": 163,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026WilliamOrtiz_LaCabana_Chiroso-Colombia.png?v=1775722740"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-william-ortiz-la-cabana-pink-bourbon-colombia"
    },
    {
      "coffee_id": 100,
      "roaster": "Sey",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026WilliamOrtiz_LaCabana_PinkBourbon-Colombia.png?v=1769047669"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/brazil-marcelo-assis-bioma-natural"
    },
    {
      "coffee_id": 164,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marcelo-shopify.png?v=1776613464"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/burundi-bavyevi-iv-natural"
    },
    {
      "coffee_id": 182,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/BavyeviIV-shopify_2985e74f-2f53-4287-b017-3f355fc8e67f.png?v=1777218245"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-carlos-estrella-gesha-washed"
    },
    {
      "coffee_id": 192,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/CarlosEstrella-shopify.png?v=1778428249"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-el-obraje-gesha-washed"
    },
    {
      "coffee_id": 115,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/El_Obraje_Gesha_-_shopify.png?v=1770566728"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-emiliano-lame-gesha-washed-copa-de-oro-2"
    },
    {
      "coffee_id": 116,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Emiliano-shopify.png?v=1771173965"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-jeisson-burbano-gesha-washed"
    },
    {
      "coffee_id": 183,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/JeissonBurbano-shopify.png?v=1778428423"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-luis-edgar-camacho-fragrancia-washed"
    },
    {
      "coffee_id": 161,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Luis_-_shopify.png?v=1774798447"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-gesha-natural"
    },
    {
      "coffee_id": 184,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon-shopify_14df10f9-ba99-4699-8a26-079e3985a543.png?v=1778428105"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-gesha-natural"
    },
    {
      "coffee_id": 193,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon-shopify_14df10f9-ba99-4699-8a26-079e3985a543.png?v=1778428105"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-ombligon-natural-ea-decaf"
    },
    {
      "coffee_id": 167,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon_decaf_-_shopify.png?v=1773587741"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-ombligon-natural-ea-decaf"
    },
    {
      "coffee_id": 168,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon_decaf_-_shopify.png?v=1773587741"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-yessica-diego-parra-pink-bourbon-honey"
    },
    {
      "coffee_id": 154,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/YessicaPBHoney-shopify.png?v=1774192097"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-yessica-diego-parra-aji-washed"
    },
    {
      "coffee_id": 157,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/YessicaAji-hopify.png?v=1776613496"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-yessica-diego-parra-aji-washed"
    },
    {
      "coffee_id": 158,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/YessicaAji-hopify.png?v=1776613496"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-yilver-pajoy-gesha-washed-copa-de-oro-5"
    },
    {
      "coffee_id": 123,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Yilver_-_insta.png?v=1771174170"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-matte-matosa-anaerobic"
    },
    {
      "coffee_id": 108,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/MatteMatosaAnae-shopify.png?v=1763311333"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/rwanda-fugi-ikizere-washed-1"
    },
    {
      "coffee_id": 216,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Ikizere-shopify.png?v=1780843269"
    },
    {
      "coffee_id": 3,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/rwanda-fugi-kiyonza-washed"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-jigesa-washed"
    },
    {
      "coffee_id": 38,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Jigesa-shopify.png?v=1785684729"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-jigesa-washed"
    },
    {
      "coffee_id": 39,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Jigesa-shopify.png?v=1785684729"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-ombligon-natural-ea-decaf"
    },
    {
      "coffee_id": 109,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon_decaf_-_shopify.png?v=1773587741"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-ombligon-natural-ea-decaf"
    },
    {
      "coffee_id": 110,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon_decaf_-_shopify.png?v=1773587741"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/panama-eyla-gesha-washed"
    },
    {
      "coffee_id": 231,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/EylaWashed-shopify.png?v=1780241527"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "product_url",
      "from": null,
      "to": "https://sweetbloomcoffee.com/products/rambagirakawa-1"
    },
    {
      "coffee_id": 88,
      "roaster": "Sweet Bloom",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0673/6999/2257/files/sweet-bloom-ramba-25.png?v=1767643811"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "product_url",
      "from": null,
      "to": "https://walnutscoffee.com/products/halo-golden-honey"
    },
    {
      "coffee_id": 177,
      "roaster": "walnuts",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0598/4305/1669/files/HaloGoldenHoney.png?v=1790762783"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/product/nueva-alianza-inca-gesha-4734"
    },
    {
      "coffee_id": 143,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://xliiicoffee.com/wp-content/uploads/2026/01/202601080244-Nueva-Alianza-Inca-Gesha.webp"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/product/nueva-alianza-mejorada-4732"
    },
    {
      "coffee_id": 55,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://xliiicoffee.com/wp-content/uploads/2026/02/202602090838-Nueva-Alianza-Mejorada-4732.webp"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/product/nueva-alianza-orange-gesha-4737"
    },
    {
      "coffee_id": 196,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://xliiicoffee.com/wp-content/uploads/2026/03/202603201017-Nueva-Alianza-Orange-Gesha-4737.webp"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-kenya-washed-kivanga-estate-aa-150g"
    },
    {
      "coffee_id": 202,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_37-1.png?v=1774342713"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-mascincho-premium"
    },
    {
      "coffee_id": 228,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_35-1_273ebb7d-5a26-4a25-9e8b-f0712c49fea3.png?v=1774339199"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/26-new-season-colombia-huila-washed-pink-bourbon-pure-bloom-150g"
    },
    {
      "coffee_id": 225,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_36-1_f81ec726-3f73-4c5e-a129-45bda8900ea2.png?v=1780299417"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/26-new-season-colombia-huila-washed-pink-bourbon-pure-bloom-150g"
    },
    {
      "coffee_id": 226,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_36-1_f81ec726-3f73-4c5e-a129-45bda8900ea2.png?v=1780299417"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "product_url",
      "from": null,
      "to": "https://flowerchildcoffee.com/products/gaharo"
    },
    {
      "coffee_id": 91,
      "roaster": "Flower Child",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0623/3866/2579/files/IMG_1451.jpg?v=1766977371"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "product_url",
      "from": null,
      "to": "https://flowerchildcoffee.com/products/lisbeth-marino"
    },
    {
      "coffee_id": 191,
      "roaster": "Flower Child",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0623/3866/2579/files/LisbethMorenoLabel.jpg?v=1776461810"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "product_url",
      "from": null,
      "to": "https://enjoylunacoffee.com/products/karatu-aa-sl28-washed"
    },
    {
      "coffee_id": 197,
      "roaster": "Luna",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0736/6829/6761/files/karatu-kenya-luna-bag.jpg?v=1781652293"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/147-colombia-la-soledad-9-aji-crop-25-26-archive"
    },
    {
      "coffee_id": 155,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/colombia_la_soledad_aji_shopify.png?v=1780381502"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/140-ecuador-mario-hervas-mejorado-fw-crop-25-26-archive"
    },
    {
      "coffee_id": 156,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/ecuador_mario_hervas_fw_shopify.png?v=1779037638"
    },
    {
      "coffee_id": 9,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/176-ethiopia-worka-chelbesa-fw-crop-25-26-archive"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/143-peru-las-etiopes-gesha-lot-14-crop-25-26-archive"
    },
    {
      "coffee_id": 148,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/peru_las_etiopes_gesha_shopify.png?v=1779086204"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/144-peru-wilson-mamani-contreras-gesha-crop-25-26-archive"
    },
    {
      "coffee_id": 153,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/peru_wilson_mamanis_gesha_shopify.png?v=1779086237"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/141-peru-yulisa-carhuallocllo-arevalos-gesha-best-of-cajamarca-1st-place-crop-25-26-archive"
    },
    {
      "coffee_id": 220,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/peru_yulisa_carhuallocllo_shopify.png?v=1779037693"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "product_url",
      "from": null,
      "to": "https://september.coffee/products/javier-cantillo-vega-washed-colombia-geisha"
    },
    {
      "coffee_id": 194,
      "roaster": "September",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0564/8557/6802/files/BD81F7DE-71F1-4646-A7CB-18C7B880C2E3.jpg?v=1777058076"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/colombia-finca-el-turpial-washed-geisha-125g"
    },
    {
      "coffee_id": 171,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_1e51446cd76a4a9996d10b55203c6ab8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/kenya-thiririka-aa-lot-004-250g"
    },
    {
      "coffee_id": 222,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_1b4f9c71eb7d403e8cffb482f8b26563~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "product_url",
      "from": null,
      "to": "https://walnutscoffee.com/products/perla-del-otun"
    },
    {
      "coffee_id": 186,
      "roaster": "walnuts",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0598/4305/1669/files/perladelotun.jpg?v=1786467786"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/023-shibru-dube"
    },
    {
      "coffee_id": 101,
      "roaster": "Aviary",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/023_tile.png?v=1766343703"
    },
    {
      "coffee_id": 227,
      "roaster": "GWO",
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/collections/past-releases"
    },
    {
      "coffee_id": 227,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": "https://gwo.coffee/cdn/shop/files/30.png?v=1782768901&width=533"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "product_url",
      "from": null,
      "to": "https://hooraycoffee.ca/products/granja-paraiso-92-colombia-washed-pink-bourbon-filter-ex-light"
    },
    {
      "coffee_id": 208,
      "roaster": "Hooray!",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0609/2691/8765/files/P92_Pink_Bourbon.png?v=1765388272"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "product_url",
      "from": null,
      "to": "https://getprodigal.com/products/finca-el-tabor"
    },
    {
      "coffee_id": 85,
      "roaster": "Prodigal",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0648/2604/8751/files/WEBTaborSidra_171de857-f9ed-471c-a1d5-0c8e7da86193.jpg?v=1788964883"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-gesha-washed"
    },
    {
      "coffee_id": 217,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon-shopify.png?v=1771778784"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/colombia-marlon-bolanos-gesha-washed"
    },
    {
      "coffee_id": 218,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Marlon-shopify.png?v=1771778784"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/tanzania-iyenga-amcos-pb-washed"
    },
    {
      "coffee_id": 159,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Iyenga-shopify.png?v=1776613690"
    },
    {
      "coffee_id": 98,
      "roaster": "Substance",
      "field": "product_url",
      "from": null,
      "to": "https://www.nordicstylecoffeeguide.com/coffee/ethiopia-wachile-garse-substance-caf"
    },
    {
      "coffee_id": 98,
      "roaster": "Substance",
      "field": "image_url",
      "from": null,
      "to": "https://nmwejpkuqwrevxut.public.blob.vercel-storage.com/coffees/2025/12/09/admin/thumbs/IMG_6868_-scaled.jpeg"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "product_url",
      "from": null,
      "to": "https://www.nordicstylecoffeeguide.com/coffee/chelbesa-danche-subtext"
    },
    {
      "coffee_id": 83,
      "roaster": "Subtext",
      "field": "image_url",
      "from": null,
      "to": "https://nmwejpkuqwrevxut.public.blob.vercel-storage.com/coffees/2026/06/12/admin/thumbs/777541dc720f-ChelbesaDFilter_26.png"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "product_url",
      "from": null,
      "to": "https://sweetbloomcoffee.com/products/elver-rodriguez"
    },
    {
      "coffee_id": 87,
      "roaster": "Sweet Bloom",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0673/6999/2257/files/sweet-bloom-erodriguez-26.png?v=1768855364"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ecuador-finca-el-dorado-washed-gesha-lot-2-125g"
    },
    {
      "coffee_id": 21,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_6eaf7cbe015a482397964539618788f8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/colombia-finca-el-turpial-washed-geisha-125g"
    },
    {
      "coffee_id": 224,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_1e51446cd76a4a9996d10b55203c6ab8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "product_url",
      "from": null,
      "to": "https://walnutscoffee.com/products/kii-aa"
    },
    {
      "coffee_id": 181,
      "roaster": "walnuts",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0598/4305/1669/files/KiiAA.png?v=1790762783"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "product_url",
      "from": null,
      "to": "https://walnutscoffee.com/products/las-aguilas"
    },
    {
      "coffee_id": 185,
      "roaster": "walnuts",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0598/4305/1669/files/LasAguilas_77051974-310e-4ee9-89e9-c68dee46b713.png?v=1790762783"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/journal/nueva-alianza-yellow-gesha-4730"
    },
    {
      "coffee_id": 160,
      "roaster": "XLIII",
      "field": "image_url",
      "from": null,
      "to": "https://xliiicoffee.com/wp-content/uploads/2026/02/202602111018-nueva-alianza-yellow-gesha-4730-13.webp"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-ernedis-rodriguez"
    },
    {
      "coffee_id": 200,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/690-COL-Ernedis-WCFB-A.png?v=1780666447"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-diofanor-ruiz-java"
    },
    {
      "coffee_id": 149,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/660-Diofanor-Java-A.png?v=1775601056"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-diofanor-ruiz-papayo"
    },
    {
      "coffee_id": 150,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/661-Diofanor-Papayo-A.png?v=1775601577"
    },
    {
      "coffee_id": 166,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/2026-colombia-la-victoria"
    },
    {
      "coffee_id": 166,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/613-La-Victoria-A.png?v=1774577553"
    },
    {
      "coffee_id": 203,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/blogs/coffee-archive/mcl-june-2026"
    },
    {
      "coffee_id": 203,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/MCL-April-2025_d0c3a264-1192-4f32-bfa9-1f62bc936dc2.png?v=1779651851"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://sigmacoffee.co.uk/products/h-s-coffee-roasters-gitega-861-washed-ultralight-rwanda"
    },
    {
      "coffee_id": 113,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0529/9152/5021/files/619-RWA-Gitega-A-cropped.jpg?v=1780478491"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "product_url",
      "from": null,
      "to": "https://sigmacoffee.co.uk/products/h-s-coffee-roasters-teodomiro-jimenez-washed-ecuador"
    },
    {
      "coffee_id": 176,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0529/9152/5021/files/678-Teodomiro-Jimenez-A-cropped.jpg?v=1780478325"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/el-paraiso-decaf"
    },
    {
      "coffee_id": 146,
      "roaster": "Hydrangea",
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0693/6887/3282/products/RasberriesPeachKeyLime.jpg?v=1680149091"
    },
    {
      "coffee_id": 104,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/el-paraiso-decaf"
    },
    {
      "coffee_id": 105,
      "roaster": "Hydrangea",
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/el-paraiso-decaf"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "product_url",
      "from": null,
      "to": "https://scenery.coffee/blogs/coffee-archive/98-ecuador-mario-hervas-honey-crop-25-26-archive"
    },
    {
      "coffee_id": 103,
      "roaster": "Scenery",
      "field": "image_url",
      "from": null,
      "to": "https://scenery.coffee/cdn/shop/articles/ecuador_mario_hervas_honey_shopify.png?v=1764759356"
    },
    {
      "coffee_id": 97,
      "roaster": "Substance",
      "field": "product_url",
      "from": null,
      "to": "https://www.thewaytocoffee.com/beans/kenya-gicherori-1qa"
    },
    {
      "coffee_id": 97,
      "roaster": "Substance",
      "field": "image_url",
      "from": null,
      "to": "https://www.substancecafe.com/wp-content/uploads/2025/09/IMG_5320_-scaled.jpeg"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ecuador-finca-el-dorado-washed-gesha-lot-2-125g"
    },
    {
      "coffee_id": 31,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_6eaf7cbe015a482397964539618788f8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ecuador-finca-el-dorado-washed-gesha-lot-2-125g"
    },
    {
      "coffee_id": 170,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_6eaf7cbe015a482397964539618788f8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ecuador-finca-el-dorado-washed-gesha-lot-2-125g"
    },
    {
      "coffee_id": 223,
      "roaster": "The Picky Chemist",
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_6eaf7cbe015a482397964539618788f8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    }
  ],
  "websites": [
    {
      "roaster": "Botz",
      "url": "https://botz-coffee.com/products/gakuyuini"
    },
    {
      "roaster": "Botz",
      "url": "https://botz-coffee.com/products/juan-valenzuela"
    },
    {
      "roaster": "Botz",
      "url": "https://botz-coffee.com/products/kihuyo"
    },
    {
      "roaster": "Flower Child",
      "url": "https://flowerchildcoffee.com/products/robinson-luis"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-gesha-washed-el-hatillo"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-gesha-washed-el-salado"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-natural-pink-champagne-pink-bourbon"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-natural-tartaric-acid-pink-bourbon-cold-room"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-sidra-honey-la-cruz"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-washed-pink-champagne-pink-bourbon"
    },
    {
      "roaster": "Luminous",
      "url": "https://www.loveluminous.coffee/products/colombia-washed-tartaric-acid-orange-bourbon-cold-room"
    },
    {
      "roaster": "Prodigal",
      "url": "https://specialitycoffee.ca/products/prodigal-el-espejo-ii-gesha"
    },
    {
      "roaster": "Prodigal",
      "url": "https://www.kofio.co/coffee/colombia-las-perlitas-chiroso-prodigal-coffee/19683"
    },
    {
      "roaster": "Rogue Wave",
      "url": "https://beanbook.app/coffee/beans/rogue-wave--colombia-la-macarena-oscar-riascos-geisha-washed__bd89ffcb-aeea-4848-90f4-b37967012f7b"
    },
    {
      "roaster": "September",
      "url": "https://september.coffee/products/abel-salinas-ecuador-washed-mejorado-2026"
    },
    {
      "roaster": "September",
      "url": "https://september.coffee/en-us/collections/coffee/products/abel-salinas-ecuador-washed-mejorado-2026"
    },
    {
      "roaster": "walnuts",
      "url": "https://walnutscoffee.com/products/halo-golden-honey"
    },
    {
      "roaster": "Flower Child",
      "url": "https://flowerchildcoffee.com/products/gaharo"
    },
    {
      "roaster": "Flower Child",
      "url": "https://flowerchildcoffee.com/products/lisbeth-marino"
    },
    {
      "roaster": "Luna",
      "url": "https://enjoylunacoffee.com/products/karatu-aa-sl28-washed"
    },
    {
      "roaster": "September",
      "url": "https://september.coffee/products/javier-cantillo-vega-washed-colombia-geisha"
    },
    {
      "roaster": "walnuts",
      "url": "https://walnutscoffee.com/products/perla-del-otun"
    },
    {
      "roaster": "Hooray!",
      "url": "https://hooraycoffee.ca/products/granja-paraiso-92-colombia-washed-pink-bourbon-filter-ex-light"
    },
    {
      "roaster": "Prodigal",
      "url": "https://getprodigal.com/products/finca-el-tabor"
    },
    {
      "roaster": "Substance",
      "url": "https://www.nordicstylecoffeeguide.com/coffee/ethiopia-wachile-garse-substance-caf"
    },
    {
      "roaster": "Subtext",
      "url": "https://www.nordicstylecoffeeguide.com/coffee/chelbesa-danche-subtext"
    },
    {
      "roaster": "walnuts",
      "url": "https://walnutscoffee.com/products/kii-aa"
    },
    {
      "roaster": "walnuts",
      "url": "https://walnutscoffee.com/products/las-aguilas"
    },
    {
      "roaster": "Substance",
      "url": "https://www.thewaytocoffee.com/beans/kenya-gicherori-1qa"
    }
  ],
  "tavilyCalls": [
    "2026-10-08T01:57:45.723Z",
    "2026-10-08T01:57:48.739Z",
    "2026-10-08T01:57:52.054Z",
    "2026-10-08T01:57:56.660Z",
    "2026-10-08T01:57:58.598Z",
    "2026-10-08T01:58:02.483Z",
    "2026-10-08T01:58:04.656Z",
    "2026-10-08T01:58:07.613Z",
    "2026-10-08T01:58:12.989Z",
    "2026-10-08T01:58:15.779Z",
    "2026-10-08T01:58:17.828Z",
    "2026-10-08T01:58:21.397Z",
    "2026-10-08T01:58:23.767Z",
    "2026-10-08T01:58:27.168Z",
    "2026-10-08T01:58:28.856Z",
    "2026-10-08T01:58:30.838Z",
    "2026-10-08T01:58:33.201Z",
    "2026-10-08T01:58:35.482Z",
    "2026-10-08T01:58:36.357Z",
    "2026-10-08T01:58:39.369Z",
    "2026-10-08T01:58:42.911Z",
    "2026-10-08T01:58:47.542Z",
    "2026-10-08T01:58:49.644Z",
    "2026-10-08T01:58:51.629Z",
    "2026-10-08T01:58:53.532Z",
    "2026-10-08T01:58:55.118Z",
    "2026-10-08T01:58:56.841Z",
    "2026-10-08T01:58:58.622Z",
    "2026-10-08T01:59:00.502Z",
    "2026-10-08T01:59:03.640Z",
    "2026-10-08T01:59:06.351Z",
    "2026-10-08T01:59:10.092Z",
    "2026-10-08T01:59:20.176Z",
    "2026-10-08T01:59:23.555Z",
    "2026-10-08T01:59:26.778Z",
    "2026-10-08T01:59:33.046Z",
    "2026-10-08T01:59:39.582Z",
    "2026-10-08T01:59:44.663Z",
    "2026-10-08T01:59:48.036Z",
    "2026-10-08T01:59:54.159Z",
    "2026-10-08T01:59:57.852Z",
    "2026-10-08T02:00:01.872Z",
    "2026-10-08T02:00:05.543Z",
    "2026-10-08T02:00:09.960Z",
    "2026-10-08T02:00:12.842Z",
    "2026-10-08T02:00:15.204Z",
    "2026-10-08T02:00:17.074Z",
    "2026-10-08T02:00:25.930Z",
    "2026-10-08T02:00:32.395Z",
    "2026-10-08T02:00:38.506Z",
    "2026-10-08T02:00:52.922Z",
    "2026-10-08T02:00:55.407Z",
    "2026-10-08T02:01:01.467Z",
    "2026-10-08T02:01:03.718Z",
    "2026-10-08T02:01:06.819Z",
    "2026-10-08T02:01:09.719Z",
    "2026-10-08T02:01:12.311Z",
    "2026-10-08T02:01:14.754Z",
    "2026-10-08T02:01:16.520Z",
    "2026-10-08T02:01:19.588Z",
    "2026-10-08T02:01:21.256Z",
    "2026-10-08T02:01:23.464Z",
    "2026-10-08T02:01:25.837Z",
    "2026-10-08T02:01:28.699Z",
    "2026-10-08T02:01:31.223Z",
    "2026-10-08T02:01:35.546Z",
    "2026-10-08T02:01:37.122Z",
    "2026-10-08T02:01:41.303Z",
    "2026-10-08T02:01:43.130Z",
    "2026-10-08T02:01:45.615Z",
    "2026-10-08T02:01:48.759Z",
    "2026-10-08T02:01:51.152Z",
    "2026-10-08T02:01:55.591Z",
    "2026-10-08T02:01:57.797Z",
    "2026-10-08T02:02:01.473Z",
    "2026-10-08T02:02:04.614Z",
    "2026-10-08T02:02:10.524Z",
    "2026-10-08T02:02:14.918Z",
    "2026-10-08T02:02:18.984Z",
    "2026-10-08T02:02:21.305Z",
    "2026-10-08T02:02:24.305Z",
    "2026-10-08T02:02:26.510Z",
    "2026-10-08T02:02:30.048Z",
    "2026-10-08T02:02:33.993Z",
    "2026-10-08T02:02:36.318Z",
    "2026-10-08T02:02:39.017Z",
    "2026-10-08T02:02:42.081Z",
    "2026-10-08T02:02:45.044Z",
    "2026-10-08T02:02:48.541Z",
    "2026-10-08T02:02:53.440Z",
    "2026-10-08T02:02:56.406Z",
    "2026-10-08T02:03:00.555Z",
    "2026-10-08T02:03:04.714Z",
    "2026-10-08T02:03:07.597Z",
    "2026-10-08T02:03:10.004Z",
    "2026-10-08T02:03:14.141Z",
    "2026-10-08T02:03:18.310Z",
    "2026-10-08T02:03:20.916Z",
    "2026-10-08T02:03:24.397Z",
    "2026-10-08T02:03:26.695Z",
    "2026-10-08T02:03:27.255Z",
    "2026-10-08T02:03:29.913Z",
    "2026-10-08T02:03:33.240Z",
    "2026-10-08T02:03:35.021Z",
    "2026-10-08T02:03:36.951Z",
    "2026-10-08T02:03:38.787Z",
    "2026-10-08T02:03:41.090Z",
    "2026-10-08T02:03:43.452Z",
    "2026-10-08T02:03:47.717Z",
    "2026-10-08T02:03:50.527Z",
    "2026-10-08T02:03:52.816Z",
    "2026-10-08T02:03:53.504Z",
    "2026-10-08T02:03:55.549Z",
    "2026-10-08T02:03:58.040Z",
    "2026-10-08T02:03:59.965Z",
    "2026-10-08T02:04:00.544Z",
    "2026-10-08T02:04:03.968Z",
    "2026-10-08T02:04:04.985Z",
    "2026-10-08T02:04:07.660Z",
    "2026-10-08T02:04:10.703Z",
    "2026-10-08T02:04:13.275Z",
    "2026-10-08T02:04:15.753Z",
    "2026-10-08T02:04:21.324Z",
    "2026-10-08T02:04:26.923Z",
    "2026-10-08T02:04:30.989Z",
    "2026-10-08T02:04:32.736Z",
    "2026-10-08T02:04:38.568Z",
    "2026-10-08T02:04:42.086Z",
    "2026-10-08T02:04:46.101Z",
    "2026-10-08T02:04:48.700Z",
    "2026-10-08T02:04:50.161Z",
    "2026-10-08T02:04:52.129Z",
    "2026-10-08T02:04:54.634Z",
    "2026-10-08T02:04:58.465Z",
    "2026-10-08T02:04:59.939Z",
    "2026-10-08T02:05:01.991Z",
    "2026-10-08T02:05:04.267Z",
    "2026-10-08T02:05:06.230Z",
    "2026-10-08T02:05:12.725Z",
    "2026-10-08T02:05:20.797Z",
    "2026-10-08T02:05:30.172Z",
    "2026-10-08T02:05:46.297Z"
  ]
},
{
  "marker": "product_page_backfill_2026_10_archive_b",
  "fixes": [
    {
      "coffee_id": 5,
      "roaster": "H&S",
      "field": "image_url",
      "from": "https://hscoffeeroasters.com/cdn/shop/files/2022-hs-logo-200x200-darkbg_320x.png?v=1656512539",
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/695-Col-Efren-Rodriguez-A.png?v=1783263741"
    },
    {
      "coffee_id": 86,
      "roaster": "DAK",
      "field": "image_url",
      "from": null,
      "to": "https://st.kofio.co/img_product/boeV9yxzHn2OwWv/13161/t5XK2C9cv67n13rlzYF4_102573.png"
    },
    {
      "coffee_id": 90,
      "roaster": "Flower Child",
      "field": "image_url",
      "from": null,
      "to": "https://flowerchildcoffee.com/cdn/shop/files/Ernedis_December_Harvest_2025.jpg?v=1767737986&width=2200"
    },
    {
      "coffee_id": 106,
      "roaster": "Frequent",
      "field": "image_url",
      "from": null,
      "to": "https://frequentcoffee.com/cdn/shop/files/pink-bourbon-decaf-coffee.jpg?v=1773632034&width=1346"
    },
    {
      "coffee_id": 107,
      "roaster": "Frequent",
      "field": "image_url",
      "from": null,
      "to": "https://frequentcoffee.com/cdn/shop/files/pink-bourbon-decaf-coffee.jpg?v=1773632034&width=1346"
    },
    {
      "coffee_id": 111,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://i.redd.it/rogdrtj3sksg1.jpg"
    },
    {
      "coffee_id": 112,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://beanbodega.coffee/cdn/shop/files/664-PER-Roger-x-Eli-A.png?v=1775569293&width=3840"
    },
    {
      "coffee_id": 114,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://gtlipifdfyugiwpxvuse.supabase.co/storage/v1/object/public/assets/products/c43fd815-d1e7-43f2-9f61-054e3172c2c8/744eb87b200677498e082f63db342d0e.png"
    },
    {
      "coffee_id": 122,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://sigmacoffee.co.uk/cdn/shop/files/672-PER-Yulisa-A-cropped_grande.jpg?v=1780478889"
    },
    {
      "coffee_id": 138,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://beanbodega.coffee/cdn/shop/files/1_31-1_215d48da-d1ea-43c3-80e8-25b345e08a60.png"
    },
    {
      "coffee_id": 140,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://kultivarcoffee.com/cdn/shop/files/Peru_Finca_Miraflores_Cold_Water_Fermentation_Washed_Geisha_140_-_1.webp?v=1779961775&width=1500"
    },
    {
      "coffee_id": 144,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://i.ytimg.com/vi/BlPbF18yd6Y/maxresdefault.jpg"
    },
    {
      "coffee_id": 145,
      "roaster": "Ceto",
      "field": "image_url",
      "from": null,
      "to": "https://i.ytimg.com/vi/BlPbF18yd6Y/maxresdefault.jpg"
    },
    {
      "coffee_id": 151,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://i.ytimg.com/vi/1SZZ_AxM5nc/sddefault.jpg"
    },
    {
      "coffee_id": 152,
      "roaster": "Shoebox",
      "field": "image_url",
      "from": null,
      "to": "https://i.ytimg.com/vi/1SZZ_AxM5nc/sddefault.jpg"
    },
    {
      "coffee_id": 165,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://beanbodega.coffee/cdn/shop/files/664-PER-Roger-x-Eli-A.png?v=1775569293&width=3840"
    },
    {
      "coffee_id": 173,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": ""
    },
    {
      "coffee_id": 174,
      "roaster": "GWO",
      "field": "image_url",
      "from": null,
      "to": ""
    },
    {
      "coffee_id": 175,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://gtlipifdfyugiwpxvuse.supabase.co/storage/v1/object/public/assets/products/ed49fb81-816a-41ed-8fd6-027bf381e537/22e61180b546ab2f82cb658cc31ee3ec.png"
    },
    {
      "coffee_id": 187,
      "roaster": "Still",
      "field": "image_url",
      "from": null,
      "to": ""
    },
    {
      "coffee_id": 198,
      "roaster": "Big Sur",
      "field": "image_url",
      "from": null,
      "to": "https://beanbodega.coffee/cdn/shop/files/1_31-1_215d48da-d1ea-43c3-80e8-25b345e08a60.png"
    },
    {
      "coffee_id": 211,
      "roaster": "H&S",
      "field": "image_url",
      "from": "https://hscoffeeroasters.com/cdn/shop/files/2022-hs-logo-200x200-darkbg_320x.png?v=1656512539",
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/695-Col-Efren-Rodriguez-A.png?v=1783263741"
    },
    {
      "coffee_id": 219,
      "roaster": "H&S",
      "field": "image_url",
      "from": null,
      "to": "https://sigmacoffee.co.uk/cdn/shop/files/672-PER-Yulisa-A-cropped_grande.jpg?v=1780478889"
    }
  ],
  "websites": [],
  "tavilyCalls": []
},
];
