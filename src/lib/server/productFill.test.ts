import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ProductData } from './productParse';
import { parseShopifyProduct, parseHtmlProduct } from './productParse';
import type { FillHistoryRow } from './coffees';
import { parseGrams, cleanName, stripSiteSuffix, findOrigin, findProcessing, findRoaster, findRoastLevel, pickVariant, toUsd, formatMoney, buildFill, type UsdRates, type FillContext } from './productFill';

export function product(overrides: Partial<ProductData> = {}): ProductData {
  return {
    title: null, vendor: null, siteName: null, brand: null, tags: [], description: '',
    attributes: {}, image: null, currency: 'USD', variants: [], ...overrides
  };
}

describe('parseGrams', () => {
  it.each([
    ['250g', 250], ['125g (4.4oz)', 125], ['1kg (2.2lb)', 1000], ['0.5 kg', 500], ['12oz', 340],
    ['200g / 7.05oz', 200], ['7.05oz', 200], ['250 gram', 250], ['1,000g', 1000], ['2 lb', 907]
  ])('%s -> %i', (text, grams) => {
    expect(parseGrams(text)).toBe(grams);
  });

  it.each(['Washed G1', 'Default Title', '', 'Lot 26-136', '1800 - 2000 masl', 'El Paraiso 92 Gesha'])('%s -> null', (text) => {
    expect(parseGrams(text)).toBeNull();
  });
});

describe('cleanName', () => {
  it.each([
    ['Getachew Zekele Tero Farm Washed G1 200g / 7.05oz - Roasted 09/21/2026', 'Getachew Zekele Tero Farm Washed G1'],
    ['Getachew Zekele Tero Farm Washed G1 200g (7.05oz) Roasted 09.21.2026', 'Getachew Zekele Tero Farm Washed G1'],
    ["26' New Season Panama Tierra Blanca Natural Geisha 60g", "26' New Season Panama Tierra Blanca Natural Geisha"],
    ['Ethiopia Guji (250g)', 'Ethiopia Guji'],
    ['Kenya Kiambu | 12oz', 'Kenya Kiambu'],
    ['Colombia - 250g - Pink Bourbon', 'Colombia - Pink Bourbon'],
    ['Burundi Mikuba 8', 'Burundi Mikuba 8']
  ])('%s', (title, expected) => {
    expect(cleanName(title)).toBe(expected);
  });
});

describe('stripSiteSuffix', () => {
  it("drops a trailing site-name suffix that matches a candidate, loosely", () => {
    expect(stripSiteSuffix('Finca Rosenheim Typica & Caturra - XLIII Coffee', ['XLIII'])).toBe('Finca Rosenheim Typica & Caturra');
    expect(stripSiteSuffix('Kinini Village Dufatanye #03732 - XLIII Coffee', [null, null, 'XLIII Coffee'])).toBe('Kinini Village Dufatanye #03732');
  });

  it('takes the last separator, so a legitimate " - " inside the name is left alone', () => {
    expect(stripSiteSuffix('Colombia - 250g - Pink Bourbon', ['XLIII'])).toBe('Colombia - 250g - Pink Bourbon');
  });

  it('leaves the title untouched with no candidates, or when the tail matches none of them', () => {
    expect(stripSiteSuffix('Finca Rosenheim - XLIII Coffee', [])).toBe('Finca Rosenheim - XLIII Coffee');
    expect(stripSiteSuffix('Finca Rosenheim - XLIII Coffee', ['Shoebox'])).toBe('Finca Rosenheim - XLIII Coffee');
    expect(stripSiteSuffix('No dash here', ['XLIII'])).toBe('No dash here');
  });

  it("doesn't treat two different names as matching just because both normalize away to ''", () => {
    // "Coffee Co" and "The Coffee" both normalize to '' (normalizeRoaster
    // strips "coffee"/"co"/"the") — that must not count as a match.
    expect(stripSiteSuffix('Finca Rosenheim - The Coffee', ['Coffee Co'])).toBe('Finca Rosenheim - The Coffee');
  });
});

describe('findOrigin', () => {
  it('uses a labeled Country:/Origin:/Region: value, country part only', () => {
    expect(findOrigin(product({ attributes: { country: 'Panama' } }), [])).toBe('Panama');
    expect(findOrigin(product({ attributes: { region: 'Shakiso, Ethiopia' } }), [])).toBe('Ethiopia');
  });

  it('ignores a labeled region that names no country and falls through to the text (XLIII)', () => {
    const p = product({ attributes: { origin: 'Northern Province' }, description: 'celebrates Rwandan excellence' });
    expect(findOrigin(p, [])).toBe('Rwanda');
  });

  it('searches tags before title before description', () => {
    const p = product({ tags: ['africa', 'Burundi'], title: 'Kenya-style lot', description: 'Like a Colombian' });
    expect(findOrigin(p, [])).toBe('Burundi');
    expect(findOrigin(product({ title: 'Kenya Kiambu', description: 'Colombia' }), [])).toBe('Kenya');
  });

  it("prefers the user's spelling and the longest country at a position", () => {
    expect(findOrigin(product({ title: 'colombian pink bourbon' }), ['Colombia'])).toBe('Colombia');
    expect(findOrigin(product({ title: 'Papua New Guinea Sigri' }), [])).toBe('Papua New Guinea');
    expect(findOrigin(product({ title: 'Nigeria test' }), [])).toBe('Nigeria');
  });

  it('does not match a country inside another word, and returns null when none', () => {
    expect(findOrigin(product({ description: 'a woman from Indiana' }), [])).toBeNull();
    expect(findOrigin(product({ title: 'House Blend' }), [])).toBeNull();
  });
});

describe('findProcessing', () => {
  it("uses a labeled Process: value, in the user's existing spelling when it matches", () => {
    expect(findProcessing(product({ attributes: { process: 'natural' } }), ['Natural'])).toBe('Natural');
    expect(findProcessing(product({ attributes: { process: 'double ferment washed' } }), ['Double Ferment Washed'])).toBe(
      'Double Ferment Washed'
    );
    expect(findProcessing(product({ attributes: { processing: 'Wet Hulled' } }), [])).toBe('Wet Hulled');
  });

  it('otherwise takes the longest vocabulary match, tags before title before description', () => {
    expect(findProcessing(product({ tags: ['coffee', 'washed'] }), [])).toBe('Washed');
    expect(findProcessing(product({ title: 'Colombia Anaerobic Natural Gesha' }), [])).toBe('Anaerobic Natural');
    expect(findProcessing(product({ tags: ['honey'], description: 'fully washed' }), [])).toBe('Honey');
    expect(findProcessing(product({ description: 'This natural lot…' }), ['Natural'])).toBe('Natural');
  });

  it('returns null when nothing matches', () => {
    expect(findProcessing(product({ title: 'Kenya Kiambu' }), [])).toBeNull();
  });
});

const row = (roaster: string, o: Partial<FillHistoryRow> = {}): FillHistoryRow => ({
  id: 0, roaster, product_url: null, roast_level: null, amount_g: null, rest_days_low: null, rest_days_high: null, ...o
});
const LEVELS = ['Green', 'Hyperlight', 'Ultralight', 'Nordic Light', 'Nordic', 'Light', 'Light/Medium', 'Medium/Light', 'Medium', 'Medium/Dark', 'Dark'];

describe('findRoaster', () => {
  it('matches by the domain of an existing product_url, ignoring www (bare vs www)', () => {
    const history = [row('Luminous', { product_url: 'https://www.luminous.coffee/products/a' })];
    expect(findRoaster(product({ vendor: 'Something Else' }), 'https://luminous.coffee/products/b', history)).toBe('Luminous');
  });

  it('loosely matches vendor/site name to an existing roaster name', () => {
    expect(findRoaster(product({ vendor: 'H+S Coffee Roasters' }), 'https://hscoffeeroasters.com/p', [row('H&S')])).toBe('H&S');
    expect(findRoaster(product({ siteName: 'Big Sur Coffee' }), 'https://bigsurcafe.com/p', [row('Big Sur')])).toBe('Big Sur');
  });

  it('uses brand only to match an existing roaster; the raw fallback prefers site name over brand (Picky Chemist brand is the farm)', () => {
    const p = product({ siteName: 'The Picky Chemist', brand: 'Gesha Village' });
    expect(findRoaster(p, 'https://en.thepickychemist.com/x', [row('Gesha Village')])).toBe('Gesha Village');
    expect(findRoaster(p, 'https://en.thepickychemist.com/x', [])).toBe('The Picky Chemist');
  });

  it('returns null with nothing to go on', () => {
    expect(findRoaster(product(), 'https://x.com/p', [])).toBeNull();
  });
});

describe('findRoastLevel', () => {
  it('takes a whole-phrase level from tags / roast label / title, longest first', () => {
    expect(findRoastLevel(product({ tags: ['Ultralight'] }), LEVELS, null, [])).toEqual({ level: 'Ultralight' });
    expect(findRoastLevel(product({ title: 'Kenya Medium/Light' }), LEVELS, null, [])).toEqual({ level: 'Medium/Light' });
    expect(findRoastLevel(product({ attributes: { roast: 'nordic light' } }), LEVELS, null, [])).toEqual({ level: 'Nordic Light' });
  });

  it('ignores hyphens/spacing/case between letters, so a hyphenated page label still matches', () => {
    expect(findRoastLevel(product({ attributes: { 'roast level': 'Ultra-Light' } }), LEVELS, null, [])).toEqual({ level: 'Ultralight' });
    expect(findRoastLevel(product({ title: 'Kenya Nordic-Light' }), LEVELS, null, [])).toEqual({ level: 'Nordic Light' });
  });

  it('in the description only counts "<level> roast", so tasting notes do not match', () => {
    const noisy = product({ description: 'Juicy, light body, green apple and dark chocolate' });
    expect(findRoastLevel(noisy, LEVELS, null, [])).toBeNull();
    expect(findRoastLevel(product({ description: 'A light roast for filter' }), LEVELS, null, [])).toEqual({ level: 'Light' });
  });

  it("falls back to the roaster's most common level, saying so", () => {
    const history = [...Array(3)].map(() => row('Shoebox', { roast_level: 'Ultralight' })).concat(row('Shoebox', { roast_level: 'Light' }), row('Sey'));
    expect(findRoastLevel(product(), LEVELS, 'Shoebox', history)).toEqual({
      level: 'Ultralight',
      note: 'roast level from 3 of 4 Shoebox coffees'
    });
    const all = [...Array(34)].map(() => row('Shoebox', { roast_level: 'Ultralight' }));
    expect(findRoastLevel(product(), LEVELS, 'Shoebox', all)?.note).toBe('roast level from 34 Shoebox coffees');
    expect(findRoastLevel(product(), LEVELS, 'Nobody', history)).toBeNull();
  });

  it("only trusts the page's level name if the user has used it for this roaster (or has no history)", () => {
    const xliii = [...Array(6)].map(() => row('XLIII', { roast_level: 'Ultralight' }));
    const page = product({ attributes: { 'roast profile': 'Extremely Light' } });
    expect(findRoastLevel(page, LEVELS, 'XLIII', xliii)).toEqual({ level: 'Ultralight', note: 'roast level from 6 XLIII coffees' });
    expect(findRoastLevel(page, LEVELS, 'Newcomer', xliii)).toEqual({ level: 'Light' });
    const hs = [...Array(3)].map(() => row('H&S', { roast_level: 'Ultralight' })).concat(row('H&S', { roast_level: 'Hyperlight' }));
    expect(findRoastLevel(product({ tags: ['Hyperlight'] }), LEVELS, 'H&S', hs)).toEqual({ level: 'Hyperlight' });
  });
});

describe('pickVariant', () => {
  const hs = [row('H&S', { amount_g: 250 }), row('H&S', { amount_g: 250 }), row('H&S', { amount_g: 125 })];
  it('always applies a single variant', () => expect(pickVariant([1000], null, null, [])).toBe(0));
  it('honors a preferred (?variant=) index', () => expect(pickVariant([125, 250, 1000], 2, null, [])).toBe(2));
  it('applies the only variant in 50–250g', () => expect(pickVariant([125, 1000], null, null, [])).toBe(0));
  it('picks the most-bought size among several in range', () => expect(pickVariant([125, 250, 1000], null, 'H&S', hs)).toBe(1));
  it('selects none when several in range and no history, or a tie', () => {
    expect(pickVariant([125, 250, 1000], null, 'H&S', [])).toBeNull();
    expect(pickVariant([125, 250], null, 'H&S', [row('H&S', { amount_g: 125 }), row('H&S', { amount_g: 250 })])).toBeNull();
  });
  it('selects none when nothing is in range or sizes are unknown', () => {
    expect(pickVariant([340, 2268], null, null, [])).toBeNull();
    expect(pickVariant([null, null], null, null, [])).toBeNull();
  });
});

const RATES: UsdRates = { date: '2026-09-25', rates: { USD: 1, GBP: 0.7886, EUR: 0.92, VND: 26345 } };

describe('toUsd', () => {
  it('converts with a fixed table and rounds to cents', () => {
    expect(toUsd(9.25, 'GBP', RATES)).toBe(11.73);
    expect(toUsd(800000, 'VND', RATES)).toBe(30.37);
    expect(toUsd(18, 'EUR', RATES)).toBe(19.57);
  });
  it('passes USD through (rounded) without needing rates', () => {
    expect(toUsd(21, 'USD', null)).toBe(21);
    expect(toUsd(21.005, 'USD', null)).toBe(21.01);
  });
  it('returns null when rates are unavailable or the currency is unknown', () => {
    expect(toUsd(9.25, 'GBP', null)).toBeNull();
    expect(toUsd(5, 'XYZ', RATES)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats known currencies and survives unknown codes', () => {
    expect(formatMoney(9.25, 'GBP')).toBe('£9.25');
    expect(formatMoney(11.73, 'USD')).toBe('$11.73');
    expect(formatMoney(5, 'XYZ1')).toBe('5 XYZ1');
  });
});

const fx = (name: string) => readFileSync(new URL(`./fixtures/product-pages/${name}`, import.meta.url), 'utf8');
const ctx = (o: Partial<FillContext> = {}): FillContext => ({
  url: 'https://example.coffee/products/x', history: [], roastLevels: LEVELS, origins: [], processing: [], rates: RATES, ...o
});

describe('buildFill', () => {
  it('only returns found, non-empty fields (never blanks what the user typed)', () => {
    const r = buildFill(product({ title: 'Mystery Lot', currency: 'USD' }), ctx());
    expect(r.fields).toEqual({ coffee_name: 'Mystery Lot' });
    for (const v of Object.values(r.fields)) expect(v === null || v === '' || v === undefined).toBe(false);
    expect(r.notes.join(' · ')).toMatch(/origin not found/);
  });

  it('non-USD with the rate API down: cost blank, amount still filled, note keeps the original price', () => {
    const p = product({ title: 'Kenya 250g', currency: 'GBP', variants: [{ id: null, label: '', price: 9.25, grams: null }] });
    const r = buildFill(p, ctx({ rates: null }));
    expect(r.fields.cost).toBeUndefined();
    expect(r.fields.amount_g).toBe(250);
    expect(r.notes.join(' · ')).toContain("£9.25 GBP — couldn't convert to USD");
  });

  it('non-USD with rates: converted cost and a note with original price and rate date', () => {
    const p = product({ title: 'Kenya 250g', currency: 'GBP', variants: [{ id: null, label: '', price: 9.25, grams: null }] });
    const r = buildFill(p, ctx());
    expect(r.fields.cost).toBe(11.73);
    expect(r.notes.join(' · ')).toContain('£9.25 GBP → $11.73 USD (rate 2026-09-25)');
  });

  it('preselects the ?variant= from the pasted URL', () => {
    const p = product({
      title: 'Burundi', currency: 'USD',
      variants: [{ id: 111, label: '125g', price: 21, grams: null }, { id: 222, label: '250g', price: 36, grams: null }, { id: 333, label: '1kg', price: 114, grams: null }]
    });
    const r = buildFill(p, ctx({ url: 'https://h.coffee/collections/c/products/burundi?variant=333' }));
    expect(r.selected).toBe(2);
    expect(r.fields).toMatchObject({ amount_g: 1000, cost: 114 });
    expect(r.variants).toHaveLength(3);
  });

  it('several sizes, no history: nothing applied, chips offered, note asks to pick', () => {
    const p = product({ title: 'Burundi', currency: 'USD', variants: [{ id: 1, label: '125g', price: 21, grams: null }, { id: 2, label: '250g', price: 36, grams: null }] });
    const r = buildFill(p, ctx());
    expect(r.selected).toBeNull();
    expect(r.fields.amount_g).toBeUndefined();
    expect(r.variants.map((v) => v.grams)).toEqual([125, 250]);
    expect(r.notes.join(' · ')).toMatch(/pick a bag size/);
  });

  it("falls back to Shopify's own numeric grams when a variant label has no weight text (Luminous)", () => {
    const p = product({
      title: 'Mexico Yellow Caturra', currency: 'USD',
      variants: [
        { id: 1, label: 'TAKEOUT BOX - ALL THE EXTRAS', price: 24, grams: 200 },
        { id: 2, label: 'JUST A BAG', price: 20, grams: 200 }
      ]
    });
    const r = buildFill(p, ctx());
    expect(r.variants.map((v) => v.grams)).toEqual([200, 200]);
  });

  it('a single such variant is still auto-selected, filling amount_g from the Shopify grams field', () => {
    const p = product({ title: 'Mexico Yellow Caturra', currency: 'USD', variants: [{ id: 1, label: 'JUST A BAG', price: 20, grams: 200 }] });
    const r = buildFill(p, ctx());
    expect(r.fields).toMatchObject({ amount_g: 200, cost: 20 });
  });

  it("prefers the page's own weight (title/pageGrams) over Shopify's grams (usually a shipping weight, not the bag size) — normlppl fixture", () => {
    // normlppl.json: single "Default Title" variant, grams: 226 (shipping
    // weight) — but the product title itself says "200g" (the actual bag
    // size), which must win.
    const p = parseShopifyProduct(JSON.parse(fx('normlppl.json')), null);
    const r = buildFill(p, ctx());
    expect(r.fields.amount_g).toBe(200);
  });

  it('aviary fixture: two variants share Shopify grams (a shipping weight) — not trusted over an in-range pick', () => {
    // aviary.json: 200g and 1kg variants both report grams: 300 — the
    // label text ("200g"/"1kg") still wins per-variant, so this is really
    // asserting Shopify grams never overrides an explicit label.
    const p = parseShopifyProduct(JSON.parse(fx('aviary.json')), null);
    const r = buildFill(p, ctx());
    expect(r.variants.map((v) => v.grams)).toEqual([200, 1000]);
  });

  it('shoebox fixture', () => {
    const p = parseShopifyProduct(JSON.parse(fx('shoebox.json')), JSON.parse(fx('shoebox.meta.json')));
    const history = [...Array(5)].map(() => row('Shoebox', { roast_level: 'Ultralight', amount_g: 250 }));
    const r = buildFill(p, ctx({ url: 'https://shoebox.coffee/products/ethiopia-shoondhisa-natural', history, origins: ['Ethiopia'], processing: ['Natural'] }));
    expect(r.fields).toMatchObject({
      roaster: 'Shoebox', coffee_name: 'Ethiopia Shoondhisa Natural', origin: 'Ethiopia', processing: 'Natural', roast_level: 'Ultralight'
    });
    expect(r.fields.image_url).toMatch(/^https:\/\/cdn\.shopify\.com\//);
    // If the fixture's tags/title/description name a roast level, rule (1) wins and this note won't appear.
    // In that case assert roast_level equals that level instead (confirm against shoebox.json).
    expect(r.notes.join(' · ')).toContain('roast level from 5 Shoebox coffees');
  });

  it('hs fixture: tags give origin/process; history picks 250g among 125g/250g', () => {
    const p = parseShopifyProduct(JSON.parse(fx('hs.json')), JSON.parse(fx('hs.meta.json')));
    const history = [row('H&S', { amount_g: 250 }), row('H&S', { amount_g: 250 }), row('H&S', { amount_g: 125 })];
    const r = buildFill(p, ctx({ url: 'https://hscoffeeroasters.com/products/burundi-mikuba-8', history, processing: ['Washed'] }));
    expect(r.fields).toMatchObject({ roaster: 'H&S', origin: 'Burundi', processing: 'Washed', amount_g: 250, cost: 36 }); // cost from fixture
    expect(r.selected).toBe(1);
  });

  it("adds the rest window when a roast level resolves, from this roaster's history", () => {
    const history = [180, 180, 70].map((low, i) =>
      row('XLIII', { id: i + 1, roast_level: 'Hyperlight', rest_days_low: low, rest_days_high: 365 })
    );
    const r = buildFill(product({ title: 'Kinini', vendor: 'XLIII', tags: ['Hyperlight'] }), ctx({ history }));
    expect(r.fields).toMatchObject({ roaster: 'XLIII', roast_level: 'Hyperlight', rest_days_low: 180, rest_days_high: 365 });
    // Surfaced separately from `notes` so the form shows it once, below the rest-days fields.
    expect(r.restNote).toBe('Typical rest for XLIII Hyperlight coffees: 180 to 365 days (based on 2 of your 3).');
    expect(r.notes.join(' · ')).not.toContain('Typical rest');
  });

  it('strips the roaster\'s own page-title suffix from coffee_name (XLIII)', () => {
    const p = product({ title: 'Kinini Village Dufatanye #03732 - XLIII Coffee', siteName: 'XLIII Coffee', currency: 'USD' });
    const r = buildFill(p, ctx());
    expect(r.fields.coffee_name).toBe('Kinini Village Dufatanye #03732');
  });

  it('xliii fixture: VND converted, process + net weight from attribute rows', () => {
    const p = parseHtmlProduct(fx('xliii.html'))!;
    const r = buildFill(p, ctx({ url: 'https://xliiicoffee.com/en/product/kinini-village-dufatanye-farmer-03732/', processing: ['Washed'] }));
    expect(r.fields).toMatchObject({ processing: 'Washed', amount_g: 250, cost: 30.37 }); // 800000 / 26345
    expect(r.fields.roaster).toBe('XLIII Coffee'); // no history → raw site name
    expect(r.notes.join(' · ')).toMatch(/VND → \$30\.37 USD \(rate 2026-09-25\)/);
  });
});
