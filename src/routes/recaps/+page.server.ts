import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { hasRecaps } from '$lib/server/recaps/recap';

// The Recaps tab is the one recaps page: /recaps goes there (nothing else rides along). With no recap to show: 404.
export const load: PageServerLoad = ({ locals }) => {
  if (!hasRecaps(getDb(), localToday(), !!locals.isAdmin)) error(404, 'Not found');
  redirect(307, '/insights?tab=recaps');
};
