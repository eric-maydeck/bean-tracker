import type { PageServerLoad } from './$types';
import { getDb, getHouseholdSize } from '$lib/server/db';
import { loadFacts } from '$lib/server/insights/facts';
import {
  localToday, periodBounds, previousPeriod, comparePeriod, compareFits, trackedDays, daysBetween, byFits, inPeriod, yearsSince, type Period
} from '$lib/server/insights/time';
import { RATINGS_SETTLED_FROM, roastMix } from '$lib/server/insights/ratings';
import { overviewTiles, compareTiles, perPerson, consumption, gramsOnHand, loggedGrams, tileDelta, rightNow, paceDelta, recent, TILE_KIND } from '$lib/server/insights/overview';
import { cutBoards, hiddenRows, leaderboards, pageFilters } from '$lib/server/insights/leaderboards';
import { habits } from '$lib/server/insights/habits';
import { consumptionTab } from '$lib/server/insights/consumption';
import { recordsTab } from '$lib/server/insights/records';
import { milestonesTab } from '$lib/server/insights/milestones';
import { dialInIds, onceDialed } from '$lib/server/insights/dialed';
import { insightsTab } from '$lib/server/insights/insightGenerators';
import { labOptions, matchesBrew, matchesCoffee, ratedIn, sweetSpotsTab, brewingTab, waterTab, gearTab } from '$lib/server/insights/lab';
import { RANGES, BYS, BREWER_TYPES, LAB_TABS, EXACT_PARAM, parseInsightsUrl, withDefaults, compareOptions, isCustom, ratingsMenuOn, activeBrewFilters } from '$lib/insightsUrl';

// Public, like /stats.
// Everything is computed from the URL, so toggles just navigate (goto).
export const load: PageServerLoad = ({ url }) => {
  const db = getDb();
  const { brews: everyBrew, bags: everyBag } = loadFacts(db);
  const householdSize = getHouseholdSize(db);
  const today = localToday();
  const dataStart = everyBrew[0]?.localDate ?? null;
  const years = yearsSince(dataStart, today);
  const brewYears = [...new Set(everyBrew.map((b) => Number(b.localDate.slice(0, 4))))];
  const fits = compareFits(dataStart, today);
  const fitsBy = byFits(dataStart, today);
  const brewerTypes = BREWER_TYPES.filter((t) => everyBrew.some((b) => b.brewerType === t));
  // The lab's picker values come from the data. Parsed with them on every tab (O(n)), so a non-lab tab
  // keeps the lab picks in `explicit` and switching back restores them.
  const opts = labOptions(everyBrew, everyBag);
  const explicit = parseInsightsUrl(url.searchParams, years, brewYears, fits, householdSize, fitsBy, today, brewerTypes, {
    bags: opts.bags.map((b) => b.slug), roasts: opts.roasts, processes: opts.processes, origins: opts.origins, roasters: opts.roasters,
    grinders: opts.grinders.map((g) => g.slug),
    drippers: opts.drippers, filters: opts.filters, waters: opts.waters, doses: opts.doses, temps: opts.temps
  });
  const s = withDefaults(explicit);
  const lab = (LAB_TABS as readonly string[]).includes(s.tab) ? opts : null;
  const grinder = lab ? (lab.grinders.find((g) => g.slug === s.grinder) ?? lab.grinders[0])?.name ?? null : null;
  const period = periodBounds(s.range, today);
  // Once dialed (dialed.ts): rating views get the brews with each bag's dial-in ratings nulled; positions are
  // over the whole history, so this runs before any Period. Dial-in views, Milestones and counts use `brews`.
  const dialIn = dialInIds(everyBrew);
  // The Coffees filter (spec Part 3): brews and bags filtered once, before every tab loader (compare windows
  // too, since they read the same arrays). Picker options above come from the unfiltered data. Caffeine:
  // Decaf keeps only decaf; the default nulls decaf brews' ratings (like onceDialed) so rating views skip
  // them while counts, grams and cost keep them; All filters nothing.
  const coffees = { roast: s.roast, process: s.process, origin: s.origin, roaster: s.roaster };
  const matches = matchesCoffee(coffees);
  const pool = s.caffeine === 'decaf' ? everyBrew.filter((b) => b.decaf)
    : s.caffeine === 'all' ? everyBrew : everyBrew.map((b) => (b.decaf ? { ...b, rating: null } : b));
  // The brew filters (spec 2026-10-21) narrow brews after the coffee filters and after `dialIn`, so a brew keeps its
  // whole-bag position. `whole` is what whole-bag figures read (on hand, time to clear, Net, What-if, settle).
  const bf = activeBrewFilters(s);
  const whole = pool.filter(matches);
  const brews = whole.filter(matchesBrew(bf));
  const bags = everyBag.filter((b) => (s.caffeine !== 'decaf' || b.decaf) && matches(b));
  const scored = s.dial === 'all' ? brews : onceDialed(brews, dialIn);
  const wholeScored = s.dial === 'all' ? whole : onceDialed(whole, dialIn); // records' whole-bag figures
  const labCtx = { period, ratings: s.ratings };
  const size = s.people === 'person' ? householdSize : 1;
  // The parser already dropped a compare this range doesn't offer.
  const prev = comparePeriod(s.range, period, s.compare, dataStart, today);
  // Leaderboards only on its tab; the overview tiles are cheap and always computed.
  const boards = s.tab === 'leaderboards' ? leaderboards(scored, bags, period, prev, s.rank, s.ratings, explicit.avg, size) : null;
  const h = boards && ratingsMenuOn(s) ? hiddenRows(boards, scored, brews, bags, period, s.rank, s.ratings) : null;
  const rated = (xs: typeof brews, r: typeof s.ratings) => ratedIn(xs, period, r).length;
  const tiles = perPerson(overviewTiles(scored, bags, period, s.ratings, today, dataStart), size);
  const days = (w: Period) => trackedDays(w, dataStart, today);
  // Same-length compares (a number) pace only when a window is partly tracked: calendar-month
  // windows differ by a day or two, which isn't worth a "vs … at that pace" on every total.
  const untracked = (w: Period) => days(w) < daysBetween(w.start!, w.end) + 1;
  const pace = typeof s.compare !== 'number' || (!!prev && (untracked(period) || untracked(prev)));
  const cmp = prev && compareTiles(
    tiles, perPerson(overviewTiles(scored, bags, prev, s.ratings, prev.end, dataStart), size), days(period), days(prev), pace
  );
  const now = rightNow(bags, whole, period, size);
  const nowPrev = prev && rightNow(bags, whole, prev, size);
  const ctx = { period, prev, size, dataStart, today, pace };
  // Measured from household grams (consumption divides by `size` itself).
  const onHand = gramsOnHand(bags, whole);
  // Time to clear is about the bags: the unfiltered rate; the per day/week/month rates narrow.
  const { daysToClear, clearBy } = consumption(whole, period, dataStart, today, onHand, size);
  const use = { ...consumption(brews, period, dataStart, today, onHand, size), daysToClear, clearBy };
  const usePrev = prev && consumption(brews, prev, dataStart, today, onHand, size);
  // Insights compare against the Compare window, else the previous period (null for all time).
  const before = prev ?? previousPeriod(s.range, period);
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
    // What applied on this tab, and the pickers' values (from the unfiltered data, every tab).
    brewFilters: bf,
    brewOptions: { drippers: opts.drippers, filters: opts.filters, waters: opts.waters, doses: opts.doses, temps: opts.temps },
    coffeeFilters: pageFilters({ ...coffees, caffeine: s.caffeine }, everyBag),
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
    boards,
    boardsCut: h ? h.cut : boards ? cutBoards(boards, scored, bags, period, s.rank, s.ratings, explicit.avg) : [],
    habits: s.tab === 'habits' ? habits(scored, { ...ctx, measure: s.measure, ratings: s.ratings, agg: s.agg }) : null,
    consumptionTab:
      s.tab === 'consumption'
        ? consumptionTab(brews, bags, { ...ctx, whole, unit: s.unit, agg: s.agg, by: s.by, sameLength: typeof s.compare === 'number' })
        : null,
    records: s.tab === 'records' ? recordsTab(scored, bags, { unscored: brews, wholeUnscored: whole, whole: wholeScored, period, prev, ratings: s.ratings, brewer: s.brewer, size, today }) : null,
    milestones:
      s.tab === 'milestones' ? milestonesTab(brews, bags, { period, prev, ratings: s.ratings, kinds: s.kinds, today }) : null,
    insights:
      s.tab === 'insights'
        ? insightsTab(
            {
              brews: scored.filter((b) => inPeriod(b.localDate, period)),
              allBrews: brews.filter((b) => inPeriod(b.localDate, period)),
              wholeBrews: whole.filter((b) => inPeriod(b.localDate, period)),
              brewFilters: bf,
              dialIn,
              bags,
              prevBrews: before && scored.filter((b) => inPeriod(b.localDate, before)),
              ratings: s.ratings,
              today,
              householdSize,
              onHandG: onHand,
              logged: loggedGrams(whole),
              period: { from: period.start ?? dataStart ?? today, to: period.end },
              dataStart: dataStart ?? today
            },
            s.theme
          )
        : null,
    // The mixed-roast nudge, where the Ratings menu shows (a Roast filter leaves one level: null).
    // The See all note, where the Ratings menu shows: what avg=raw, ratings=all, dial=all would add on this tab.
    // brews: in-period rated brews the Ratings/Brews settings leave out (decaf's nulled ratings aren't counted).
    hidden: ratingsMenuOn(s)
      ? {
          rows: h?.rows ?? {}, rowsBy: h?.by ?? {},
          brews: rated(brews, 'all') - rated(scored, s.ratings),
          // Which setting actually hid them: Calibrated (ratings) first, then Once dialed.
          why: [rated(brews, 'all') > rated(brews, s.ratings) && 'ratings', rated(brews, s.ratings) > rated(scored, s.ratings) && 'dial'].filter(Boolean) as ('ratings' | 'dial')[]
        }
      : null,
    roastMix: ratingsMenuOn(s) && s.rank !== 'like' ? roastMix(scored.filter((b) => inPeriod(b.localDate, period)), s.ratings) : null,
    lab,
    coffeeOptions: { roasts: opts.roasts, processes: opts.processes, origins: opts.origins, roasters: opts.roasters },
    grinder,
    sweetSpots: s.tab === 'sweetspots'
      ? sweetSpotsTab(scored, bags, { ...labCtx, grinder, filters: coffees, all: s.dial === 'all' ? pool : onceDialed(pool, dialIn) })
      : null,
    brewing: s.tab === 'brewing'
      ? brewingTab(scored, { ...labCtx, all: brews, whole, brewFilters: bf, grinder, exact: Object.fromEntries(Object.entries(EXACT_PARAM).map(([v, k]) => [v, s[k] === 'exact'])),
          by: { temp: s.tempBy, ratio: s.ratioBy, dose: s.doseBy, time: s.timeBy, bloom: s.bloomBy, grind: s.grindBy } })
      : null,
    water: s.tab === 'water' ? waterTab(scored, bags, labCtx) : null,
    gear: s.tab === 'gear' ? gearTab(scored, labCtx) : null,
    recent: s.tab === 'overview' ? recent(brews, bags, 50) : null,
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
