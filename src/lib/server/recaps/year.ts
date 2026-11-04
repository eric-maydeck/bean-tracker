import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getHouseholdSize } from '$lib/server/db';
import { getGearDetails } from '$lib/server/gearDetails';
import type { Recipe } from '$lib/recipes';
import { dialInIds, onceDialed } from '$lib/server/insights/dialed';
import { loadFacts, type BagFact, type BrewFact } from '$lib/server/insights/facts';
import type { GenCtx } from '$lib/server/insights/insightGenerators';
import { gramsOnHand, loggedGrams } from '$lib/server/insights/overview';
import { loadPourFacts, type PourFact } from '$lib/server/insights/pours';
import { inPeriod, type Period } from '$lib/server/insights/time';
import { gearArchive, trophyCase, type Trophy } from '$lib/server/insights/trophies';

export interface YearCtx {
  year: number; period: Period; today: string; preview: boolean;
  everyBrew: readonly BrewFact[]; bags: readonly BagFact[];
  brews: readonly BrewFact[]; // localDate in the year, every brew, decaf included, ratings as stored
  scored: readonly BrewFact[]; // onceDialed(brews, dialInIds(everyBrew)); use with countsForRating(b, 'current')
  prevBrews: readonly BrewFact[]; // the calendar year before
  pours: { facts: ReadonlyMap<number, PourFact>; recipes: Recipe[] };
  trophies: Trophy[];
  size: number; // getHouseholdSize(db)
  db: DatabaseSync;
}

// null = no brews in the year. A preview (the open year, admin only) ends today.
export function loadYear(db: DatabaseSync, year: number, today: string, preview: boolean): YearCtx | null {
  const { brews: everyBrew, bags } = loadFacts(db);
  const period: Period = { start: `${year}-01-01`, end: preview ? today : `${year}-12-31` };
  const brews = everyBrew.filter((b) => inPeriod(b.localDate, period));
  if (!brews.length) return null;
  const scored = onceDialed(brews, dialInIds(everyBrew));
  return {
    year, period, today, preview, everyBrew, bags, brews, scored,
    prevBrews: everyBrew.filter((b) => b.localDate.startsWith(`${year - 1}-`)),
    pours: loadPourFacts(db, everyBrew),
    trophies: trophyCase(everyBrew, gearArchive(db), today, { period, ratings: 'current', scored }, getGearDetails(db)),
    size: getHouseholdSize(db), db
  };
}

// Mirrors /insights' insightsTab context (no filters): brews = scored, allBrews = every rating, wholeBrews = y.brews (in-period, every rating, before once-dialed; no brew filters here).
// Dial-in generators want {...ctx, brews: ctx.allBrews} (as insightsTab does).
export function toGenCtx(y: YearCtx): GenCtx {
  return {
    brews: y.scored, allBrews: y.brews, wholeBrews: y.brews, brewFilters: {},
    dialIn: dialInIds(y.everyBrew), bags: y.bags, prevBrews: onceDialed(y.prevBrews, dialInIds(y.everyBrew)), ratings: 'current', today: y.today,
    householdSize: y.size, onHandG: gramsOnHand(y.bags, y.everyBrew), logged: loggedGrams(y.everyBrew),
    period: { from: y.period.start!, to: y.period.end }, dataStart: y.everyBrew[0].localDate,
    pours: undefined
  };
}

// Part 3's cache key: changes on a brew import, a coffee/gear/recipe/pour edit or a household size change.
export function dataStamp(db: DatabaseSync): string {
  const one = (sql: string) => JSON.stringify(db.prepare(sql).get());
  const parts = [
    one(`SELECT COUNT(*) n, MAX(imported_at) m FROM beanconqueror_brews`),
    one(`SELECT MAX(updated_at) m FROM coffees`),
    one(`SELECT MAX(updated_at) m FROM gear_details`),
    one(`SELECT MAX(updated_at) m FROM recipes`),
    one(`SELECT COUNT(*) n, MAX(read_at) m FROM brew_pour_readings`),
    getHouseholdSize(db)
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10);
}
