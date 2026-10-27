import { getSubscriptionOptions } from '$lib/server/subscriptions';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb, getHouseholdSize, setHouseholdSize, InvalidHouseholdSizeError } from '$lib/server/db';
import { getArchivedCoffees, getBacklogCoffees, getDistinctFieldValues, getFillHistory, getOpenCoffees } from '$lib/server/coffees';
import { getRoasterImages } from '$lib/server/roasterImages';
import { getRoastLevels } from '$lib/server/roastLevels';
import { requireAdmin } from '$lib/server/auth';
import {
  getUnmatchedBeanConquerorBeans,
  countUnmatchedBeanConquerorBeans,
  dismissBeanConquerorBean
} from '$lib/server/beanconqueror';
import { handleCoffeeCreateAndLink } from '$lib/server/coffeeFormActions';
import { queueFillMissing } from '$lib/server/imageFills';
import { linkBeanConquerorBean, getLinkableCoffees, BeanLinkError } from '$lib/server/beanConquerorLinks';
import { loadFacts } from '$lib/server/insights/facts';
import { periodBounds, yearsSince } from '$lib/server/insights/time';
import { localToday } from '$lib/server/localToday';
import { consumption, gramsOnHand } from '$lib/server/insights/overview';
import { RANGES } from '$lib/insightsUrl';
import { buildBacklogStats } from './statsData';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

// Matches the "Showing top N of M" treatment the beanConqueror charts use:
// a real export can have a couple hundred unmatched beans, and rendering
// every one buries the rest of the page.
const UNMATCHED_BEAN_LIMIT = 20;

export const load: PageServerLoad = ({ locals }) => {
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
    beanConquerorStats: buildBeanConquerorStats(db, day),
    unmatchedBeans: {
      beans: getUnmatchedBeanConquerorBeans(db, UNMATCHED_BEAN_LIMIT),
      total: countUnmatchedBeanConquerorBeans(db)
    },
    linkableCoffees: locals.isAdmin ? getLinkableCoffees(db) : [],
    roastLevels,
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing'),
    roasterImages: getRoasterImages(db),
    restHistory: locals.isAdmin ? getFillHistory(db) : [],
    subscriptions: locals.isAdmin ? getSubscriptionOptions(db) : []
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
  },
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    // The Create modal from "Not yet tracked" sends beanconqueror_id: link it too.
    const db = getDb();
    const result = handleCoffeeCreateAndLink(db, await request.formData());
    void queueFillMissing(db); // a new image → its backdrop fill, in the background
    return result;
  },
  linkBeanConqueror: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const beanId = formData.get('beanId');
    const coffeeId = Number(formData.get('coffeeId'));
    if (typeof beanId !== 'string' || !beanId) {
      return fail(400, { error: 'Missing bean id' });
    }
    if (!Number.isInteger(coffeeId) || coffeeId <= 0) {
      return fail(400, { error: 'Choose a coffee to link' });
    }
    try {
      linkBeanConquerorBean(getDb(), beanId, coffeeId);
    } catch (err) {
      if (err instanceof BeanLinkError) return fail(400, { error: err.message });
      throw err;
    }
    return { success: true as const };
  },
  dismissBeanConqueror: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return fail(400, { error: 'Missing bean id' });
    }
    dismissBeanConquerorBean(getDb(), id);
    return { success: true as const };
  }
};
