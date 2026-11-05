import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Insights became /stats; keep old links (and their query) working. The hash is the browser's.
export const load: PageServerLoad = ({ url }) => {
  redirect(301, `/stats${url.search}`);
};
