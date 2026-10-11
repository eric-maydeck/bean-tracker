import type { PageServerLoad } from './$types';
import { getDb, getHouseholdSize } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import {
  localToday, periodBounds, previousPeriod, comparePeriod, compareFits, trackedDays, daysBetween, yearsSince, type Period
} from '$lib/server/insights/time';
import { RATINGS_SETTLED_FROM } from '$lib/server/insights/ratings';
import { overviewTiles, compareTiles, perPerson, consumption, gramsOnHand, tileDelta, TILE_KIND } from '$lib/server/insights/overview';
import { RANGES, parseInsightsUrl, withDefaults, compareOptions } from '$lib/insightsUrl';

// Public, like /stats.
// Everything is computed from the URL, so toggles just navigate (goto).
export const load: PageServerLoad = ({ url }) => {
  const db = getDb();
  const { brews, bags } = loadFacts(db);
  const householdSize = getHouseholdSize(db);
  const today = localToday();
  const dataStart = brews[0]?.localDate ?? null;
  const years = yearsSince(dataStart, today);
  const brewYears = [...new Set(brews.map((b) => Number(b.localDate.slice(0, 4))))];
  const fits = compareFits(dataStart, today);
  const explicit = parseInsightsUrl(url.searchParams, years, brewYears, fits, householdSize);
  const s = withDefaults(explicit);
  const size = s.people === 'person' ? householdSize : 1;
  const period = periodBounds(s.range, today);
  // The parser already dropped a compare this range doesn't offer.
  const prev = comparePeriod(s.range, period, s.compare, dataStart, today);
  const tiles = perPerson(overviewTiles(brews, bags, period, s.ratings, today, dataStart), size);
  const days = (w: Period) => trackedDays(w, dataStart, today);
  // Same-length compares (a number) pace only when a window is partly tracked: calendar-month
  // windows differ by a day or two, which isn't worth a "vs … at that pace" on every total.
  const untracked = (w: Period) => days(w) < daysBetween(w.start!, w.end) + 1;
  const pace = typeof s.compare !== 'number' || (!!prev && (untracked(period) || untracked(prev)));
  const cmp = prev && compareTiles(
    tiles, perPerson(overviewTiles(brews, bags, prev, s.ratings, prev.end, dataStart), size), days(period), days(prev), pace
  );
  // Measured from household grams (consumption divides by `size` itself).
  const onHand = gramsOnHand(bags);
  const use = consumption(brews, period, dataStart, today, onHand, size);
  const usePrev = prev && consumption(brews, prev, dataStart, today, onHand, size);
  // Custom range… opens on the same-length window before the period when it's tracked,
  // else everything before it, else first brew → today (all time, or nothing earlier).
  const customDefault =
    [previousPeriod(s.range, period), comparePeriod(s.range, period, 'before', dataStart, today)].find(
      (w) => w && dataStart && w.start! >= dataStart
    ) ?? { start: dataStart ?? today, end: today };
  return {
    explicit,
    householdSize,
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
    scaled: cmp ? cmp.scaled : false,
    consumption: use,
    consumptionDeltas: usePrev && {
      perDay: tileDelta(use.perDay, usePrev.perDay),
      perWeek: tileDelta(use.perWeek, usePrev.perWeek),
      perMonth: tileDelta(use.perMonth, usePrev.perMonth)
    }
  };
};
