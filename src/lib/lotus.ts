import { pickOne } from '$lib/pageUrlState';

// Lotus drop calculator, copied from Lotus's own (lotuscoffeeproducts.com product-instructions):
// drops = round(ppm x L/4.5 x 0.56), doubled for Na and K, round-tip dropper. Basis and recipes:
// docs/backlog/lotus-800ml-recipes.md.
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

export const CONCENTRATES = [['mg', 'Magnesium'], ['ca', 'Calcium'], ['na', 'Sodium'], ['k', 'Potassium']] as const;

const ROUND_TIP = 0.56;

// Lotus rounding on target ppm as CaCO3 (Ca, Mg as GH; Na, K as KH).
export function dropsFromPpm(ppm: Drops, ml: number): Drops {
  const n = (v: number, f = 1) => Math.round(((v * ml) / 1000 / 4.5) * ROUND_TIP * f);
  return { mg: n(ppm.mg), ca: n(ppm.ca), na: n(ppm.na, 2), k: n(ppm.k, 2) };
}
export const dropsFor = (r: Recipe, ml: number): Drops => dropsFromPpm(r.ppm, ml);

// Basis factors: ion mg/L per ppm as CaCO3 (Na, K per ppm of KH, which is 2 x the drop-count ppm).
const CA = 0.40078, MG = 0.24305, NA = 2 * 0.22989, K = 2 * 0.390983, CL = 2 * 0.35453, HCO3 = 2 * 0.61016;

// A target in mg/L of each ion -> ppm as CaCO3.
export const ppmFromMgl = (m: Drops): Drops => ({ mg: m.mg / MG, ca: m.ca / CA, na: m.na / NA, k: m.k / K });

// Resulting water from whole drops: minerals in mg/L (Cl and HCO3 included), GH and KH as ppm CaCO3.
export function minerals(d: Drops, ml: number) {
  const perDrop = 4.5 / (ROUND_TIP * (ml / 1000));
  const gh = (d.ca + d.mg) * perDrop;
  const kh = ((d.na + d.k) * perDrop) / 2;
  return {
    gh, kh,
    ca: d.ca * perDrop * CA, mg: d.mg * perDrop * MG,
    na: (d.na * perDrop / 2) * NA, k: (d.k * perDrop / 2) * K,
    cl: gh * CL, hco3: kh * HCO3
  };
}

export type Mode = 'recipe' | 'drops' | 'target';
export const MODES: Mode[] = ['recipe', 'drops', 'target'];
export const MODE_LABEL: Record<Mode, string> = { recipe: 'Recipe', drops: 'Drops', target: 'Target' };
export type Unit = 'ppm' | 'mgl';
export interface LotusState { recipe?: string; ml?: number; kettle?: string; mode?: Mode; unit?: Unit; vals?: Partial<Drops> }
const MINERALS = ['mg', 'ca', 'na', 'k'] as const;

// ?mode=drops|target (bare = recipe) &recipe=<slug> (recipe mode) &ml=<n> &kettle=<slug>
// &ca/mg/na/k=<n> (drops: integers; target: decimals) &unit=mgl (target mode; bare = ppm). Explicit choices stay in the URL.
export function parseLotus(p: URLSearchParams): LotusState {
  const mode = pickOne(p, 'mode', ['drops', 'target'] as const);
  const recipe = mode ? undefined : pickOne(p, 'recipe', RECIPES.map((r) => r.slug));
  const kettle = pickOne(p, 'kettle', KETTLES.map((k) => k.slug));
  const raw = p.get('ml') ?? '';
  const ml = /^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML ? +raw : undefined;
  const unit = mode === 'target' ? pickOne(p, 'unit', ['ppm', 'mgl'] as const) : undefined;
  const vals: Partial<Drops> = {};
  for (const m of MINERALS) {
    const v = p.get(m) ?? '';
    if (mode === 'drops' ? /^\d{1,3}$/.test(v) : mode === 'target' && /^\d{1,4}(\.\d+)?$/.test(v)) vals[m] = +v;
  }
  return {
    ...(recipe && { recipe }), ...(ml !== undefined && { ml }), ...(kettle && { kettle }),
    ...(mode && { mode }), ...(unit && { unit }), ...(Object.keys(vals).length && { vals })
  };
}

export function lotusParams(s: LotusState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.mode) p.set('mode', s.mode);
  if (s.recipe) p.set('recipe', s.recipe);
  if (s.ml !== undefined) p.set('ml', String(s.ml));
  if (s.kettle) p.set('kettle', s.kettle);
  if (s.unit) p.set('unit', s.unit);
  for (const m of MINERALS) if (s.vals?.[m] !== undefined) p.set(m, String(s.vals[m]));
  return p;
}
