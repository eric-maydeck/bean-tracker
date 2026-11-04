import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { parseRecapUrl, parseYear } from '$lib/recapsUrl';
import { recap } from '$lib/server/recaps/recap';

// Public for opened years (a year opens Jan 1 after it); the current year only as an admin's ?preview=1.
export const load: PageServerLoad = ({ params, url, locals }) => {
  const year = parseYear(params.year);
  if (year === null) error(404, 'Not found');
  const db = getDb();
  const today = localToday();
  const state = parseRecapUrl(url.searchParams);
  const preview = !!(state.preview && locals.isAdmin && year === Number(today.slice(0, 4)));
  if (!preview && today < `${year + 1}-01-01`) error(404, 'Not found'); // a year without brews 404s below (recap is null)
  const r = recap(db, year, { today, preview });
  if (!r) error(404, 'Not found');
  return { recap: r, state, isAdmin: locals.isAdmin };
};
