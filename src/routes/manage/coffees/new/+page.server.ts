import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { createCoffee, getDistinctFieldValues } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { parseCoffeeForm, CoffeeFormError } from '$lib/server/coffeeFormValidation';

export const load: PageServerLoad = () => {
  const db = getDb();
  return {
    roastLevels: getRoastLevels(db),
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    let slug: string;
    try {
      const input = parseCoffeeForm(formData);
      ({ slug } = createCoffee(getDb(), input));
    } catch (err) {
      if (err instanceof CoffeeFormError) {
        return fail(400, { error: err.message });
      }
      throw err;
    }
    // Redirect to the new coffee itself, rather than back to Manage, so the
    // save is visibly confirmed instead of looking like it did nothing.
    redirect(303, `/coffees/${slug}`);
  }
};
