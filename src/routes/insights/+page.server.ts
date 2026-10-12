import type { PageServerLoad } from './$types';
import { getDb, getHouseholdSize } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import {
  localToday, periodBounds, previousPeriod, comparePeriod, compareFits, trackedDays, daysBetween, byFits, yearsSince, type Period
} from '$lib/server/insights/time';
import { RATINGS_SETTLED_FROM } from '$lib/server/insights/ratings';
import { overviewTiles, compareTiles, perPerson, consumption, gramsOnHand, tileDelta, rightNow, paceDelta, TILE_KIND } from '$lib/server/insights/overview';
import { leaderboards } from '$lib/server/insights/leaderboards';
import { habits } from '$lib/server/insights/habits';
import { consumptionTab } from '$lib/server/insights/consumption';
import { recordsTab } from '$lib/server/insights/records';
import { milestonesTab } from '$lib/server/insights/milestones';
import { RANGES, BYS, BREWER_TYPES, parseInsightsUrl, withDefaults, compareOptions, isCustom } from '$lib/insightsUrl';

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
  const fitsBy = byFits(dataStart, today);
  const brewerTypes = BREWER_TYPES.filter((t) => brews.some((b) => b.brewerType === t));
  const explicit = parseInsightsUrl(url.searchParams, years, brewYears, fits, householdSize, fitsBy, today, brewerTypes);
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
  const now = rightNow(bags, brews, period, size);
  const nowPrev = prev && rightNow(bags, brews, prev, size);
  const ctx = { period, prev, size, dataStart, today, pace };
  // Measured from household grams (consumption divides by `size` itself).
  const onHand = gramsOnHand(bags, brews);
  const use = consumption(brews, period, dataStart, today, onHand, size);
  const usePrev = prev && consumption(brews, prev, dataStart, today, onHand, size);
  // Custom range… opens on the same-length window before the period when it's tracked,
  // else everything before it, else first brew → today (all time, or nothing earlier).
  const customDefault =
    [previousPeriod(s.range, period), comparePeriod(s.range, period, 'before', dataStart, today)].find(
      (w) => w && dataStart && w.start! >= dataStart
    ) ?? { start: dataStart ?? today, end: today };
  // A custom Period has its own menus (the preset ones don't cover it).
  const menuRanges = [...RANGES, ...years.map(String), ...(isCustom(s.range) ? [s.range] : [])];
  return {
    explicit,
    householdSize,
    years,
    // Every range's menu, so a Period change can keep or drop the compare (keepCompare).
    compareMenus: Object.fromEntries(
      menuRanges.map((r) => [r, compareOptions(r, years, brewYears, fits)])
    ),
    tileKinds: TILE_KIND,
    settledFrom: RATINGS_SETTLED_FROM,
    dataStart,
    today,
    customDefault,
    // Period › Custom range… opens on the current period (a future calendar-year end clamps to today).
    periodDefault: { start: period.start ?? dataStart ?? today, end: period.end < today ? period.end : today },
    period,
    previousPeriod: prev,
    byMenus: Object.fromEntries(menuRanges.map((r) => [r, BYS.filter((b) => fitsBy(r, b))])),
    // Leaderboards only on its tab; the overview tiles are cheap and always computed.
    boards: s.tab === 'leaderboards' ? leaderboards(brews, bags, period, prev, s.rank, s.ratings, s.avg, size) : null,
    habits: s.tab === 'habits' ? habits(brews, { ...ctx, measure: s.measure, ratings: s.ratings, agg: s.agg }) : null,
    consumptionTab:
      s.tab === 'consumption'
        ? consumptionTab(brews, bags, { ...ctx, unit: s.unit, agg: s.agg, by: s.by, sameLength: typeof s.compare === 'number' })
        : null,
    records: s.tab === 'records' ? recordsTab(brews, bags, { period, prev, ratings: s.ratings, brewer: s.brewer, size, today }) : null,
    milestones:
      s.tab === 'milestones' ? milestonesTab(brews, bags, { period, prev, ratings: s.ratings, kinds: s.kinds, today }) : null,
    brewerTypes,
    rightNow: now,
    rightNowDeltas: nowPrev && {
      finished: paceDelta(now.finished, nowPrev.finished, days(period), days(prev!), pace),
      finishedG: paceDelta(now.finishedG, nowPrev.finishedG, days(period), days(prev!), pace)
    },
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
