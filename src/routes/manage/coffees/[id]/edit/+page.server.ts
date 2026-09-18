import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeById, updateCoffee, deleteCoffee, getDistinctFieldValues } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { parseCoffeeForm, parseSlugField, CoffeeFormError } from '$lib/server/coffeeFormValidation';
import { slugify, slugExists } from '$lib/server/slug';

export const load: PageServerLoad = ({ params }) => {
  const db = getDb();
  const coffee = getCoffeeById(db, Number(params.id));
  if (!coffee) {
    error(404, 'Coffee not found');
  }
  return {
    coffee,
    roastLevels: getRoastLevels(db),
    roasters: getDistinctFieldValues(db, 'roaster'),
    origins: getDistinctFieldValues(db, 'origin'),
    processingMethods: getDistinctFieldValues(db, 'processing')
  };
};

export const actions: Actions = {
  delete: async ({ params }) => {
    deleteCoffee(getDb(), Number(params.id));
    redirect(303, '/manage');
  },
  save: async ({ request, params }) => {
    const formData = await request.formData();
    const id = Number(params.id);
    try {
      const input = parseCoffeeForm(formData);
      const rawSlug = parseSlugField(formData);
      if (!rawSlug) {
        return fail(400, { error: 'URL slug is required' });
      }
      const slug = slugify(rawSlug);
      if (!slug) {
        return fail(400, { error: 'URL slug must contain at least one letter or number' });
      }
      if (slugExists(getDb(), slug, id)) {
        return fail(400, { error: 'That URL is already in use by another coffee' });
      }
      updateCoffee(getDb(), id, input, slug);
    } catch (err) {
      if (err instanceof CoffeeFormError) {
        return fail(400, { error: err.message });
      }
      throw err;
    }
    redirect(303, '/manage');
  }
};
