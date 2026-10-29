import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { addMark, marksFor, biasLine } from '$lib/server/brewNow/outcome';
import { getRoasterWebsite } from '$lib/server/roasterWebsites';
import { getDb } from '$lib/server/db';
import { getRedirectSlug } from '$lib/server/coffees';
import { localToday } from '$lib/server/localToday';
import { loadBrewRows, loadGearClass, gearOptions, gearDefaults, coffeeDetails } from '$lib/server/brewNow/load';
import { suggest, similarCoffees, tierOf } from '$lib/server/brewNow/suggest';
import { findRoasterRecipe, getRoasterRecipe } from '$lib/server/brewNow/roasterRecipe';
import { getBrewDoses } from '$lib/server/brewNow/prefs';
import { parseBrewNowView } from './brewNowUrl';

// The chosen gear and its suggestion, from the view params only: the page and ?/brewThis both derive them here.
function derive(db: ReturnType<typeof getDb>, coffee: NonNullable<ReturnType<typeof coffeeDetails>>, url: URL, today: string) {
  const rows = loadBrewRows(db);
  const options = gearOptions(rows, today);
  const view = parseBrewNowView(url, options);
  const defaults = gearDefaults(rows, view.dripper); // its filter is the chosen dripper's own most used
  const gear = { grinder: view.grinder ?? defaults.grinder, dripper: view.dripper ?? defaults.dripper, filter: view.filter ?? defaults.filter };
  const gc = loadGearClass(db);
  const sug = suggest(coffee, rows, gear, gc, getBrewDoses(db), today);
  return { rows, options, defaults, view, gear, gc, sug };
}

// The roaster's own site as a bare host (what the search was restricted to), or null when none is on file.
function roasterHost(db: ReturnType<typeof getDb>, roaster: string): string | null {
  const site = getRoasterWebsite(db, roaster);
  try { return site ? new URL(site).hostname : null; } catch { return null; }
}

export const load: PageServerLoad = ({ params, url, setHeaders, locals }) => {
  const db = getDb();
  const today = localToday();
  const coffee = coffeeDetails(db, params.slug, today);
  if (!coffee) {
    const current = getRedirectSlug(db, params.slug);
    if (current) {
      setHeaders({ 'cache-control': 'no-store' }); // as the coffee page: a cached 301 would loop after a rename back
      redirect(301, `/coffees/${current}/brew${url.search}`);
    }
    error(404, 'Coffee not found');
  }
  const { rows, options, defaults, view, gear, gc, sug } = derive(db, coffee, url, today);
  const marks = marksFor(db, coffee.id);
  const roaster = coffee.roaster.trim().toLowerCase();
  const mine = rows.filter((r) => tierOf(coffee, r) === 1).reverse(); // rows are oldest first
  // R9: brew notes are private; strip them server-side for anyone not signed in.
  const strip = <T extends { notes: string | null }>(b: T): T => (locals.isAdmin ? b : { ...b, notes: null });
  return {
    coffee, gear, defaults, options, why: view.why,
    suggestion: locals.isAdmin ? sug : { ...sug, lastNote: null, rows: sug.rows.map((r) => ({ ...r, evidence: r.evidence.map(strip) })) },
    thisCoffee: [...mine.filter((r) => r.best), ...mine.filter((r) => !r.best)].map(strip), // Best brew pinned
    similar: similarCoffees(coffee, rows, gear, gc),
    roasterRecipe: getRoasterRecipe(db, coffee.roaster),
    neverBrewedRoaster: !rows.some((r) => r.roaster.trim().toLowerCase() === roaster),
    roasterHost: roasterHost(db, coffee.roaster),
    marks, bias: biasLine(marks), // no notes: safe for anyone
    isAdmin: locals.isAdmin
  };
};

export const actions: Actions = {
  // Never trusts posted values: only the gear params are read, the suggestion is re-derived here.
  brewThis: async ({ params, request, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = coffeeDetails(db, params.slug, localToday());
    if (!coffee) error(404, 'Coffee not found');
    const f = await request.formData();
    const url = new URL('http://x/');
    for (const k of ['grinder', 'dripper', 'filter']) { const v = f.get(k); if (typeof v === 'string' && v) url.searchParams.set(k, v); }
    const { gear, sug } = derive(db, coffee, url, localToday());
    addMark(db, { coffeeId: coffee.id, gear, suggestion: sug, now: new Date() });
    return { marked: true as const };
  },
  findRecipe: async ({ params, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = coffeeDetails(db, params.slug, localToday());
    if (!coffee) error(404, 'Coffee not found');
    const r = await findRoasterRecipe(db, coffee.roaster, new Date());
    return 'error' in r ? fail(503, { recipeError: r.error }) : { found: true as const };
  }
};
