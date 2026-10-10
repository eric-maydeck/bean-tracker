import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import {
  localToday, periodBounds, previousPeriod, comparePeriod, compareFits, trackedDays, yearsSince, type Period
} from '$lib/server/insights/time';
import { RATINGS_SETTLED_FROM } from '$lib/server/insights/ratings';
import { overviewTiles, compareTiles, TILE_KIND } from '$lib/server/insights/overview';
import { RANGES, parseInsightsUrl, withDefaults, compareOptions } from '$lib/insightsUrl';

// Public, like /stats; not in the nav until /insights replaces /stats.
// Everything is computed from the URL, so toggles just navigate (goto).
export const load: PageServerLoad = ({ url }) => {
  const { brews, bags } = loadFacts(getDb());
  const today = localToday();
  const dataStart = brews[0]?.localDate ?? null;
  const years = yearsSince(dataStart, today);
  const brewYears = [...new Set(brews.map((b) => Number(b.localDate.slice(0, 4))))];
  const fits = compareFits(dataStart, today);
  const explicit = parseInsightsUrl(url.searchParams, years, brewYears, fits);
  const s = withDefaults(explicit);
  const period = periodBounds(s.range, today);
  // The parser already dropped a compare this range doesn't offer.
  const prev = comparePeriod(s.range, period, s.compare, dataStart, today);
  const tiles = overviewTiles(brews, bags, period, s.ratings, today, dataStart);
  const days = (w: Period) => trackedDays(w, dataStart, today);
  const cmp = prev && compareTiles(tiles, overviewTiles(brews, bags, prev, s.ratings, prev.end, dataStart), days(period), days(prev));
  // Custom range… opens on the same-length window before the period when it's tracked,
  // else everything before it, else first brew → today (all time, or nothing earlier).
  const customDefault =
    [previousPeriod(s.range, period), comparePeriod(s.range, period, 'before', dataStart, today)].find(
      (w) => w && dataStart && w.start! >= dataStart
    ) ?? { start: dataStart ?? today, end: today };
  return {
    explicit,
    years,
    // Every range's menu, so a Period change can keep or drop the compare (keepCompare).
    compareMenus: Object.fromEntries(
      [...RANGES, ...years.map(String)].map((r) => [r, compareOptions(r, years, brewYears, fits)])
    ),
    tileKinds: TILE_KIND,
    settledFrom: RATINGS_SETTLED_FROM,
    dataStart,
    today,
    customDefault,
    period,
    previousPeriod: prev,
    tiles,
    deltas: cmp ? cmp.deltas : null,
    scaled: cmp ? cmp.scaled : false
  };
};
