import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getBacklogCoffees, getOpenCoffees, getArchivedCoffees, getDistinctFieldValues } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeCreate } from '$lib/server/coffeeFormActions';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const backlog = getBacklogCoffees(db).map((c) => withComputedFields(c, today));
  const open = getOpenCoffees(db).map((c) => withComputedFields(c, today));
  const archive = getArchivedCoffees(db).map((c) => withComputedFields(c, today));
  const roastLevels = getRoastLevels(db);
  return {
    backlog,
    open,
    archive,
    roastLevels,
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    return handleCoffeeCreate(getDb(), await request.formData());
  }
};
