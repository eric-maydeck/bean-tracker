import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getFinishedCoffees, restoreCoffee } from '$lib/server/coffees';
import { withComputedFields } from '$lib/server/urgency';

export const load: PageServerLoad = () => {
  const db = getDb();
  const today = new Date();
  const coffees = getFinishedCoffees(db)
    .map((c) => withComputedFields(c, today))
    .sort((a, b) => (b.moved_date ?? '').localeCompare(a.moved_date ?? ''));
  return { coffees };
};

export const actions: Actions = {
  restore: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    restoreCoffee(getDb(), id);
    return { success: true };
  }
};
