import { describe, it, expect } from 'vitest';
import { RECIPES, dropsFor, hardness, lotusParams, parseLotus, DEFAULT_ML, KETTLES, kettleFor, type Drops } from './lotus';

const p = (q: string) => new URLSearchParams(q);
const r = (slug: string) => RECIPES.find((x) => x.slug === slug)!;
const d = (ca: number, mg: number, na: number, k: number): Drops => ({ ca, mg, na, k });

// Spec "Drops at 800 mL" column (docs/backlog/lotus-800ml-recipes.md).
const T800: [string, Drops][] = [
  ['bright-and-juicy', d(4, 4, 2, 2)],
  ['holy-water', d(0, 6, 0, 4)],
  ['light-and-bright', d(6, 0, 0, 5)],
  ['lume-ultra-soft', d(1, 1, 0, 1)],
  ['mg-k-60-10', d(0, 6, 0, 2)],
  ['reddit-bright-and-juicy-mod', d(3, 4, 2, 1)],
  ['substance', d(6, 3, 0, 8)],
  ['ultralight-mg-ca-k', d(2, 2, 0, 2)],
  ['ultralight-mg-k', d(0, 4, 0, 2)]
];

describe('dropsFor (Lotus formula)', () => {
  it.each(T800)('%s at 800 mL', (slug, drops) => {
    expect(dropsFor(r(slug), 800)).toEqual(drops);
  });
  it('Lume High Clarity at 1000 mL', () => {
    expect(dropsFor(r('lume-high-clarity'), 1000)).toEqual(d(1, 3, 0, 1));
  });
  it('1000 mL case from the formula: Substance', () => {
    // Ca 60: round(60/4.5*.56)=7, Mg 30: 4, K 40: round(40/4.5*.56*2)=10
    expect(dropsFor(r('substance'), 1000)).toEqual(d(7, 4, 0, 10));
  });
  it('hardness from whole drops', () => {
    const h = hardness(d(4, 4, 2, 2), 800); // 8 drops x 4.5/(.56*.8) = 80.4; 4 KH drops / 2
    expect(h.gh).toBeCloseTo(80.36, 1);
    expect(h.kh).toBeCloseTo(20.09, 1);
  });
});

describe('lotus url state', () => {
  it('bare is the default', () => {
    expect(parseLotus(p(''))).toEqual({});
    expect(DEFAULT_ML).toBe(1000);
  });
  it('case-insensitive, bad values ignored', () => {
    expect(parseLotus(p('recipe=HOLY-water&ml=1200'))).toEqual({ recipe: 'holy-water', ml: 1200 });
    expect(parseLotus(p('recipe=nope&ml=abc'))).toEqual({});
    expect(parseLotus(p('ml=99'))).toEqual({});
    expect(parseLotus(p('ml=2001'))).toEqual({});
    expect(parseLotus(p('ml=800.5'))).toEqual({});
    expect(parseLotus(p('ml=1000'))).toEqual({ ml: 1000 }); // explicit default stays explicit
  });
  it('kettle param: case-insensitive, bad ignored, slugs unique', () => {
    expect(parseLotus(p('kettle=PALATTI-Enso&ml=880'))).toEqual({ ml: 880, kettle: 'palatti-enso' });
    expect(parseLotus(p('kettle=nope'))).toEqual({});
    expect(new Set(KETTLES.map((k) => k.slug)).size).toBe(KETTLES.length);
    expect(lotusParams({ ml: 880, kettle: 'palatti-enso' }).toString()).toBe('ml=880&kettle=palatti-enso');
  });
  it('round trip', () => {
    expect(lotusParams({ recipe: 'holy-water', ml: 1000 }).toString()).toBe('recipe=holy-water&ml=1000');
    expect(lotusParams({}).toString()).toBe('');
  });
});

describe('recipes', () => {
  it('alphabetical by name; bare default is the first', () => {
    const names = RECIPES.map((x) => x.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(RECIPES[0].slug).toBe('bright-and-juicy');
  });
  it('unused concentrates are 0', () => {
    expect(dropsFor(r('holy-water'), 800).ca).toBe(0);
  });
});

describe('kettles', () => {
  it('alphabetical, published capacities', () => {
    const names = KETTLES.map((k) => k.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(KETTLES.find((k) => k.name === 'Palatti Enso')!.ml).toBe(880);
    expect(KETTLES.find((k) => k.name === 'Timemore Fish Smart 600 mL')!.ml).toBe(600);
    expect(KETTLES.find((k) => k.name === 'Timemore Fish Smart 800 mL')!.ml).toBe(800);
  });
  it('shows the picked kettle only while ml matches it', () => {
    expect(kettleFor(880, 'palatti-enso')).toBe('palatti-enso');
    expect(kettleFor(881, 'palatti-enso')).toBe('');
    expect(kettleFor(1000)).toBe('');
  });
});
