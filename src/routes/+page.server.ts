import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The coffee list lives at /coffees (shareable); keep old links working.
export const load: PageServerLoad = ({ url }) => {
  redirect(301, `/coffees${url.search}`);
};
