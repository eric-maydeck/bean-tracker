import { pickOne } from '$lib/pageUrlState';

// Lotus drop calculator, copied from Lotus's own (lotuscoffeeproducts.com product-instructions):
// drops = round(ppm x L/4.5 x tip factor), doubled for Na and K. The factor is Lotus's calculator inline JS
// (dropperStyleConversion: round 0.56, straight 1); its "Straight" style is the Precision Dropper, whose tip
// averages 0.04g per drop vs 0.072g for the round tip (lotuscoffeeproducts.com/products/precision-dropper-straight-tipped).
//
export type Drops = { mg: number; ca: number; na: number; k: number };
// Target ppm per mineral: Ca and Mg count as GH, Na and K as KH.
export interface Recipe { name: string; slug: string; ppm: Drops }

const recipe = (name: string, mg: number, ca: number, na: number, k: number): Recipe => ({
  name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), ppm: { mg, ca, na, k }
});
export const RECIPES: Recipe[] = [
  recipe('Bright and Juicy', 40, 40, 10, 10),
  recipe('Holy Water', 60, 0, 0, 20),
  recipe('Light and Bright', 0, 60, 0, 25),
  recipe('Lume High Clarity', 24.1, 8, 0, 4),
  recipe('Lume Ultra Soft', 10, 10, 0, 5),
  recipe('Mg/K 60/10', 60, 0, 0, 10),
  recipe('Reddit Bright and Juicy mod', 40, 30, 10, 5),
  recipe('Substance', 30, 60, 0, 40),
  recipe('Ultralight (Mg + Ca + K)', 20, 20, 0, 10),
  recipe('Ultralight (Mg + K)', 40, 0, 0, 10)
].sort((a, b) => a.name.localeCompare(b.name));

// Water when none is picked: the volume each tip's drops land on best (user, 2026-11-01). An explicit mL always wins.
export const DEFAULT_ML: Record<'round' | 'precision', number> = { round: 800, precision: 900 };
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

export const CONCENTRATES = [['mg', 'Magnesium'], ['ca', 'Calcium'], ['na', 'Sodium'], ['k', 'Potassium']] as const;

export type Tip = 'round' | 'precision';
export const TIPS: Tip[] = ['round', 'precision'];
export const TIP_LABEL: Record<Tip, string> = { round: 'Round tip', precision: 'Precision' };
const TIP_FACTOR: Record<Tip, number> = { round: 0.56, precision: 1 };

// Drops mode keeps each entered count as a tip-independent anchor (drops / factor = the mineral's strength), so
// switching tips back and forth never drifts: a switch shows round(anchor x new factor) (box takes at most 3 digits).
export const dropAnchor = (drops: number, tip: Tip): number => drops / TIP_FACTOR[tip];
export const dropsFromAnchor = (anchor: number, tip: Tip): number => Math.min(999, Math.round(anchor * TIP_FACTOR[tip]));

// Lotus rounding on target ppm as CaCO3 (Ca, Mg as GH; Na, K as KH).
export function dropsFromPpm(ppm: Drops, ml: number, tip: Tip = 'round'): Drops {
  const n = (v: number, f = 1) => Math.round(((v * ml) / 1000 / 4.5) * TIP_FACTOR[tip] * f);
  return { mg: n(ppm.mg), ca: n(ppm.ca), na: n(ppm.na, 2), k: n(ppm.k, 2) };
}
export const dropsFor = (r: Recipe, ml: number, tip: Tip = 'round'): Drops => dropsFromPpm(r.ppm, ml, tip);

// Basis factors: ion mg/L per ppm as CaCO3 (Na, K per ppm of KH, which is 2 x the drop-count ppm).
const CA = 0.40078, MG = 0.24305, NA = 2 * 0.22989, K = 2 * 0.390983, CL = 2 * 0.35453, HCO3 = 2 * 0.61016;

// A target in mg/L of each ion -> ppm as CaCO3.
export const ppmFromMgl = (m: Drops): Drops => ({ mg: m.mg / MG, ca: m.ca / CA, na: m.na / NA, k: m.k / K });

// Resulting water from whole drops: minerals in mg/L (Cl and HCO3 included), GH and KH as ppm CaCO3.
export function minerals(d: Drops, ml: number, tip: Tip = 'round') {
  const perDrop = 4.5 / (TIP_FACTOR[tip] * (ml / 1000));
  const gh = (d.ca + d.mg) * perDrop;
  const kh = ((d.na + d.k) * perDrop) / 2;
  return {
    gh, kh,
    ca: d.ca * perDrop * CA, mg: d.mg * perDrop * MG,
    na: (d.na * perDrop / 2) * NA, k: (d.k * perDrop / 2) * K,
    cl: gh * CL, hco3: kh * HCO3
  };
}

// The mL (100-1200, 50 mL steps like the slider, so always a round measurable volume) where whole drops land closest to the recipe: smallest worst relative error of the
// result's ppm vs its target over the nonzero minerals; near-ties (400/800/1200) go to the median kettle capacity.
const mlErr = (r: Recipe, ml: number, tip: Tip): number => {
  const d = dropsFor(r, ml, tip), perDrop = 4.5 / (TIP_FACTOR[tip] * (ml / 1000));
  const keys = (['mg', 'ca', 'na', 'k'] as const).filter((m) => r.ppm[m] > 0);
  return Math.max(...keys.map((m) => Math.abs((d[m] * perDrop * (m === 'na' || m === 'k' ? 0.5 : 1)) / r.ppm[m] - 1)));
};
export function idealMl(r: Recipe, tip: Tip = 'round'): number {
  const typical = KETTLES.map((k) => k.ml).sort((a, b) => a - b)[KETTLES.length >> 1];
  let best = 0, bestErr = Infinity;
  for (let ml = MIN_ML; ml <= 1200; ml += 50) {
    const err = mlErr(r, ml, tip);
    if (err < bestErr - 1e-9 || (err < bestErr + 1e-9 && Math.abs(ml - typical) < Math.abs(best - typical))) [best, bestErr] = [ml, err];
  }
  return best;
}
// What to suggest, ascending: the best mL, plus any equally accurate mL a 1000mL kettle can hold when the best is above that.
export function idealMls(r: Recipe, tip: Tip = 'round'): number[] {
  const best = idealMl(r, tip);
  if (best <= 1000) return [best];
  const fits: number[] = [];
  for (let ml = MIN_ML; ml <= 1000; ml += 50) if (mlErr(r, ml, tip) < mlErr(r, best, tip) + 1e-9) fits.push(ml);
  return [...fits, best];
}

export type Mode = 'recipe' | 'drops' | 'target';
export const MODES: Mode[] = ['recipe', 'drops', 'target'];
export const MODE_LABEL: Record<Mode, string> = { recipe: 'Recipe', drops: 'Drops', target: 'Target' };
export type Unit = 'ppm' | 'mgl';
export interface LotusState { recipe?: string; ml?: number; kettle?: string; mode?: Mode; unit?: Unit; tip?: Tip; vals?: Partial<Drops> }
const MINERALS = ['mg', 'ca', 'na', 'k'] as const;

// ?mode=drops|target (bare = recipe) &recipe=<slug> (recipe mode) &ml=<n> &kettle=<slug>
// &ca/mg/na/k=<n> (drops: integers; target: decimals) &unit=mgl (target mode; bare = ppm) &tip=precision (bare = round tip). Explicit choices stay in the URL.
export function parseLotus(p: URLSearchParams): LotusState {
  const mode = pickOne(p, 'mode', ['drops', 'target'] as const);
  const recipe = mode ? undefined : pickOne(p, 'recipe', RECIPES.map((r) => r.slug));
  const kettle = pickOne(p, 'kettle', KETTLES.map((k) => k.slug));
  const raw = p.get('ml') ?? '';
  const ml = /^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML ? +raw : undefined;
  const unit = mode === 'target' ? pickOne(p, 'unit', ['ppm', 'mgl'] as const) : undefined;
  const tip = pickOne(p, 'tip', TIPS);
  const vals: Partial<Drops> = {};
  for (const m of MINERALS) {
    const v = p.get(m) ?? '';
    if (mode === 'drops' ? /^\d{1,3}$/.test(v) : mode === 'target' && /^\d{1,4}(\.\d+)?$/.test(v)) vals[m] = +v;
  }
  return {
    ...(recipe && { recipe }), ...(ml !== undefined && { ml }), ...(kettle && { kettle }),
    ...(mode && { mode }), ...(tip && { tip }), ...(unit && { unit }), ...(Object.keys(vals).length && { vals })
  };
}

export function lotusParams(s: LotusState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.mode) p.set('mode', s.mode);
  if (s.recipe) p.set('recipe', s.recipe);
  if (s.ml !== undefined) p.set('ml', String(s.ml));
  if (s.kettle) p.set('kettle', s.kettle);
  if (s.unit) p.set('unit', s.unit);
  if (s.tip) p.set('tip', s.tip);
  for (const m of MINERALS) if (s.vals?.[m] !== undefined) p.set(m, String(s.vals[m]));
  return p;
}

// The page's state is remembered per browser, no expiry: the same query string the URL carries, so a saved
// value goes through parseLotus (the one gate) when loaded. Versioned: bump if the params change meaning.
export const WATER_STORAGE_KEY = 'bean-tracker-water';
const WATER_VERSION = 1;

export function serializeWater(p: URLSearchParams): string {
  return JSON.stringify({ version: WATER_VERSION, params: p.toString() });
}

export function loadWater(raw: string | null): LotusState {
  try {
    const saved = JSON.parse(raw ?? 'null');
    if (saved?.version !== WATER_VERSION || typeof saved.params !== 'string') return {};
    return parseLotus(new URLSearchParams(saved.params));
  } catch {
    return {};
  }
}
