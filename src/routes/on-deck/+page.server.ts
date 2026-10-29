import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { localTodayDate } from '$lib/server/localToday';
import { getOpenCoffees, getBacklogCoffees, openCoffee } from '$lib/server/coffees';
import { buildOnDeckData } from './onDeckData';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = localTodayDate();
  return buildOnDeckData(getOpenCoffees(db), getBacklogCoffees(db), today);
};

export const actions: Actions = {
  // Mark a backlog coffee open (same openCoffee as the Coffees page's Open action).
  open: async ({ request, locals }) => {
    requireAdmin(locals);
    const id = Number((await request.formData()).get('id'));
    if (Number.isInteger(id)) openCoffee(getDb(), id);
    return { opened: true as const };
  }
};
