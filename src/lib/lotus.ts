import { pickOne } from '$lib/pageUrlState';

// Lotus drop calculator, copied from Lotus's own (lotuscoffeeproducts.com product-instructions):
// drops = round(ppm x L/4.5 x 0.56), doubled for Na and K, round-tip dropper. Basis and recipes:
// docs/backlog/lotus-800ml-recipes.md.
export type Drops = { ca: number; mg: number; na: number; k: number };
// Target ppm per mineral: Ca and Mg count as GH, Na and K as KH.
export interface Recipe { name: string; slug: string; ppm: Drops }

const recipe = (name: string, ca: number, mg: number, na: number, k: number): Recipe => ({
  name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), ppm: { ca, mg, na, k }
});
export const RECIPES: Recipe[] = [
  recipe('Bright and Juicy', 40, 40, 10, 10),
  recipe('Holy Water', 0, 60, 0, 20),
  recipe('Light and Bright', 60, 0, 0, 25),
  recipe('Lume High Clarity', 8, 24.1, 0, 4),
  recipe('Lume Ultra Soft', 10, 10, 0, 5),
  recipe('Mg/K 60/10', 0, 60, 0, 10),
  recipe('Reddit Bright and Juicy mod', 30, 40, 10, 5),
  recipe('Substance', 60, 30, 0, 40),
  recipe('Ultralight (Mg + Ca + K)', 20, 20, 0, 10),
  recipe('Ultralight (Mg + K)', 0, 40, 0, 10)
].sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_ML = 1000;
export const MIN_ML = 100;
export const MAX_ML = 2000;

// Manufacturer-published capacity (mL), alphabetical.
export const KETTLES = [
  ['Bodum Melior Gooseneck', 800], ['Bonavita Variable Temperature Gooseneck', 1000],
  ['Brewista Artisan 0.6 L', 600], ['Brewista Artisan 0.9 L', 900], ['Brewista Artisan 1.0 L', 1000],
  ['Brewista Smart Pour 2', 1200], ['Cosori Electric Gooseneck', 800], ['Fellow Stagg EKG', 900],
  ['Fellow Stagg EKG Pro', 900], ['Fellow Stagg EKG Pro Studio', 900], ['Hario V60 Buono Power Kettle', 800],
  ['OXO Brew Adjustable Temperature Pour-Over Kettle', 1000], ['Palatti Enso', 880], ['Timemore Fish Pro X', 900],
  ['Timemore Fish Smart 600 mL', 600], ['Timemore Fish Smart 800 mL', 800]
].map(([name, ml]) => ({ name: name as string, ml: ml as number, slug: (name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') }));
// The dropdown shows the picked kettle (slug) only while the mL still equals its capacity, else the placeholder.
export const kettleFor = (ml: number, picked = ''): string => (KETTLES.find((k) => k.slug === picked && k.ml === ml) ? picked : '');

export const CONCENTRATES = [['ca', 'Calcium'], ['mg', 'Magnesium'], ['na', 'Sodium'], ['k', 'Potassium']] as const;

const ROUND_TIP = 0.56;

export function dropsFor(r: Recipe, ml: number): Drops {
  const n = (ppm: number, f = 1) => Math.round(((ppm * ml) / 1000 / 4.5) * ROUND_TIP * f);
  return { ca: n(r.ppm.ca), mg: n(r.ppm.mg), na: n(r.ppm.na, 2), k: n(r.ppm.k, 2) };
}

// Resulting hardness (ppm as CaCO3) from whole drops.
export function hardness(d: Drops, ml: number): { gh: number; kh: number } {
  const perDrop = 4.5 / (ROUND_TIP * (ml / 1000));
  return { gh: (d.ca + d.mg) * perDrop, kh: ((d.na + d.k) * perDrop) / 2 };
}

// ?recipe=<slug>&ml=<n>&kettle=<slug>; bare = first recipe (alphabetical), 1000 mL, no kettle. Explicit choices stay in the URL.
export function parseLotus(p: URLSearchParams): { recipe?: string; ml?: number; kettle?: string } {
  const recipe = pickOne(p, 'recipe', RECIPES.map((r) => r.slug));
  const kettle = pickOne(p, 'kettle', KETTLES.map((k) => k.slug));
  const raw = p.get('ml') ?? '';
  const ml = /^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML ? +raw : undefined;
  return { ...(recipe && { recipe }), ...(ml !== undefined && { ml }), ...(kettle && { kettle }) };
}

export function lotusParams(s: { recipe?: string; ml?: number; kettle?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.recipe) p.set('recipe', s.recipe);
  if (s.ml !== undefined) p.set('ml', String(s.ml));
  if (s.kettle) p.set('kettle', s.kettle);
  return p;
}
