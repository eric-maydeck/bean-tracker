import { getSubscriptionOptions } from '#lib/server/subscriptions.ts';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '#lib/server/db.ts';
import { localTodayDate } from '#lib/server/localToday.ts';
import { getBacklogCoffees, getOpenCoffees, getArchivedCoffees, getDistinctFieldValues } from '#lib/server/coffees.ts';
import { getRoasterImages } from '#lib/server/roasterImages.ts';
import { getRoastLevels } from '#lib/server/roastLevels.ts';
import { withComputedFields } from '#lib/server/urgency.ts';
import { requireAdmin } from '#lib/server/auth.ts';
import { handleCoffeeCreate } from '#lib/server/coffeeFormActions.ts';
import { queueFillMissing } from '#lib/server/imageFills.ts';

export const load: PageServerLoad = ({ locals }) => {
  const db = getDb();
  const today = localTodayDate();
  const backlog = getBacklogCoffees(db).map((c) => withComputedFields(c, today));
  const open = getOpenCoffees(db).map((c) => withComputedFields(c, today));
  const archive = getArchivedCoffees(db).map((c) => withComputedFields(c, today));
  const roastLevels = getRoastLevels(db);
  return {
    backlog,
    open,
    archive,
    roastLevels,
    subscriptions: locals.isAdmin ? getSubscriptionOptions(db) : [],
    plans: getSubscriptionOptions(db).map(({ id, label }) => ({ id, label })), // public: the Subscription filter
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing'),
    roasterImages: getRoasterImages(db)
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const result = handleCoffeeCreate(db, await request.formData());
    void queueFillMissing(db); // a new image → its backdrop fill, in the background
    return result;
  }
};
