import { describe, it, expect } from 'vitest';
import { RECIPES, bestFit, hardness, lotusParams, parseLotus, DEFAULT_ML, KETTLES, kettleFor, type Drops } from './lotus';

const p = (q: string) => new URLSearchParams(q);
const r = (slug: string) => RECIPES.find((x) => x.slug === slug)!;

// The drafted 800 mL table (docs/backlog/lotus-800ml-recipes.md).
const T800: [string, Drops, number, number][] = [
  ['mg-k-60-10', { mg: 5, k: 2 }, 56.25, 11.25],
  ['holy-water', { mg: 5, k: 4 }, 56.25, 22.5],
  ['ultralight-mg-k', { mg: 4, k: 2 }, 45, 11.25],
  ['light-and-bright', { ca: 5, k: 4 }, 56.25, 22.5],
  ['reddit-bright-and-juicy-mod', { mg: 3, ca: 3, na: 2, k: 1 }, 67.5, 16.875],
  ['bright-and-juicy', { mg: 3, ca: 4, na: 2, k: 2 }, 78.75, 22.5],
  ['ultralight-mg-ca-k', { mg: 2, ca: 2, k: 2 }, 45, 11.25],
  ['substance', { ca: 5, mg: 3, k: 7 }, 90, 39.375]
];

describe('bestFit', () => {
  it.each(T800)('%s at 800 mL', (slug, drops, gh, kh) => {
    const fit = bestFit(r(slug), 800);
    expect(fit.drops).toEqual(drops);
    expect(fit.gh).toBeCloseTo(gh, 2);
    expect(fit.kh).toBeCloseTo(kh, 2);
  });
  it('900 mL gives back the original drops', () => {
    for (const rec of RECIPES) {
      expect(bestFit(rec, 900).drops).toEqual(rec.drops);
    }
  });
  it('hardness scales per drop with volume', () => {
    expect(hardness({ ca: 1 }, 900)).toEqual({ gh: 10, kh: 0 });
    expect(hardness({ k: 1 }, 450)).toEqual({ gh: 0, kh: 10 });
  });
  it('keeps a used concentrate at 1+ drop in a small volume', () => {
    const d = bestFit(r('substance'), 100).drops; // scaled 0.67 / 0.33 / 0.89
    expect(d.ca).toBeGreaterThanOrEqual(1);
    expect(d.k).toBeGreaterThanOrEqual(1);
    expect(d.mg).toBe(0); // 0.33 < 0.5
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
  it('round trip', () => {
    expect(lotusParams({ recipe: 'holy-water', ml: 1000 }).toString()).toBe('recipe=holy-water&ml=1000');
    expect(lotusParams({}).toString()).toBe('');
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
    expect(kettleFor(880, 'Palatti Enso')).toBe('Palatti Enso');
    expect(kettleFor(881, 'Palatti Enso')).toBe('');
    expect(kettleFor(1000)).toBe('');
  });
});
