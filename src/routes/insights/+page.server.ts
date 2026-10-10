import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import { localToday, periodBounds, previousPeriod, yearsSince } from '$lib/server/insights/time';
import { overviewTiles, compareTiles } from '$lib/server/insights/overview';
import { parseInsightsUrl, withDefaults } from '$lib/insightsUrl';

// Public, like /stats; not in the nav until /insights replaces /stats.
// Everything is computed from the URL, so toggles just navigate (goto).
export const load: PageServerLoad = ({ url }) => {
  const { brews, bags } = loadFacts(getDb());
  const today = localToday();
  const years = yearsSince(brews[0]?.localDate ?? null, today);
  const explicit = parseInsightsUrl(url.searchParams, years);
  const s = withDefaults(explicit);
  const period = periodBounds(s.range, today);
  const prev = s.compare ? previousPeriod(s.range, period) : null;
  const tiles = overviewTiles(brews, bags, period, s.ratings);
  return {
    explicit,
    years,
    period,
    previousPeriod: prev,
    tiles,
    deltas: prev ? compareTiles(tiles, overviewTiles(brews, bags, prev, s.ratings)) : null
  };
};
