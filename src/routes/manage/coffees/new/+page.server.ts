import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { parseCoffeeForm, CoffeeFormError } from '$lib/server/coffeeFormValidation';

export const load: PageServerLoad = () => {
  return { roastLevels: getRoastLevels(getDb()) };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    try {
      const input = parseCoffeeForm(formData);
      createCoffee(getDb(), input);
    } catch (err) {
      if (err instanceof CoffeeFormError) {
        return fail(400, { error: err.message });
      }
      throw err;
    }
    redirect(303, '/manage');
  }
};
