import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeBySlug, getDistinctFieldValues, getRedirectSlug } from '$lib/server/coffees';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeCreate } from '$lib/server/coffeeFormActions';

export const load: PageServerLoad = ({ params, setHeaders }) => {
  const db = getDb();
  const coffee = getCoffeeBySlug(db, params.slug);
  if (!coffee) {
    const current = getRedirectSlug(db, params.slug);
    if (current) {
      // no-store: a browser-cached 301 would loop if the coffee is later
      // renamed back to this slug (renaming back is allowed).
      setHeaders({ 'cache-control': 'no-store' });
      redirect(301, `/coffees/${current}`);
    }
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
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    return handleCoffeeCreate(getDb(), await request.formData());
  }
};
