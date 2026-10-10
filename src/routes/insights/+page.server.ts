import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import { localToday, periodBounds, previousPeriod, yearsSince } from '$lib/server/insights/time';
import { RATINGS_SETTLED_FROM } from '$lib/server/insights/ratings';
import { overviewTiles, compareTiles, TILE_KIND } from '$lib/server/insights/overview';
import { parseInsightsUrl, withDefaults, compareOptions } from '$lib/insightsUrl';

// Public, like /stats; not in the nav until /insights replaces /stats.
// Everything is computed from the URL, so toggles just navigate (goto).
export const load: PageServerLoad = ({ url }) => {
  const { brews, bags } = loadFacts(getDb());
  const today = localToday();
  const years = yearsSince(brews[0]?.localDate ?? null, today);
  const brewYears = [...new Set(brews.map((b) => Number(b.localDate.slice(0, 4))))];
  const explicit = parseInsightsUrl(url.searchParams, years, brewYears);
  const s = withDefaults(explicit);
  const period = periodBounds(s.range, today);
  // The parser already dropped a compare deeper than this range allows.
  const prev = s.compare ? previousPeriod(s.range, period, s.compare) : null;
  const dataStart = brews[0]?.localDate ?? null;
  const tiles = overviewTiles(brews, bags, period, s.ratings, today, dataStart);
  return {
    explicit,
    years,
    brewYears,
    compareOptions: compareOptions(s.range, years, brewYears),
    tileKinds: TILE_KIND,
    settledFrom: RATINGS_SETTLED_FROM,
    period,
    previousPeriod: prev,
    tiles,
    deltas: prev ? compareTiles(tiles, overviewTiles(brews, bags, prev, s.ratings, prev.end, dataStart)) : null
  };
};
