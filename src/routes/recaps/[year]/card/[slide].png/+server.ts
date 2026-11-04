import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, getHouseholdSize } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { loadFacts } from '$lib/server/insights/facts';
import { parseRecapUrl, parseYear, recapYears, POSTER_ID } from '$lib/recapsUrl';
import { recap } from '$lib/server/recaps/recap';
import { cachedCard, cardPng, cardSvg } from '$lib/server/recaps/card';
import { THEME_VERSION } from '$lib/server/recaps/select';
import { dataStamp } from '$lib/server/recaps/year';

// Same availability as the page; never freezes a year's ids.
export const GET: RequestHandler = async ({ params, url, locals }) => {
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
  const people = state.people ?? 'household';
  const r = recap(db, year, { today, preview, people: state.people, freeze: false });
  if (!r) error(404, 'Not found');
  const s = r.slides.find((x) => x.id === params.slide);
  const total = r.slides.find((x) => x.id === 'total');
  const card = params.slide === 'cover' ? { big: r.cover.title, label: `${total?.big ?? r.slides.length} brews`, tone: r.cover.tone, cover: true as const }
    : params.slide === POSTER_ID ? { big: r.poster.title, label: `${r.slides.length} things your brewing said`, tone: r.cover.tone }
    : s ? { ...s.card, tone: s.tone ?? r.cover.tone } : null;
  if (!card) error(404, 'Not found');
  const png = await cachedCard({ year, slide: params.slide, people, stamp: `${dataStamp(db)}-t${THEME_VERSION}${preview ? 'p' : ''}` },
    async () => cardPng(await cardSvg({ ...card, year })));
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
};
