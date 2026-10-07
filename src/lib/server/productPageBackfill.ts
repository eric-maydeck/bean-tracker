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
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/028-jhon-didier-trujillo"
    },
    {
      "coffee_id": 60,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/028_tile.png?v=1778533034"
    },
    {
      "coffee_id": 61,
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/029-alina-milagros"
    },
    {
      "coffee_id": 61,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/029_tile.png?v=1784044081"
    },
    {
      "coffee_id": 65,
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/xx6-san-jeronimo-miramar"
    },
    {
      "coffee_id": 65,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0849/8305/4640/files/xx6_tile.png?v=1785887761"
    },
    {
      "coffee_id": 58,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gute-village"
    },
    {
      "coffee_id": 58,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/AloRedHoneyTransparent_1.png?v=1786429677"
    },
    {
      "coffee_id": 66,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/fugi-ikizere"
    },
    {
      "coffee_id": 66,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Fugitransparent.png?v=1788564747"
    },
    {
      "coffee_id": 59,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gaia-estate-airworks-exclusive"
    },
    {
      "coffee_id": 59,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/GaiaGeshaTransparent_1.png?v=1786430106"
    },
    {
      "coffee_id": 74,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/gesha-village-oma-natural-26-147"
    },
    {
      "coffee_id": 74,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/omaTransparent.png?v=1788569761"
    },
    {
      "coffee_id": 75,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/heza"
    },
    {
      "coffee_id": 75,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Hezahoneytransparent.png?v=1788567750"
    },
    {
      "coffee_id": 76,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/yulissa-chambi"
    },
    {
      "coffee_id": 76,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/Yulissatransparent.png?v=1788565587"
    },
    {
      "coffee_id": 77,
      "field": "product_url",
      "from": null,
      "to": "https://beansbeans.coffee/products/yunguilla-juan-pena"
    },
    {
      "coffee_id": 77,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0813/5655/4484/files/YunguillaMejotransparent.png?v=1788565937"
    },
    {
      "coffee_id": 36,
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/habtamu-fikadu-washed"
    },
    {
      "coffee_id": 36,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/Chelbesa.png?v=1785278628"
    },
    {
      "coffee_id": 37,
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/habtamu-fikadu-washed"
    },
    {
      "coffee_id": 37,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0929/6694/5082/files/Chelbesa.png?v=1785278628"
    },
    {
      "coffee_id": 1,
      "field": "product_url",
      "from": null,
      "to": "https://ceto.coffee/products/marlon-bolanos-washed-pb-decaf"
    },
    {
      "coffee_id": 20,
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-la-fortuna-bourbon-aji"
    },
    {
      "coffee_id": 20,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0424/7433/files/666-COL-La-Fortuna-WBA-A.png?v=1785694019"
    },
    {
      "coffee_id": 72,
      "field": "product_url",
      "from": null,
      "to": "https://www.intelligentsia.com/products/ethiopia-gesha-village-oma-natural"
    },
    {
      "coffee_id": 72,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0084/8802/6172/files/EthiopiaGeshaVillageOmaNatural_1.png?v=1789142053"
    },
    {
      "coffee_id": 62,
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-alejandrina-maytan-kukipata-peru"
    },
    {
      "coffee_id": 62,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026AlejandrinaMaytan_Kukipata-Peru.png?v=1788402464"
    },
    {
      "coffee_id": 78,
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-demeka-becha-ethiopia"
    },
    {
      "coffee_id": 78,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026DemekaBecha-Ethiopia.png?v=1787786573"
    },
    {
      "coffee_id": 69,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-ashenafi-getaneh-black-honey"
    },
    {
      "coffee_id": 69,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Ashenafi-shopify.png?v=1789315852"
    },
    {
      "coffee_id": 51,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-bookissa-natural"
    },
    {
      "coffee_id": 51,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Bookissa-shopify.png?v=1786216160"
    },
    {
      "coffee_id": 52,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-getachew-zeleke-washed2026"
    },
    {
      "coffee_id": 52,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Getachew_2026_-shopify.png?v=1786215988"
    },
    {
      "coffee_id": 53,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-getachew-zeleke-washed2026"
    },
    {
      "coffee_id": 53,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Getachew_2026_-shopify.png?v=1786215988"
    },
    {
      "coffee_id": 54,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-habtamu-fikadu-aga-washed"
    },
    {
      "coffee_id": 54,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Habtamu-shopify.png?v=1786215679"
    },
    {
      "coffee_id": 70,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/kenya-kamwangi-aa-washed"
    },
    {
      "coffee_id": 70,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/KamwangiAA-shopify.png?v=1788107841"
    },
    {
      "coffee_id": 48,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-mr-tadese-teko-washed2026"
    },
    {
      "coffee_id": 48,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Mr.Tadese_2026_-shopify.png?v=1785684555"
    },
    {
      "coffee_id": 71,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/ethiopia-mulish-washed"
    },
    {
      "coffee_id": 71,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/Mulish-shopify.png?v=1789919305"
    },
    {
      "coffee_id": 26,
      "field": "product_url",
      "from": null,
      "to": "https://shoebox.coffee/products/panama-eyla-gesha-honey"
    },
    {
      "coffee_id": 26,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0917/5220/2532/files/EylaHoney-shopify_74c00abf-b9ca-4782-b926-cc152829d30f.png?v=1782056636"
    },
    {
      "coffee_id": 232,
      "field": "product_url",
      "from": null,
      "to": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "coffee_id": 232,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0933/3142/3573/files/samii.jpg?v=1785098241"
    },
    {
      "coffee_id": 43,
      "field": "product_url",
      "from": null,
      "to": "https://sweetbloomcoffee.com/products/danche"
    },
    {
      "coffee_id": 43,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0673/6999/2257/files/sweet-bloom-danche-26.png?v=1785878553"
    },
    {
      "coffee_id": 44,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/kenya-inoi-kianderi-aa-043-250g"
    },
    {
      "coffee_id": 44,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_da0d4805ca10426b8563ef4689b24bd8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 46,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/kenya-ruera-estate-pb-031-250g"
    },
    {
      "coffee_id": 46,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_4351ed6d97524c8ca05123c9cbf26074~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 68,
      "field": "product_url",
      "from": null,
      "to": "https://aviary.coffee/products/030-san-jeronimo-miramar"
    },
    {
      "coffee_id": 68,
      "field": "image_url",
      "from": null,
      "to": "https://aviary.coffee/cdn/shop/files/030tile.png?v=1785887650"
    },
    {
      "coffee_id": 49,
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/ecuador-abel-salinas"
    },
    {
      "coffee_id": 49,
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/677-ECU-Abel-A_731bef6c-c1eb-4460-90f8-0648259c0467.png?v=1779717451"
    },
    {
      "coffee_id": 18,
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-la-fortuna-pink-bourbon"
    },
    {
      "coffee_id": 18,
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/665-COL-La-Fortuna-WPB-A.png?v=1785693362"
    },
    {
      "coffee_id": 64,
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/burundi-mikuba-8"
    },
    {
      "coffee_id": 64,
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/718-BUR-Mikuba-A.png?v=1788706055"
    },
    {
      "coffee_id": 67,
      "field": "product_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/products/colombia-yessica-parra"
    },
    {
      "coffee_id": 67,
      "field": "image_url",
      "from": null,
      "to": "https://hscoffeeroasters.com/cdn/shop/files/656-COL-Yessica-A.png?v=1788705248"
    },
    {
      "coffee_id": 22,
      "field": "product_url",
      "from": null,
      "to": "https://lumeroasters.coffee/products/luz-helena-salazar-100g"
    },
    {
      "coffee_id": 22,
      "field": "image_url",
      "from": null,
      "to": "https://lumeroasters.coffee/cdn/shop/files/baglabel_productpage_3.png?v=1783620614"
    },
    {
      "coffee_id": 79,
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-sike-bokasso-ethiopia"
    },
    {
      "coffee_id": 79,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026SikeBokasso-Ethiopia.png?v=1787784425"
    },
    {
      "coffee_id": 40,
      "field": "product_url",
      "from": null,
      "to": "https://stillcoffeeroasters.com/products/samii-chelbesa"
    },
    {
      "coffee_id": 40,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0933/3142/3573/files/samii.jpg?v=1785098241"
    },
    {
      "coffee_id": 30,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/colombia-finca-el-turpial-washed-geisha-125g"
    },
    {
      "coffee_id": 30,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_1e51446cd76a4a9996d10b55203c6ab8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 29,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-048-oma"
    },
    {
      "coffee_id": 29,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_eeaa68192b4b41e2abcd2629261200e8~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 47,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/copie-de-panama-hacienda-la-esmeralda-lino-5-wb-washed-geisha"
    },
    {
      "coffee_id": 47,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_69f35f8b9e9445158c0c99d91f687fbb~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 19,
      "field": "product_url",
      "from": null,
      "to": "https://bigsurcafe.com/products/25-26-new-season-ethiopia-washed-faysel-abdosh-single-farm-premium-150g"
    },
    {
      "coffee_id": 19,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0680/8079/5738/files/1_36-1.png?v=1774340528"
    },
    {
      "coffee_id": 34,
      "field": "product_url",
      "from": null,
      "to": "https://normlppl.coffee/products/gilber-huayallas-sl9-50g-1-76oz-roasted-09-30-2026"
    },
    {
      "coffee_id": 34,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0741/5880/1034/files/sl09shopify_a8214381-1472-4b65-9a37-f7447ab5e806.png?v=1790805405"
    },
    {
      "coffee_id": 2,
      "field": "product_url",
      "from": null,
      "to": "https://beanhoard.com/roaster/scenery-coffee/ethiopia-kebena-natural-decaf"
    },
    {
      "coffee_id": 2,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0779/1961/7334/files/ethiopia_kebena_decaf_shopify.png?v=1777983100"
    },
    {
      "coffee_id": 63,
      "field": "product_url",
      "from": null,
      "to": "https://www.seycoffee.com/products/2026-mate-matiwos-keramo-ethiopia"
    },
    {
      "coffee_id": 63,
      "field": "image_url",
      "from": null,
      "to": "https://cdn.shopify.com/s/files/1/0002/6352/0281/files/2026MateMatiwos_Keramo-Ethiopia.png?v=1788392669"
    },
    {
      "coffee_id": 27,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-046"
    },
    {
      "coffee_id": 27,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_7f90e237d9f841b482a3975b5c9a36b5~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 28,
      "field": "product_url",
      "from": null,
      "to": "https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-25-047"
    },
    {
      "coffee_id": 28,
      "field": "image_url",
      "from": null,
      "to": "https://static.wixstatic.com/media/d61d15_73e0177125cb4f8dba45cd4cc5ef703a~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg"
    },
    {
      "coffee_id": 56,
      "field": "product_url",
      "from": null,
      "to": "https://x.com/xliiicoffee/status/2058805264200188159?lang=bg"
    },
    {
      "coffee_id": 56,
      "field": "image_url",
      "from": null,
      "to": "https://pbs.twimg.com/media/HJIR24MbkAAN0w7?format=webp&name=large"
    },
    {
      "coffee_id": 15,
      "field": "product_url",
      "from": null,
      "to": "https://gwo.coffee/products/gikirima"
    },
    {
      "coffee_id": 15,
      "field": "image_url",
      "from": null,
      "to": "https://gwo.coffee/cdn/shop/files/24.png?v=1780224281"
    },
    {
      "coffee_id": 4,
      "field": "product_url",
      "from": null,
      "to": "https://hydrangea.coffee/products/el-paraiso-decaf"
    },
    {
      "coffee_id": 57,
      "field": "product_url",
      "from": null,
      "to": "https://xliiicoffee.com/en/product/nueva-alianza-sidra-4736/"
    },
    {
      "coffee_id": 57,
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
];
