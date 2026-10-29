import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getRedirectSlug } from '$lib/server/coffees';
import { localToday } from '$lib/server/localToday';
import { loadBrewRows, loadGearClass, gearOptions, gearDefaults, coffeeDetails } from '$lib/server/brewNow/load';
import { suggest, similarCoffees, tierOf } from '$lib/server/brewNow/suggest';
import { getBrewDoses } from '$lib/server/brewNow/prefs';
import { parseBrewNowView } from './brewNowUrl';

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
  const rows = loadBrewRows(db);
  const options = gearOptions(rows, today);
  const defaults = gearDefaults(rows);
  const view = parseBrewNowView(url, options);
  const gear = { grinder: view.grinder ?? defaults.grinder, dripper: view.dripper ?? defaults.dripper, filter: view.filter ?? defaults.filter };
  const gc = loadGearClass(db);
  const roaster = coffee.roaster.trim().toLowerCase();
  const mine = rows.filter((r) => tierOf(coffee, r) === 1).reverse(); // rows are oldest first
  return {
    coffee, gear, defaults, options, why: view.why,
    suggestion: suggest(coffee, rows, gear, gc, getBrewDoses(db), today),
    thisCoffee: [...mine.filter((r) => r.best), ...mine.filter((r) => !r.best)], // Best brew pinned
    similar: similarCoffees(coffee, rows, gear, gc),
    roasterRecipe: null as null, // Task 7
    neverBrewedRoaster: !rows.some((r) => r.roaster.trim().toLowerCase() === roaster),
    marks: [] as never[], // Task 6
    isAdmin: locals.isAdmin
  };
};
