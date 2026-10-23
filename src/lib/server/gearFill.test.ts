import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGearFill, cleanBrand } from './gearFill';
import { parseShopifyProduct, parseHtmlProduct } from './productParse';

const fx = (n: string) => readFileSync(new URL(`./fixtures/gear-pages/${n}`, import.meta.url), 'utf8');
const shopify = () => parseShopifyProduct(JSON.parse(fx('shopify-grinder.json')), JSON.parse(fx('shopify-grinder.meta.json')));
const URL_ = 'https://store.example.com/products/x';

describe('buildGearFill', () => {
  it('Shopify product: brand, model, price, image, specs from body table', () => {
    const f = buildGearFill(shopify(), { url: URL_, kind: 'grinder', rates: null });
    expect(f.values).toEqual({
      brand: 'Timemore', model: 'C3 Pro Hand Grinder', cost: 89, website: URL_,
      type: 'Hand', burrType: 'Conical', burrSize: 38, burrCoating: 'Stainless steel', adjustment: 'Stepped', stepSize: 18
    });
    expect(f.imageUrl).toBe('https://cdn.example.com/c3pro.jpg');
    expect(f.notes[0]).toBe('Filled 10 fields');
  });
  it('drops stepSize unless the grinder is Stepped, and unknown adjustment text', () => {
    const p = shopify(); p.attributes.adjustment = 'Stepless';
    expect(buildGearFill(p, { url: URL_, kind: 'grinder', rates: null }).values).not.toHaveProperty('stepSize');
    p.attributes.adjustment = '40 clicks'; p.description = '';
    expect(buildGearFill(p, { url: URL_, kind: 'grinder', rates: null }).values).not.toHaveProperty('adjustment');
  });
  it('JSON-LD page: brand from Brand.name', () => {
    const p = parseHtmlProduct(fx('jsonld-dripper.html'))!;
    const f = buildGearFill(p, { url: URL_, kind: 'dripper', rates: null });
    expect(f.values).toMatchObject({ brand: 'Origami', model: 'Dripper M', cost: 36, material: 'Ceramic', flow: 'Open', coneAngle: 60 });
  });
  it('non-USD without rates: cost blank with a note', () => {
    const p = shopify(); p.currency = 'EUR';
    const f = buildGearFill(p, { url: URL_, kind: 'grinder', rates: null });
    expect(f.values).not.toHaveProperty('cost');
    expect(f.notes.join(' ')).toContain("couldn't convert to USD, cost left blank");
  });
  it('no attributes: name, price, image and what the title says', () => {
    const f = buildGearFill(parseHtmlProduct(fx('og-only-filter.html'))!, { url: URL_, kind: 'filter', rates: null });
    expect(f.values).toEqual({ brand: 'Cafec', model: 'Abaca Filter 01', website: URL_, fits: '01' });
    expect(f.imageUrl).toBe('https://cdn.example.com/abaca.jpg');
  });
  it('options fields keep only an option match, normalized; free text fields are unchanged', () => {
    const p = parseHtmlProduct(fx('jsonld-dripper.html'))!;
    p.attributes = { size: 'W108ｘD108ｘH86 millimeters', material: 'ceramic', flow: 'Gravity-fed' };
    const f = buildGearFill(p, { url: URL_, kind: 'dripper', rates: null });
    expect(f.values).not.toHaveProperty('size');
    expect(f.values.material).toBe('Ceramic');
    expect(f.values).not.toHaveProperty('flow');
    p.attributes = { 'burr name': 'Anything goes' };
    expect(buildGearFill(p, { url: URL_, kind: 'grinder', rates: null }).values.burrName).toBe('Anything goes');
    expect(f.notes[0]).toBe(`Filled ${Object.keys(f.values).length} fields`);
  });

  it('prose specs from the description when no labeled line has them (real Hario V60 page)', () => {
    const p = parseShopifyProduct(JSON.parse(fx('shopify-hario-v60-ceramic.json')), { name: 'Hario USA', currency: 'USD' });
    expect(buildGearFill(p, { url: URL_, kind: 'dripper', rates: null }).values).toEqual({
      brand: 'Hario', model: 'V60 Ceramic Coffee Dripper 02 - Metallic Colors', cost: 50, website: URL_,
      shape: 'Conical', coneAngle: 60, material: 'Ceramic', flow: 'Open', size: '02'
    });
  });
  it('a labeled line that matches no option falls back to the prose', () => {
    const p = parseShopifyProduct(JSON.parse(fx('shopify-hario-v60-ceramic.json')), null);
    p.attributes.material = 'Arita porcelain with titanium';
    expect(buildGearFill(p, { url: URL_, kind: 'dripper', rates: null }).values.material).toBe('Ceramic');
  });
});

describe('prose cues', () => {
  const hario = () => parseShopifyProduct(JSON.parse(fx('shopify-hario-v60-ceramic.json')), null);
  it('a brew temperature is never the cone angle; V60 in the title still gives 60', () => {
    for (const temp of ['Brew at 93°C.', 'Use water at 200°F.', 'Water at 93 degrees Celsius.']) {
      const p = hario(); p.description = `${temp} ${p.description}`;
      expect(buildGearFill(p, { url: URL_, kind: 'dripper', rates: null }).values.coneAngle).toBe(60);
    }
  });
  it('a glass server or a user manual is not the gear', () => {
    const p = hario(); p.description = 'Comes with a glass server and a user manual.';
    expect(buildGearFill(p, { url: URL_, kind: 'dripper', rates: null }).values).toMatchObject({ material: 'Ceramic' });
    const g = parseShopifyProduct(JSON.parse(fx('shopify-grinder.json')), null);
    g.title = 'C3 Pro'; g.description = 'See the user manual.';
    expect(buildGearFill(g, { url: URL_, kind: 'grinder', rates: null }).values).not.toHaveProperty('type');
  });
});

describe('cleanBrand', () => {
  it('trims store suffixes, never to empty or an all-caps brand', () => {
    const cases: [string, string][] = [['Hario USA', 'Hario'], ['HarioWS', 'Hario'], ['HarioUSA', 'Hario'], ['Fellow Products Inc.', 'Fellow Products'],
      ['SSP', 'SSP'], ['DF64', 'DF64'], ['Timemore', 'Timemore'], ['USA', 'USA'], ['Hario Store USA', 'Hario']];
    for (const [i, o] of cases) expect(cleanBrand(i)).toBe(o);
  });
});
