import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGearFill } from './gearFill';
import { parseShopifyProduct, parseHtmlProduct } from './productParse';

const fx = (n: string) => readFileSync(new URL(`./fixtures/gear-pages/${n}`, import.meta.url), 'utf8');
const shopify = () => parseShopifyProduct(JSON.parse(fx('shopify-grinder.json')), JSON.parse(fx('shopify-grinder.meta.json')));
const URL_ = 'https://store.example.com/products/x';

describe('buildGearFill', () => {
  it('Shopify product: brand, model, price, image, specs from body table', () => {
    const f = buildGearFill(shopify(), { url: URL_, kind: 'grinder', rates: null });
    expect(f.values).toEqual({
      brand: 'Timemore', model: 'C3 Pro Hand Grinder', cost: 89, website: URL_,
      burrType: 'Conical', burrSize: 38, burrCoating: 'Stainless steel', adjustment: 'Stepped', stepSize: 18
    });
    expect(f.imageUrl).toBe('https://cdn.example.com/c3pro.jpg');
    expect(f.notes[0]).toBe('Filled 9 fields');
  });
  it('drops stepSize unless the grinder is Stepped, and unknown adjustment text', () => {
    const p = shopify(); p.attributes.adjustment = 'Stepless';
    expect(buildGearFill(p, { url: URL_, kind: 'grinder', rates: null }).values).not.toHaveProperty('stepSize');
    p.attributes.adjustment = '40 clicks';
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
  it('no attributes: name, price and image only', () => {
    const f = buildGearFill(parseHtmlProduct(fx('og-only-filter.html'))!, { url: URL_, kind: 'filter', rates: null });
    expect(f.values).toEqual({ brand: 'Cafec', model: 'Abaca Filter 01', website: URL_ });
    expect(f.imageUrl).toBe('https://cdn.example.com/abaca.jpg');
  });
});
