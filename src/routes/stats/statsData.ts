import type { CoffeeRow, RoastLevelRow } from '$lib/types';
import type { StatsRates } from '$lib/server/db';
import { parseDate, addDays, diffDays, formatDate } from '$lib/server/urgency';

export interface BreakdownEntry {
  label: string;
  grams: number;
  count: number;
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

  daysToClearSelf: number | null;
  clearByDateSelf: string | null;
  daysToClearHousehold: number | null;
  clearByDateHousehold: string | null;

  totalCost: number;
  totalSpentAllTime: number;
  distinctRoasterCount: number;
  oldestUnopenedBag: { coffeeName: string; roaster: string; roastDate: string; daysOld: number } | null;
  averageBagSizeGrams: number | null;
  averageDaysToOpen: number | null;
  averageDaysToFinish: number | null;

  breakdowns: {
    roaster: BreakdownEntry[];
    origin: BreakdownEntry[];
    processing: BreakdownEntry[];
    roastLevel: BreakdownEntry[];
    caffeine: BreakdownEntry[];
  };
}

function sumGrams(rows: CoffeeRow[]): number {
  return rows.reduce((total, r) => total + (r.amount_g ?? 0), 0);
}

function daysToClear(totalGrams: number, ratePerDay: number): number | null {
  if (totalGrams <= 0) return null;
  return Math.ceil(totalGrams / ratePerDay);
}

function clearByDate(days: number | null, today: Date): string | null {
  if (days === null) return null;
  return formatDate(addDays(today, days));
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

function averageDaysBetween(
  rows: CoffeeRow[],
  startDate: (row: CoffeeRow) => string | null,
  endDate: (row: CoffeeRow) => string | null
): number | null {
  const diffs: number[] = [];
  for (const row of rows) {
    const start = startDate(row);
    const end = endDate(row);
    if (start != null && end != null) {
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
  rates: StatsRates,
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

  const daysSelf = daysToClear(totalBacklogGrams, rates.selfGPerDay);
  const daysHousehold = daysToClear(totalBacklogGrams, rates.householdGPerDay);

  const totalCost = sumCost(allRows);
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

  const backlogWithRoastDate = backlogRows.filter((r): r is CoffeeRow & { roast_date: string } => r.roast_date != null);
  let oldestUnopenedBag: BacklogStats['oldestUnopenedBag'] = null;
  if (backlogWithRoastDate.length > 0) {
    const oldest = backlogWithRoastDate.reduce((a, b) => (parseDate(a.roast_date) < parseDate(b.roast_date) ? a : b));
    oldestUnopenedBag = {
      coffeeName: oldest.coffee_name,
      roaster: oldest.roaster,
      roastDate: oldest.roast_date,
      daysOld: diffDays(today, parseDate(oldest.roast_date))
    };
  }

  const bagsWithWeight = allRows.filter((r) => r.amount_g != null);
  const averageBagSizeGrams = bagsWithWeight.length > 0 ? sumGrams(bagsWithWeight) / bagsWithWeight.length : null;

  const roastOrder = new Map(roastLevels.map((r) => [r.roast_level, r.degrees_of_roast]));
  const roastLevelBreakdown = buildBreakdown(allRows, (r) => r.roast_level ?? 'Unknown').sort(
    (a, b) => (roastOrder.get(a.label) ?? Infinity) - (roastOrder.get(b.label) ?? Infinity)
  );

  return {
    openedGrams,
    unopenedBacklogGrams,
    totalBacklogGrams,
    finishedGrams,
    openedCount,
    unopenedBacklogCount,
    totalBacklogCount,
    finishedCount,
    daysToClearSelf: daysSelf,
    clearByDateSelf: clearByDate(daysSelf, today),
    daysToClearHousehold: daysHousehold,
    clearByDateHousehold: clearByDate(daysHousehold, today),
    totalCost,
    totalSpentAllTime,
    distinctRoasterCount,
    oldestUnopenedBag,
    averageBagSizeGrams,
    averageDaysToOpen,
    averageDaysToFinish,
    breakdowns: {
      roaster: buildBreakdown(allRows, (r) => r.roaster),
      origin: buildBreakdown(allRows, (r) => r.origin ?? 'Unknown'),
      processing: buildBreakdown(allRows, (r) => r.processing ?? 'Unknown'),
      roastLevel: roastLevelBreakdown,
      caffeine: buildCaffeineBreakdown(allRows)
    }
  };
}
