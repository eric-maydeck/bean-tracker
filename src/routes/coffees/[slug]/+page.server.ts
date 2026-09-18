import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeBySlug } from '$lib/server/coffees';
import { withComputedFields } from '$lib/server/urgency';

export const load: PageServerLoad = ({ params }) => {
  const db = getDb();
  const coffee = getCoffeeBySlug(db, params.slug);
  if (!coffee) {
    error(404, 'Coffee not found');
  }
  return { coffee: withComputedFields(coffee, new Date()) };
};
