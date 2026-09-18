import { error, redirect, isActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeBySlug, deleteCoffee, getDistinctFieldValues } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeSave } from '$lib/server/coffeeFormActions';

export const load: PageServerLoad = ({ params }) => {
  const db = getDb();
  const coffee = getCoffeeBySlug(db, params.slug);
  if (!coffee) {
    error(404, 'Coffee not found');
  }
  return {
    coffee: withComputedFields(coffee, new Date()),
    roastLevels: getRoastLevels(db),
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

export const actions: Actions = {
  save: async ({ request, locals, params }) => {
    requireAdmin(locals);
    const db = getDb();
    const formData = await request.formData();
    const result = await handleCoffeeSave(db, formData);
    if (isActionFailure(result)) return result;
    if (result.slug !== params.slug) {
      redirect(303, `/coffees/${result.slug}`);
    }
    return result;
  },
  delete: async ({ request, locals }) => {
    requireAdmin(locals);
    const formData = await request.formData();
    deleteCoffee(getDb(), Number(formData.get('id')));
    redirect(303, '/');
  }
};
