import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getCoffeeById } from '$lib/server/coffees';
import { withComputedFields } from '$lib/server/urgency';

export const load: PageServerLoad = ({ params }) => {
  const db = getDb();
  const coffee = getCoffeeById(db, Number(params.id));
  if (!coffee) {
    error(404, 'Coffee not found');
  }
  return { coffee: withComputedFields(coffee, new Date()) };
};
