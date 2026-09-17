import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getActiveCoffees, getFinishedCoffees } from '$lib/server/coffees';
import { withComputedFields } from '$lib/server/urgency';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const active = getActiveCoffees(db).map((c) => withComputedFields(c, today));
  const finished = getFinishedCoffees(db).map((c) => withComputedFields(c, today));
  return { active, finished };
};
