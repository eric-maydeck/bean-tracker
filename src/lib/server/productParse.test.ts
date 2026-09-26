import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeEntities, htmlToText, parseShopifyProduct, parseHtmlProduct } from './productParse';

// Captured 2026-09-25 by Task 3 Step 1 of docs/superpowers/plans/2026-09-25-product-page-fill.md.
// All eight listed URLs returned 200; no substitutions were needed.
// picky-chemist.html was captured at ~1.08 MB (over the 1 MB cap), so it was
// trimmed to just its <head>...</head> (the single application/ld+json block
// lives inside <head>, so nothing needed was lost).
// hs.meta.json (https://hscoffeeroasters.com/meta.json) was captured in
// addition to Step 1's list: the "hs" fixture test below needs it for
// currency, the same way shoebox's test uses shoebox.meta.json, but Step 1
// only listed shoebox.meta.json.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/product-pages/${name}`, import.meta.url), 'utf8');
const shopify = (name: string, meta: string | null = null) =>
  parseShopifyProduct(JSON.parse(fixture(`${name}.json`)), meta ? JSON.parse(fixture(meta)) : null);

describe('decodeEntities / htmlToText', () => {
  it('decodes named, decimal and hex entities exactly once', () => {
    expect(decodeEntities('Tom &amp; Jerry&#39;s &#x2014; &lt;b&gt; &amp;lt;')).toBe("Tom & Jerry's — <b> &lt;");
  });

  it('turns block tags into lines, drops tags/scripts, and never re-parses decoded text as tags', () => {
    const html = '<div>Region: Shakiso, Ethiopia</div><div><br></div><p>Process: <b>Natural</b></p><script>var x=1</script><p>5 &lt;b&gt; 3 &amp; up</p>';
    expect(htmlToText(html)).toBe('Region: Shakiso, Ethiopia\nProcess: Natural\n5 <b> 3 & up');
  });
});

describe('parseHtmlProduct', () => {
  it('returns null for a non-product page (home/collection) even though it has OG tags', () => {
    const html = `<html><head>
      <meta property="og:type" content="website"><meta property="og:title" content="Shop all coffee">
      <meta property="og:site_name" content="Some Roaster"><meta property="og:image" content="https://x/logo.png">
      </head><body><ul><li><span>Cart</span><span>0</span></li></ul></body></html>`;
    expect(parseHtmlProduct(html)).toBeNull();
  });

  it('reads JSON-LD Product (incl. @graph), OG fallbacks, label/value rows and decodes entities', () => {
    const html = `<head>
      <meta property="og:type" content="product"><meta property="og:site_name" content="Tom &amp; Co">
      <meta property="og:image" content="https://x/og.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},
        {"@type":"Product","name":"Kenya &amp; Friends","brand":{"@type":"Brand","name":"Farm X"},
         "image":["https://x/ld.jpg"],"description":"Country: Kenya\\nProcess: Washed",
         "offers":{"@type":"Offer","price":"12.50","priceCurrency":"eur"}}]}</script></head>
      <body><table><tr class="woocommerce-product-attributes-item"><th class="l"><span>Net Weight</span></th><td><p>250 gram</p></td></tr></table>
      <ul><li><span>Origin</span><span>Northern Province</span></li></ul></body>`;
    const p = parseHtmlProduct(html)!;
    expect(p.title).toBe('Kenya & Friends');
    expect(p.siteName).toBe('Tom & Co');
    expect(p.brand).toBe('Farm X');
    expect(p.image).toBe('https://x/ld.jpg');
    expect(p.currency).toBe('EUR');
    expect(p.variants).toEqual([{ id: null, label: '', price: 12.5, grams: null }]);
    expect(p.attributes.country).toBe('Kenya');
    expect(p.attributes.process).toBe('Washed');
    expect(p.attributes['net weight']).toBe('250 gram');
    expect(p.attributes.origin).toBe('Northern Province');
  });
});

describe('parseShopifyProduct variant filtering', () => {
  it('drops variants whose price is not greater than 0', () => {
    const json = {
      product: {
        title: 'Test Coffee',
        variants: [
          { id: 1, title: 'A', price: '12.00' },
          { id: 2, title: 'B', price: '0.00' },
          { id: 3, title: 'C', price: '' }
        ]
      }
    };
    const p = parseShopifyProduct(json, null);
    expect(p.variants).toEqual([{ id: 1, label: 'A', price: 12, grams: null }]);
  });

  it("carries Shopify's own numeric grams per variant, ignoring a zero/missing value", () => {
    const json = {
      product: {
        title: 'Test Coffee',
        variants: [
          { id: 1, title: 'TAKEOUT BOX', price: '12.00', grams: 200 },
          { id: 2, title: 'JUST A BAG', price: '12.00', grams: 0 },
          { id: 3, title: 'No grams field', price: '12.00' }
        ]
      }
    };
    const p = parseShopifyProduct(json, null);
    expect(p.variants.map((v) => v.grams)).toEqual([200, null, null]);
  });
});

describe('fixtures', () => {
  it('shoebox (Shopify, labeled lines in body_html, USD via meta.json)', () => {
    const p = shopify('shoebox', 'shoebox.meta.json');
    expect(p.title).toBe('Ethiopia Shoondhisa Natural'); // from fixture
    expect(p.currency).toBe('USD'); // from fixture (meta.json)
    expect(p.attributes.process).toBe('Natural'); // from fixture
    expect(p.attributes.region).toContain('Ethiopia'); // from fixture: "Shakiso, Ethiopia"
    expect(p.description).not.toMatch(/<[a-z/]/i);
    expect(p.variants.length).toBeGreaterThan(0);
    expect(p.variants.every((v) => v.price > 0)).toBe(true);
    expect(p.image).toMatch(/^https:\/\/cdn\.shopify\.com\//);
  });

  it('hs (Shopify, size variants + origin/process tags)', () => {
    const p = shopify('hs', 'hs.meta.json');
    expect(p.vendor).toBe('H+S Coffee Roasters'); // from fixture
    expect(p.tags).toEqual(expect.arrayContaining(['Burundi', 'washed'])); // from fixture
    expect(p.variants.map((v) => v.label)).toEqual(['125g (4.4oz)', '250g (8.8oz)', '1kg (2.2lb)']); // from fixture
    expect(p.variants.map((v) => v.price)).toEqual([21, 36, 114]); // from fixture
    expect(p.variants.every((v) => typeof v.id === 'number')).toBe(true);
    expect(p.currency).toBe('USD');
  });

  it('bigsur (Shopify, size in title, Country:/Process: lines)', () => {
    const p = shopify('bigsur');
    expect(p.title).toMatch(/60g/); // size baked into title
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0].label).toBe(''); // Shopify "Default Title" -> ''
    expect(p.attributes.country).toBe('Panama'); // from fixture — confirmed
    expect(p.attributes.process).toMatch(/natural/i); // from fixture — confirmed
  });

  it('aviary (Shopify, origin/process in tags)', () => {
    const p = shopify('aviary');
    expect(p.title).toBeTruthy(); // non-empty
    // from fixture: aviary.json's tags include the origin country and process
    expect(p.tags.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining(['guatemala', 'washed']));
  });

  it('normlppl (Shopify, size + roast date in title)', () => {
    const p = shopify('normlppl');
    expect(p.title).toMatch(/200g/i); // from fixture — confirmed
    expect(p.title).toMatch(/roasted/i); // from fixture — confirmed
  });

  it('xliii (WooCommerce, li/span attribute rows, VND)', () => {
    const p = parseHtmlProduct(fixture('xliii.html'))!;
    expect(p).not.toBeNull();
    expect(p.title).toMatch(/Kinini Village/); // from fixture
    expect(p.siteName).toBe('XLIII Coffee'); // from fixture
    expect(p.currency).toBe('VND'); // from fixture
    expect(p.variants[0].price).toBe(800000); // from fixture
    expect(p.attributes.process).toBe('Washed'); // from fixture
    expect(p.attributes['net weight']).toBe('250 gram'); // from fixture
    expect(p.attributes.origin).toBe('Northern Province'); // from fixture — a region, not a country
    expect(p.image).toMatch(/^https:\/\/xliiicoffee\.com\/.+\.(webp|jpe?g|png)/);
  });

  it('picky-chemist (Wix, JSON-LD Product, EUR, brand = farm)', () => {
    const p = parseHtmlProduct(fixture('picky-chemist.html'))!;
    expect(p).not.toBeNull();
    expect(p.title).toMatch(/Gesha Village/i); // from fixture — confirmed
    expect(p.currency).toBe('EUR'); // from fixture — confirmed
    expect(p.brand).toBeTruthy(); // non-empty (the farm)
    expect(p.siteName).toBe('The Picky Chemist'); // from fixture — confirmed (og:site_name)
    expect(p.siteName).not.toBe(p.brand); // brand is the farm, not the roaster
    expect(p.image).toMatch(/^https:\/\//);
    expect(p.variants[0].price).toBeGreaterThan(0);
  });
});
