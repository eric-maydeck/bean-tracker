import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeBySlug, getDistinctFieldValues, getFillHistory, getRedirectSlug } from '$lib/server/coffees';
import { getRoasterImages } from '$lib/server/roasterImages';
import { getRoastLevels } from '$lib/server/roastLevels';
import { withComputedFields } from '$lib/server/urgency';
import { requireAdmin } from '$lib/server/auth';
import { handleCoffeeCreate } from '$lib/server/coffeeFormActions';
import { queueFillMissing } from '$lib/server/imageFills';
import { getLinkedBean, unlinkBeanConquerorBean } from '$lib/server/beanConquerorLinks';

export const load: PageServerLoad = ({ params, setHeaders, locals }) => {
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
    processingMethods: getDistinctFieldValues(db, 'processing'),
    roasterImages: getRoasterImages(db),
    beanConqueror: getLinkedBean(db, coffee.id),
    restHistory: locals.isAdmin ? getFillHistory(db) : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const result = handleCoffeeCreate(db, await request.formData());
    void queueFillMissing(db); // a new image → its backdrop fill, in the background
    return result;
  },
  unlinkBeanConqueror: async ({ params, locals }) => {
    requireAdmin(locals);
    const db = getDb();
    const coffee = getCoffeeBySlug(db, params.slug);
    if (!coffee || !unlinkBeanConquerorBean(db, coffee.id)) {
      return fail(400, { unlinkError: 'This coffee has no Bean Conqueror bean to unlink' });
    }
    return { success: true as const };
  }
};
