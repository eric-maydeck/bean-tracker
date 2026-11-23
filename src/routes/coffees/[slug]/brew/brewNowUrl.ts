import { pickOne } from '#lib/pageUrlState.ts';
import type { Gear, Setting } from '#lib/server/brewNow/suggest.ts'; // types only: this runs client-side

// /coffees/[slug]/brew view state: gear pickers (null = the default gear), the dose / ratio override (null = the
// suggestion) and which row's evidence is open.
export interface BrewNowView { grinder: string | null; dripper: string | null; filter: string | null; why: Setting | null; dose?: number | null; ratio?: number | null; recipe?: string | null; from?: 'recipe' | null; amounts?: 'pour' | null }
export type BrewNowDefaults = Gear & { dose?: number | null; ratio?: number | null; recipe?: string | null };

const SETTINGS: Setting[] = ['grind', 'temp', 'dose', 'ratio', 'recipe', 'water'];

// Gear lists include the "other" entries; dose / ratio must be one of the user's saved values.
export function parseBrewNowView(url: URL, opts: { grinders: string[]; drippers: string[]; filters: string[]; doses?: number[]; ratios?: number[]; recipes?: string[] }): BrewNowView {
  const p = url.searchParams;
  const num = (k: string, list: number[] = []) => { const v = p.get(k); return v !== null && list.includes(Number(v)) ? Number(v) : null; };
  const recipe = pickOne(p, 'recipe', opts.recipes ?? []);
  const from = pickOne(p, 'from', ['recipe'] as const);
  const amounts = pickOne(p, 'amounts', ['pour'] as const);
  return {
    grinder: pickOne(p, 'grinder', opts.grinders) ?? null,
    dripper: pickOne(p, 'dripper', opts.drippers) ?? null,
    filter: pickOne(p, 'filter', opts.filters) ?? null,
    why: pickOne(p, 'why', SETTINGS) ?? null,
    dose: num('dose', opts.doses), ratio: num('ratio', opts.ratios),
    ...(recipe && { recipe }), ...(from && { from }), ...(amounts && { amounts }), // absent = null, keeps older callers' views equal
  };
}

// '' when everything is default.
export function brewNowParams(view: BrewNowView, defaults: BrewNowDefaults): string {
  const p = new URLSearchParams();
  for (const k of ['grinder', 'dripper', 'filter'] as const) if (view[k] && view[k] !== defaults[k]) p.set(k, view[k]);
  for (const k of ['dose', 'ratio'] as const) if (view[k] != null && view[k] !== defaults[k]) p.set(k, String(view[k]));
  if (view.recipe && view.recipe !== defaults.recipe) p.set('recipe', view.recipe);
  if (view.from) p.set('from', view.from);
  if (view.amounts) p.set('amounts', view.amounts);
  if (view.why) p.set('why', view.why);
  return p.toString();
}
