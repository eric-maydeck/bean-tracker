import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { recapTiles } from '$lib/server/recaps/recap';

// Public for opened years; an admin also sees the current year as a preview tile. Nothing to show = 404.
export const load: PageServerLoad = ({ locals }) => {
  const tiles = recapTiles(getDb(), localToday(), !!locals.isAdmin);
  if (!tiles.length) error(404, 'Not found');
  return { tiles };
};
