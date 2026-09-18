import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getBacklogCoffees, getOpenCoffees, getArchivedCoffees } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const backlog = getBacklogCoffees(db).map((c) => withComputedFields(c, today));
  const open = getOpenCoffees(db).map((c) => withComputedFields(c, today));
  const archive = getArchivedCoffees(db).map((c) => withComputedFields(c, today));
  const roastLevels = getRoastLevels(db);
  return { backlog, open, archive, roastLevels };
};
