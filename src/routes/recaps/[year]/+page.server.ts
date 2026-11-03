import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb, getHouseholdSize } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { loadFacts } from '$lib/server/insights/facts';
import { parseRecapUrl, parseYear, recapYears } from '$lib/recapsUrl';
import { recap } from '$lib/server/recaps/recap';

// Public for opened years (a year opens Jan 1 after it); the current year only as an admin's ?preview=1.
export const load: PageServerLoad = ({ params, url, locals }) => {
  const year = parseYear(params.year);
  if (year === null) error(404, 'Not found');
  const db = getDb();
  const today = localToday();
  const state = parseRecapUrl(url.searchParams, getHouseholdSize(db));
  const preview = !!(state.preview && locals.isAdmin && year === Number(today.slice(0, 4)));
  if (!preview) {
    const brewYears = loadFacts(db).brews.map((b) => Number(b.localDate.slice(0, 4)));
    if (!recapYears(brewYears, today).includes(year)) error(404, 'Not found');
  }
  const r = recap(db, year, { today, preview, people: state.people });
  if (!r) error(404, 'Not found');
  return { recap: r, state, isAdmin: locals.isAdmin };
};
