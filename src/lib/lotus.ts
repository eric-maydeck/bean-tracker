import { pickOne } from '$lib/pageUrlState';

// Lotus drop calculator. Per drop in 900 mL: Ca or Mg +10 GH, Na or K +5 KH
// (docs/backlog/lotus-800ml-recipes.md "Basis"); in V mL each drop scales by 900/V.
export type Drops = { ca?: number; mg?: number; na?: number; k?: number };
export interface Recipe { name: string; slug: string; drops: Drops; gh: number; kh: number }

export const RECIPES: Recipe[] = [
  { name: 'Mg/K 60/10', slug: 'mg-k-60-10', drops: { mg: 6, k: 2 }, gh: 60, kh: 10 },
  { name: 'Holy Water', slug: 'holy-water', drops: { mg: 6, k: 4 }, gh: 60, kh: 20 },
  { name: 'Ultralight (Mg + K)', slug: 'ultralight-mg-k', drops: { mg: 4, k: 2 }, gh: 40, kh: 10 },
  { name: 'Light and Bright', slug: 'light-and-bright', drops: { ca: 6, k: 5 }, gh: 60, kh: 25 },
  { name: 'Reddit Bright and Juicy mod', slug: 'reddit-bright-and-juicy-mod', drops: { mg: 4, ca: 3, na: 2, k: 1 }, gh: 70, kh: 15 },
  { name: 'Bright and Juicy', slug: 'bright-and-juicy', drops: { mg: 4, ca: 4, na: 2, k: 2 }, gh: 80, kh: 20 },
  { name: 'Ultralight (Mg + Ca + K)', slug: 'ultralight-mg-ca-k', drops: { mg: 2, ca: 2, k: 2 }, gh: 40, kh: 10 },
  { name: 'Substance', slug: 'substance', drops: { ca: 6, mg: 3, k: 8 }, gh: 90, kh: 40 }
];

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
].map(([name, ml]) => ({ name: name as string, ml: ml as number }));
// The dropdown shows the picked kettle only while the mL still equals its capacity, else the placeholder.
export const kettleFor = (ml: number, picked = ''): string => (KETTLES.find((k) => k.name === picked && k.ml === ml) ? picked : '');

export const CONCENTRATES = [['ca', 'Calcium'], ['mg', 'Magnesium'], ['na', 'Sodium'], ['k', 'Potassium']] as const;

export function hardness(d: Drops, ml: number): { gh: number; kh: number } {
  const f = 900 / ml;
  return { gh: ((d.ca ?? 0) + (d.mg ?? 0)) * 10 * f, kh: ((d.na ?? 0) + (d.k ?? 0)) * 5 * f };
}

// Fraction of a pair's drops that is the first one (Ca of Ca+Mg, Na of Na+K); 0.5 when neither is used.
const share = (a = 0, b = 0) => (a + b ? a / (a + b) : 0.5);

// Every combo of floor-1..ceil+1 of each concentrate's scaled drops (a used one stays >= 1 unless it
// scales below 0.5); smallest relative GH+KH miss wins, then the closest Ca:Mg and Na:K split, then
// more Ca / Na. ponytail: brute force, at most 5^4 combos.
export function bestFit(r: Recipe, ml: number): { drops: Drops; gh: number; kh: number } {
  const keys = Object.keys(r.drops) as (keyof Drops)[];
  const opts = keys.map((k) => {
    const s = (r.drops[k]! * ml) / 900;
    const lo = s < 0.5 ? 0 : 1;
    const out: number[] = [];
    for (let n = Math.floor(s) - 1; n <= Math.ceil(s) + 1; n++) if (n >= lo) out.push(n);
    return out;
  });
  let best: { drops: Drops; gh: number; kh: number; key: number[] } | undefined;
  const walk = (i: number, d: Drops) => {
    if (i === keys.length) {
      const h = hardness(d, ml);
      const key = [
        Math.abs(h.gh - r.gh) / r.gh + Math.abs(h.kh - r.kh) / r.kh,
        Math.abs(share(d.ca, d.mg) - share(r.drops.ca, r.drops.mg)) + Math.abs(share(d.na, d.k) - share(r.drops.na, r.drops.k)),
        -(d.ca ?? 0),
        -(d.na ?? 0)
      ];
      const j = best ? key.findIndex((v, m) => v !== best!.key[m]) : 0;
      const better = !best || (j >= 0 && key[j] < best.key[j]);
      if (better) best = { drops: { ...d }, ...h, key };
      return;
    }
    for (const n of opts[i]) walk(i + 1, { ...d, [keys[i]]: n });
  };
  walk(0, {});
  return { drops: best!.drops, gh: best!.gh, kh: best!.kh };
}

// ?recipe=<slug>&ml=<n>; bare = first recipe, 1000 mL. Explicit choices stay in the URL.
export function parseLotus(p: URLSearchParams): { recipe?: string; ml?: number } {
  const recipe = pickOne(p, 'recipe', RECIPES.map((r) => r.slug));
  const raw = p.get('ml') ?? '';
  const ml = /^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML ? +raw : undefined;
  return { ...(recipe && { recipe }), ...(ml !== undefined && { ml }) };
}

export function lotusParams(s: { recipe?: string; ml?: number }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.recipe) p.set('recipe', s.recipe);
  if (s.ml !== undefined) p.set('ml', String(s.ml));
  return p;
}
