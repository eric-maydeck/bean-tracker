import { getSubscriptionOptions } from '$lib/server/subscriptions';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localTodayDate } from '$lib/server/localToday';
import { getBacklogCoffees, getOpenCoffees, getArchivedCoffees, getDistinctFieldValues } from '$lib/server/coffees';
import { getRoasterImages } from '$lib/server/roasterImages';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeCreate } from '$lib/server/coffeeFormActions';
import { queueFillMissing } from '$lib/server/imageFills';

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
