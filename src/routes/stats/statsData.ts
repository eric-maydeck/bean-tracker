import type { CoffeeRow, RoastLevelRow } from '$lib/types';
import { parseDate, diffDays, withComputedFields } from '$lib/server/urgency';
import { localDate } from '$lib/localDate';

export interface BreakdownEntry {
  label: string;
  grams: number;
  count: number;
}

export interface BagHighlight {
  coffeeName: string;
  roaster: string;
  roastDate: string;
  daysOld: number;
  slug: string;
}

export interface BacklogStats {
  openedGrams: number;
  unopenedBacklogGrams: number;
  totalBacklogGrams: number;
  finishedGrams: number;
  openedCount: number;
  unopenedBacklogCount: number;
  totalBacklogCount: number;
  finishedCount: number;

  totalCost: number;
  totalSpentAllTime: number;
  distinctRoasterCount: number;
  oldestUnopenedBag: BagHighlight | null;
  youngestUnopenedBag: BagHighlight | null;
  averageBagSizeGrams: number | null;
  averageAgeBacklogAndOpen: number | null;
  averageDaysToOpen: number | null;
  averageDaysToFinish: number | null;
  // Backlog + open, over bags with a recorded cost.
  averageBagCost: number | null;
  freshness: Freshness;

  // Keyed by a '+'-joined status combo (see statusComboKey) — every
  // non-empty combination of the three statuses is precomputed so the page
  // can toggle any mix without re-querying.
  breakdowns: Record<string, Breakdowns>;
}

// Open + backlog bags by where they sit in their rest window. Frozen bags
// (no thaw date yet) are only counted as frozen, and bags missing a roast
// date or rest days are counted nowhere.
export interface Freshness {
  readyCount: number;
  // Ready bags with an urgency rating of at least DRINK_SOON_URGENCY.
  drinkSoonCount: number;
  restingCount: number;
  nextReadyInDays: number | null;
  frozenCount: number;
  frozenGrams: number;
}

const DRINK_SOON_URGENCY = 40;

function buildFreshness(rows: CoffeeRow[], today: Date): Freshness {
  const freshness: Freshness = {
    readyCount: 0,
    drinkSoonCount: 0,
    restingCount: 0,
    nextReadyInDays: null,
    frozenCount: 0,
    frozenGrams: 0
  };
  for (const row of rows) {
    if (isValidDateString(row.frozen_start_date) && !row.frozen_end_date) {
      freshness.frozenCount += 1;
      freshness.frozenGrams += row.amount_g ?? 0;
      continue;
    }
    if (!isValidDateString(row.roast_date) || row.rest_days_low == null || row.rest_days_high == null) continue;
    const computed = withComputedFields(row, today);
    const daysUntilReady = diffDays(parseDate(computed.drink_after!), today);
    if (daysUntilReady <= 0) {
      freshness.readyCount += 1;
      if (typeof computed.urgency_rating === 'number' && computed.urgency_rating >= DRINK_SOON_URGENCY) {
        freshness.drinkSoonCount += 1;
      }
    } else {
      freshness.restingCount += 1;
      freshness.nextReadyInDays = Math.min(freshness.nextReadyInDays ?? Infinity, daysUntilReady);
    }
  }
  return freshness;
}

export interface Breakdowns {
  roaster: BreakdownEntry[];
  origin: BreakdownEntry[];
  processing: BreakdownEntry[];
  roastLevel: BreakdownEntry[];
  caffeine: BreakdownEntry[];
}

export const BREAKDOWN_STATUSES = ['backlog', 'open', 'archived'] as const;
export type BreakdownStatus = (typeof BREAKDOWN_STATUSES)[number];

// Canonical order regardless of selection order, so any given mix maps to
// exactly one key.
export function statusComboKey(selected: Iterable<BreakdownStatus>): string {
  const set = new Set(selected);
  return BREAKDOWN_STATUSES.filter((s) => set.has(s)).join('+');
}

function sumGrams(rows: CoffeeRow[]): number {
  return rows.reduce((total, r) => total + (r.amount_g ?? 0), 0);
}

function buildBreakdown(rows: CoffeeRow[], keyFn: (row: CoffeeRow) => string): BreakdownEntry[] {
  const groups = new Map<string, { grams: number; count: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = groups.get(key) ?? { grams: 0, count: 0 };
    existing.grams += row.amount_g ?? 0;
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.entries())
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.grams - a.grams);
}

function buildCaffeineBreakdown(rows: CoffeeRow[]): BreakdownEntry[] {
  const caffeinated = { label: 'Caffeinated', grams: 0, count: 0 };
  const decaf = { label: 'Decaf', grams: 0, count: 0 };
  for (const row of rows) {
    const bucket = row.decaf === 1 ? decaf : caffeinated;
    bucket.grams += row.amount_g ?? 0;
    bucket.count += 1;
  }
  return [caffeinated, decaf];
}

function sumCost(rows: CoffeeRow[]): number {
  return rows.filter((r) => r.cost != null).reduce((total, r) => total + (r.cost as number), 0);
}

// A non-null date string isn't necessarily a *parseable* one (an empty
// string, or a value in some other format than this app's own YYYY-MM-DD,
// would slip past a plain `!= null` check and silently produce NaN day
// counts downstream). Every date used for day-math below is filtered
// through this first.
function isValidDateString(value: string | null): value is string {
  return value != null && Number.isFinite(parseDate(value).getTime());
}

function averageDaysBetween(
  rows: CoffeeRow[],
  startDate: (row: CoffeeRow) => string | null,
  endDate: (row: CoffeeRow) => string | null
): number | null {
  const diffs: number[] = [];
  for (const row of rows) {
    // opened_date / moved_date are UTC instants (or imported dates): count them on the local date.
    const s = startDate(row), e = endDate(row);
    const start = s && localDate(s), end = e && localDate(e);
    if (isValidDateString(start) && isValidDateString(end)) {
      diffs.push(diffDays(parseDate(end), parseDate(start)));
    }
  }
  if (diffs.length === 0) return null;
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

export function buildBacklogStats(
  openRows: CoffeeRow[],
  backlogRows: CoffeeRow[],
  archivedRows: CoffeeRow[],
  roastLevels: RoastLevelRow[],
  today: Date
): BacklogStats {
  const allRows = [...openRows, ...backlogRows];
  const everyRow = [...allRows, ...archivedRows];

  const openedGrams = sumGrams(openRows);
  const unopenedBacklogGrams = sumGrams(backlogRows);
  const totalBacklogGrams = openedGrams + unopenedBacklogGrams;
  const finishedGrams = sumGrams(archivedRows);
  const openedCount = openRows.length;
  const unopenedBacklogCount = backlogRows.length;
  const totalBacklogCount = openedCount + unopenedBacklogCount;
  const finishedCount = archivedRows.length;

  const totalCost = sumCost(allRows);
  const pricedCount = allRows.filter((r) => r.cost != null).length;
  const averageBagCost = pricedCount > 0 ? totalCost / pricedCount : null;
  const totalSpentAllTime = sumCost(everyRow);

  const averageDaysToOpen = averageDaysBetween(
    everyRow,
    (r) => r.roast_date,
    (r) => r.opened_date
  );
  const averageDaysToFinish = averageDaysBetween(
    archivedRows,
    (r) => r.opened_date,
    (r) => r.moved_date
  );

  const distinctRoasterCount = new Set(allRows.map((r) => r.roaster)).size;

  const backlogWithRoastDate = backlogRows.filter(
    (r): r is CoffeeRow & { roast_date: string } => isValidDateString(r.roast_date)
  );
  const toBagHighlight = (row: CoffeeRow & { roast_date: string }): BagHighlight => ({
    coffeeName: row.coffee_name,
    roaster: row.roaster,
    roastDate: row.roast_date,
    daysOld: diffDays(today, parseDate(row.roast_date)),
    slug: row.slug
  });
  const oldestUnopenedBag =
    backlogWithRoastDate.length > 0
      ? toBagHighlight(
          backlogWithRoastDate.reduce((a, b) => (parseDate(a.roast_date) < parseDate(b.roast_date) ? a : b))
        )
      : null;
  const youngestUnopenedBag =
    backlogWithRoastDate.length > 0
      ? toBagHighlight(
          backlogWithRoastDate.reduce((a, b) => (parseDate(a.roast_date) > parseDate(b.roast_date) ? a : b))
        )
      : null;

  const bagsWithWeight = allRows.filter((r) => r.amount_g != null);
  const averageBagSizeGrams = bagsWithWeight.length > 0 ? sumGrams(bagsWithWeight) / bagsWithWeight.length : null;

  const rowsWithRoastDate = allRows.filter(
    (r): r is CoffeeRow & { roast_date: string } => isValidDateString(r.roast_date)
  );
  const averageAgeBacklogAndOpen =
    rowsWithRoastDate.length > 0
      ? rowsWithRoastDate.reduce((total, r) => total + diffDays(today, parseDate(r.roast_date)), 0) /
        rowsWithRoastDate.length
      : null;

  const roastOrder = new Map(roastLevels.map((r) => [r.roast_level, r.degrees_of_roast]));
  const buildBreakdowns = (rows: CoffeeRow[]): Breakdowns => ({
    roaster: buildBreakdown(rows, (r) => r.roaster),
    origin: buildBreakdown(rows, (r) => r.origin ?? 'Unknown'),
    processing: buildBreakdown(rows, (r) => r.processing ?? 'Unknown'),
    roastLevel: buildBreakdown(rows, (r) => r.roast_level ?? 'Unknown').sort(
      (a, b) => (roastOrder.get(a.label) ?? Infinity) - (roastOrder.get(b.label) ?? Infinity)
    ),
    caffeine: buildCaffeineBreakdown(rows)
  });
  const rowsByStatus: Record<BreakdownStatus, CoffeeRow[]> = {
    backlog: backlogRows,
    open: openRows,
    archived: archivedRows
  };
  const breakdowns: Record<string, Breakdowns> = {};
  // Every non-empty subset of the 3 statuses (7 combos), via bitmask.
  for (let mask = 1; mask < 1 << BREAKDOWN_STATUSES.length; mask++) {
    const combo = BREAKDOWN_STATUSES.filter((_, i) => mask & (1 << i));
    breakdowns[statusComboKey(combo)] = buildBreakdowns(combo.flatMap((s) => rowsByStatus[s]));
  }

  return {
    openedGrams,
    unopenedBacklogGrams,
    totalBacklogGrams,
    finishedGrams,
    openedCount,
    unopenedBacklogCount,
    totalBacklogCount,
    finishedCount,
    totalCost,
    totalSpentAllTime,
    distinctRoasterCount,
    oldestUnopenedBag,
    youngestUnopenedBag,
    averageBagSizeGrams,
    averageAgeBacklogAndOpen,
    averageDaysToOpen,
    averageDaysToFinish,
    averageBagCost,
    freshness: buildFreshness(allRows, today),
    breakdowns
  };
}
