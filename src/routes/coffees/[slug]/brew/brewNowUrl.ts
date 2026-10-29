import { pickOne } from '$lib/pageUrlState';
import type { Gear, Setting } from '$lib/server/brewNow/suggest'; // types only: this runs client-side

// /coffees/[slug]/brew view state: gear pickers (null = the default gear) and which row's evidence is open.
export interface BrewNowView { grinder: string | null; dripper: string | null; filter: string | null; why: Setting | null }

const SETTINGS: Setting[] = ['grind', 'temp', 'dose', 'recipe', 'water'];

export function parseBrewNowView(url: URL, opts: { grinders: string[]; drippers: string[]; filters: string[] }): BrewNowView {
  const p = url.searchParams;
  return {
    grinder: pickOne(p, 'grinder', opts.grinders) ?? null,
    dripper: pickOne(p, 'dripper', opts.drippers) ?? null,
    filter: pickOne(p, 'filter', opts.filters) ?? null,
    why: pickOne(p, 'why', SETTINGS) ?? null,
  };
}

// '' when everything is default.
export function brewNowParams(view: BrewNowView, defaults: Gear): string {
  const p = new URLSearchParams();
  for (const k of ['grinder', 'dripper', 'filter'] as const) if (view[k] && view[k] !== defaults[k]) p.set(k, view[k]);
  if (view.why) p.set('why', view.why);
  return p.toString();
}
