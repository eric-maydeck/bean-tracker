import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeById, updateCoffee } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { parseCoffeeForm, CoffeeFormError } from '$lib/server/coffeeFormValidation';

export const load: PageServerLoad = ({ params }) => {
  const db = getDb();
  const coffee = getCoffeeById(db, Number(params.id));
  if (!coffee) {
    error(404, 'Coffee not found');
  }
  return { coffee, roastLevels: getRoastLevels(db) };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const formData = await request.formData();
    try {
      const input = parseCoffeeForm(formData);
      updateCoffee(getDb(), Number(params.id), input);
    } catch (err) {
      if (err instanceof CoffeeFormError) {
        return fail(400, { error: err.message });
      }
      throw err;
    }
    redirect(303, '/manage');
  }
};
