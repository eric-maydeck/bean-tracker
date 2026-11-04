import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getHouseholdSize, setHouseholdSize, InvalidHouseholdSizeError } from '$lib/server/db';
import { getArchivedCoffees, getBacklogCoffees, getOpenCoffees } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import { loadFacts } from '$lib/server/insights/facts';
import { periodBounds, yearsSince } from '$lib/server/insights/time';
import { localToday } from '$lib/server/localToday';
import { consumption, gramsOnHand } from '$lib/server/insights/overview';
import { RANGES } from '$lib/insightsUrl';
import { buildBacklogStats } from './statsData';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const day = localToday(); // one clock read for both forms
  const today = new Date(`${day}T00:00:00Z`);
  const openRows = getOpenCoffees(db);
  const backlogRows = getBacklogCoffees(db);
  const archivedRows = getArchivedCoffees(db);
  const roastLevels = getRoastLevels(db);
  const stats = buildBacklogStats(openRows, backlogRows, archivedRows, roastLevels, today);
  // Temporary (until Ocean of statistics fills /insights out): the Time to Clear panel's
  // measured rates for every Period and both people modes; the page picks by URL.
  const { brews, bags } = loadFacts(db);
  const dataStart = brews[0]?.localDate ?? null;
  const years = yearsSince(dataStart, day);
  const householdSize = getHouseholdSize(db);
  const onHand = gramsOnHand(bags, brews);
  const use = (r: string, size: number) => consumption(brews, periodBounds(r, day), dataStart, day, onHand, size);
  const consumptionByRange = Object.fromEntries(
    [...RANGES, ...years.map(String)].map((r) => [r, { household: use(r, 1), person: use(r, householdSize) }])
  );
  const lastImportedRow = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'beanconqueror_last_imported_at'`)
    .get() as { value: string } | undefined;
  return {
    stats,
    householdSize,
    onHand,
    years,
    consumption: consumptionByRange,
    beanConquerorLastImportedAt: lastImportedRow?.value ?? null,
    beanConquerorStats: buildBeanConquerorStats(db, day)
  };
};

export const actions: Actions = {
  updateHouseholdSize: async ({ request, locals }) => {
    requireAdmin(locals);
    const n = Number((await request.formData()).get('householdSize'));
    try {
      setHouseholdSize(getDb(), n);
    } catch (err) {
      if (err instanceof InvalidHouseholdSizeError) {
        return fail(400, { error: 'Household size must be a whole number from 1 to 20' });
      }
      throw err;
    }
    return { success: true };
  }
};
