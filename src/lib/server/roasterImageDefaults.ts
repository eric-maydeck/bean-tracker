import type { RoasterImageDefault } from './roasterImages';

// Agreed with the user in the 2026-10 roaster image review (a prod copy + dev
// server). Applied once at boot by applyRoasterImageDefaults. Names are as
// stored in coffees.roaster ('Still' after the migration's still → Still fix).
export const ROASTER_IMAGE_DEFAULTS_MARKER = 'roaster_image_defaults_2026_10_applied';
export const ROASTER_IMAGE_DEFAULTS: readonly RoasterImageDefault[] = [
  { roaster: 'Anamorphic', image_url: 'https://anamorphiccoffee.com/cdn/shop/files/main_trademark.png?v=1776832044' },
  { roaster: 'Aviary', image_url: 'https://aviary.coffee/cdn/shop/files/AVIARY_Logo_RGB.png?v=1704237376' },
  { roaster: "Bean's Beans", image_url: 'https://beansbeans.coffee/cdn/shop/files/Bean_s_Beans_Icon_4ce3fbf5-b242-40bb-a299-7821a67d60d5.svg?v=1774326034' },
  { roaster: 'Big Sur', image_url: 'https://bigsurcafe.com/cdn/shop/files/BigSur_LOGO-CMYK_1_-01_699e14f2-bbd7-49c2-b882-815f5e829359.png?v=1772592615' },
  { roaster: 'Botz', image_url: 'https://botz-coffee.com/cdn/shop/files/BOTZ_COFFEE_1.png?v=1614745404' },
  { roaster: 'Brainwave Roasters', image_url: 'https://brainwaveroasters.com/cdn/shop/files/logo_921ff433-9171-47b0-90d6-4077a50c503a.png?v=1718204908' },
  { roaster: 'Ceto', image_url: 'https://ceto.coffee/cdn/shop/files/cet_round_logo_light.png?v=1741975892' },
  { roaster: 'DAK', image_url: 'https://d1j9xh2330ho4m.cloudfront.net/uploads/2026/01/dak_logo_white.svg' },
  { roaster: 'Eymen', image_url: 'https://assets.streamlinehq.com/image/private/w_512,h_512,ar_1/f_auto/v1/icons/3/regional-indicator-e-ik5w2sydtal91bj00troi.png/regional-indicator-e-lnkoe9wg0jl9yb2ronrmr.png?_a=DATAiZAAZAA0' },
  { roaster: 'Flower Child', image_url: 'https://flowerchildcoffee.com/cdn/shop/files/IMG-5161_28d78ab8-6b45-466a-968b-c384c1d0fa4f.jpg?v=1686961489' },
  { roaster: 'Frequent', image_url: 'https://frequentcoffee.com/cdn/shop/files/Frequent_logo.png?v=1744740428' },
  { roaster: 'GWO', image_url: 'https://gwo.coffee/cdn/shop/files/GWO_v1.2.png?v=1776185349' },
  { roaster: 'H&S', image_url: 'https://hscoffeeroasters.com/cdn/shop/files/2022-hs-logo-200x200.png?v=1655834934' },
  { roaster: 'Hooray!', image_url: 'https://hooraycoffee.ca/cdn/shop/files/Hooray_Cafe_Coffee_Lab.png?v=1736131197' },
  { roaster: 'Hydrangea', image_url: 'https://hydrangea.coffee/cdn/shop/files/IMG_0589.jpg?v=1671480742' },
  { roaster: 'Intelligentsia', image_url: 'https://www.intelligentsia.com/cdn/shop/t/435/assets/logo-og.png?v=110203643234035765081786653975' },
  { roaster: 'Lume', image_url: 'https://lumeroasters.coffee/cdn/shop/files/Lume_Coffee_Roasters_-_Text_Logo_1.png?v=1763007952' },
  { roaster: 'Luminous', image_url: 'https://www.loveluminous.coffee/cdn/shop/files/logo-2023_7a069aed-c894-49ec-a674-fcd62d7c9866.png?v=1718409837&width=400' },
  { roaster: 'Luna', image_url: 'https://enjoylunacoffee.com/cdn/shop/files/logo-editorial-final.png?v=1782238359' },
  { roaster: 'norml coffee ppl', image_url: 'https://normlppl.coffee/cdn/shop/files/Untitled_Artwork_3.png?v=1789689058' },
  { roaster: 'O.W.L', image_url: 'https://www.owlcoffeeroasters.com/cdn/shop/files/Black_OWL_logo_with_text.png?v=1771502766' },
  { roaster: 'Ordinary', image_url: 'https://shop.ordinarycoffeeroasters.com/cdn/shop/files/LOGO.SCHILD2_Kopie_2_ccdbcfea-559c-486b-804d-8cbcab040e25.png?v=1755775824' },
  { roaster: 'Prodigal', image_url: 'https://getprodigal.com/cdn/shop/files/Prodigal_Logo_a27f723a-6031-4673-b7a6-b72e4a01685d.png?v=1672283331' },
  { roaster: 'Rogue Wave', image_url: 'https://roguewavecoffee.ca/cdn/shop/files/rw-logo-horizontal-black-RGB_1caf9b21-e328-4ecd-9397-a4249f440449.png?v=1614290599' },
  { roaster: 'Scenery', image_url: 'https://scenery.coffee/cdn/shop/files/Scenery_S_logo.png?v=1688403177' },
  { roaster: 'September', image_url: 'https://september.coffee/cdn/shop/files/september_81f3c803-0437-4b08-838d-25463333880f.png?v=1767798202' },
  { roaster: 'Sey', image_url: 'https://www.seycoffee.com/cdn/shop/t/38/assets/logo.svg' },
  { roaster: 'Shoebox', image_url: 'https://shoebox.coffee/cdn/shop/files/Main.png?v=1737911185' },
  { roaster: 'Still', image_url: 'https://stillcoffeeroasters.com/cdn/shop/files/Asset_1_4x_a1545701-cfe9-46fd-bcc9-0341373c5c69.png?v=1752881445' },
  { roaster: 'Substance', image_url: 'https://www.substancecafe.com/wp-content/uploads/2026/03/cropped-substance-logo-inverse-transp-scaled-1.png' },
  { roaster: 'Subtext', image_url: 'https://www.subtext.coffee/cdn/shop/files/LOGO-05.png?v=1711047106' },
  { roaster: 'Sweet Bloom', image_url: 'https://sweetbloomcoffee.com/cdn/shop/files/logodesktop.png?v=1758095539' },
  { roaster: 'Thankfully', image_url: 'https://thankfullycoffee.com/og-brand.png' },
  { roaster: 'The Picky Chemist', image_url: 'https://static.wixstatic.com/media/d61d15_140b4d66fb434d8191cbe8ae47441e72~mv2.jpg' },
  { roaster: 'walnuts', image_url: 'https://walnutscoffee.com/cdn/shop/files/walnuts_logo_for_web.png?v=1750727932' },
  { roaster: 'XLIII', image_url: 'https://xliiicoffee.com/wp-content/uploads/2023/05/202305261059-logo.png' },
  { roaster: 'Yelei Lab', image_url: 'https://assets.super.so/96640f2c-1f98-4b3a-8885-aded48c86a26/uploads/logo/a155f64b-0134-4476-aa41-cf50b60a1dcd.png' }
];

// Logos the user found 2026-10-06 for the two roasters the first review left
// blank. Signed Instagram links that expire 2026-10-10; the local-copy
// background run stores our copy at the first boot after deploy.
export const ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER = 'roaster_image_defaults_2026_10b_applied';
export const ROASTER_IMAGE_DEFAULTS_2026_10B: readonly RoasterImageDefault[] = [
  { roaster: 'Macs Roasters', image_url: '' },
  { roaster: 'Dongze', image_url: '' }
];
