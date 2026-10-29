import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { addMark, deleteMark, marksFor, biasLine } from '$lib/server/brewNow/outcome';
import { getRoasterWebsite } from '$lib/server/roasterWebsites';
import { getDb } from '$lib/server/db';
import { getRedirectSlug, getCoffeeBySlug, openCoffee, unopenCoffee } from '$lib/server/coffees';
import { coffeeImage } from '$lib/coffeeImage';
import { localToday } from '$lib/server/localToday';
import { loadBrewRows, loadGearClass, gearOptions, coffeeGearDefaults, coffeeDetails } from '$lib/server/brewNow/load';
import { suggest, similarCoffees, thisCoffeeSummary, tierOf } from '$lib/server/brewNow/suggest';
import { findRoasterRecipe, getRoasterRecipe } from '$lib/server/brewNow/roasterRecipe';
import { getBrewDoses, getBrewRatios } from '$lib/server/brewNow/prefs';
import { parseBrewNowView } from './brewNowUrl';

// The chosen gear and its suggestion, from the view params only: the page and ?/brewThis both derive them here.
function derive(db: ReturnType<typeof getDb>, coffee: NonNullable<ReturnType<typeof coffeeDetails>>, url: URL, today: string) {
  const rows = loadBrewRows(db);
  const base = gearOptions(rows, today);
  const doses = getBrewDoses(db), ratios = getBrewRatios(db).ratios;
  // The "other" drippers / filters are valid picks too (E6); dose and ratio must be on the user's lists (R19).
  const view = parseBrewNowView(url, { grinders: base.grinders, drippers: [...base.drippers, ...base.otherDrippers],
    filters: [...base.filters, ...base.otherFilters], doses, ratios });
  // E8: this coffee's own most used gear first; the filter is the chosen dripper's own most used.
  const gearDefaults = coffeeGearDefaults(rows, rows.filter((r) => tierOf(coffee, r) === 1), view.dripper);
  // E9: the filter lists follow the dripper.
  const { filters, otherFilters } = gearOptions(rows, today, view.dripper ?? gearDefaults.dripper);
  const options = { ...base, filters, otherFilters, doses, ratios };
  const gear = { grinder: view.grinder ?? gearDefaults.grinder, dripper: view.dripper ?? gearDefaults.dripper, filter: view.filter ?? gearDefaults.filter };
  const gc = loadGearClass(db);
  const sug = suggest(coffee, rows, gear, gc, doses, today, ratios, { dose: view.dose ?? null, ratio: view.ratio ?? null });
  const defaults = { ...gearDefaults, dose: sug.suggestedDose, ratio: sug.suggestedRatio }; // what the URL omits
  return { rows, options, defaults, view, gear, gc, sug };
}

// The roaster's own site as a bare host (what the search was restricted to), or null when none is on file.
const bareHost = (u: string | null): string | null => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : null; } catch { return null; } }; // www.x.com = x.com
function roasterHost(db: ReturnType<typeof getDb>, roaster: string): string | null {
  return bareHost(getRoasterWebsite(db, roaster));
}

// The stored recipe link's host (null if it can't be parsed) and whether it is the roaster's own site.
function recipeHost(db: ReturnType<typeof getDb>, roaster: string) {
  const rr = getRoasterRecipe(db, roaster), host = bareHost(rr?.url ?? null), own = roasterHost(db, roaster);
  return { recipeHost: host, recipeOwn: !!host && !!own && (host === own || host.endsWith('.' + own)) };
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
    image: coffeeImage(getCoffeeBySlug(db, params.slug)!, ''),
    coffee, gear, defaults, options, why: view.why,
    suggestion: locals.isAdmin ? sug : { ...sug, lastNote: null, rows: sug.rows.map((r) => ({ ...r, evidence: r.evidence.map(strip) })) },
    thisCoffee: [...mine.filter((r) => r.best), ...mine.filter((r) => !r.best)].map(strip), // Best brew pinned
    thisCoffeeSummary: thisCoffeeSummary(coffee, rows, gear, locals.isAdmin), // notes only for the admin (R9)
    similar: similarCoffees(coffee, rows, gear, gc),
    roasterRecipe: getRoasterRecipe(db, coffee.roaster),
    neverBrewedRoaster: !rows.some((r) => r.roaster.trim().toLowerCase() === roaster),
    roasterHost: roasterHost(db, coffee.roaster),
    ...recipeHost(db, coffee.roaster),
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
    for (const k of ['grinder', 'dripper', 'filter', 'dose', 'ratio']) { const v = f.get(k); if (typeof v === 'string' && v) url.searchParams.set(k, v); }
    const { gear, sug } = derive(db, coffee, url, localToday());
    addMark(db, { coffeeId: coffee.id, gear, suggestion: sug, now: new Date() });
    const { id } = db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }; // the page's Undo deletes this mark
    return { marked: true as const, markId: id };
  },
  // Cancels a pending mark (admin).
  deleteMark: async ({ request, locals }) => {
    requireAdmin(locals);
    const id = Number((await request.formData()).get('id'));
    if (!Number.isInteger(id) || !deleteMark(getDb(), id)) return fail(400, { markError: 'Only a pending mark can be cancelled' });
    return { deleted: true as const };
  },
  // Opens a backlog coffee (the same server logic as On Deck / the coffee page); the page asks first, then calls brewThis.
  openCoffee: async ({ params, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = coffeeDetails(db, params.slug, localToday());
    if (!coffee) error(404, 'Coffee not found');
    if (coffee.status === 'archive') return fail(400, { openError: 'This coffee is archived' });
    openCoffee(db, coffee.id);
    return { opened: true as const };
  },
  // The Undo of "marked as open" (an open coffee goes back to the backlog).
  unopenCoffee: async ({ params, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = coffeeDetails(db, params.slug, localToday());
    if (!coffee) error(404, 'Coffee not found');
    unopenCoffee(db, coffee.id);
    return { unopened: true as const };
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
