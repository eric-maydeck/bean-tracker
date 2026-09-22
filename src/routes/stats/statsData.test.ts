import { describe, it, expect } from 'vitest';
import type { CoffeeRow, RoastLevelRow } from '$lib/types';
import { buildBacklogStats } from './statsData';

function sampleRow(overrides: Partial<CoffeeRow> = {}): CoffeeRow {
  return {
    id: 1,
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 200,
    cost: 18,
    roast_date: '2026-06-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 20,
    image_url: null,
    slug: 'test-roasters-sample-blend',
    opened_date: null,
    drank: 0,
    status: 'backlog',
    moved_date: null,
    decaf: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const roastLevels: RoastLevelRow[] = [
  { roast_level: 'Light', degrees_of_roast: 2.5 },
  { roast_level: 'Medium', degrees_of_roast: 4.0 },
  { roast_level: 'Dark', degrees_of_roast: 5.0 }
];

const rates = { selfGPerDay: 72, householdGPerDay: 144 };
const today = new Date('2026-09-21T00:00:00Z');

describe('buildBacklogStats', () => {
  it('sums grams and counts across open and backlog separately and combined', () => {
    const open = [sampleRow({ id: 1, amount_g: 100, status: 'open' })];
    const backlog = [
      sampleRow({ id: 2, amount_g: 200, status: 'backlog' }),
      sampleRow({ id: 3, amount_g: 300, status: 'backlog' })
    ];
    const stats = buildBacklogStats(open, backlog, [], rates, roastLevels, today);
    expect(stats.openedGrams).toBe(100);
    expect(stats.unopenedBacklogGrams).toBe(500);
    expect(stats.totalBacklogGrams).toBe(600);
    expect(stats.openedCount).toBe(1);
    expect(stats.unopenedBacklogCount).toBe(2);
    expect(stats.totalBacklogCount).toBe(3);
  });

  it('sums finished grams and counts from archived rows separately', () => {
    const archived = [
      sampleRow({ id: 1, amount_g: 100, status: 'archive' }),
      sampleRow({ id: 2, amount_g: 250, status: 'archive' })
    ];
    const stats = buildBacklogStats([], [], archived, rates, roastLevels, today);
    expect(stats.finishedGrams).toBe(350);
    expect(stats.finishedCount).toBe(2);
    // Finished coffees never count toward the backlog/open totals.
    expect(stats.totalBacklogGrams).toBe(0);
    expect(stats.totalBacklogCount).toBe(0);
  });

  it('computes days-to-clear by rounding up, and a UTC clear-by date', () => {
    const backlog = [sampleRow({ amount_g: 730 })]; // not evenly divisible by 72
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.daysToClearSelf).toBe(Math.ceil(730 / 72));
    expect(stats.clearByDateSelf).toBe('2026-10-02'); // today + 11 days
    expect(stats.daysToClearHousehold).toBe(Math.ceil(730 / 144));
  });

  it('returns null time-to-clear figures when there is nothing in the backlog', () => {
    const stats = buildBacklogStats([], [], [], rates, roastLevels, today);
    expect(stats.daysToClearSelf).toBeNull();
    expect(stats.clearByDateSelf).toBeNull();
    expect(stats.daysToClearHousehold).toBeNull();
    expect(stats.clearByDateHousehold).toBeNull();
  });

  it('sums cost only over rows with a non-null cost, and separately sums all-time including archived', () => {
    const backlog = [
      sampleRow({ id: 1, cost: 20 }),
      sampleRow({ id: 2, cost: null }),
      sampleRow({ id: 3, cost: 15 })
    ];
    const archived = [sampleRow({ id: 4, cost: 30, status: 'archive' })];
    const stats = buildBacklogStats([], backlog, archived, rates, roastLevels, today);
    expect(stats.totalCost).toBe(35);
    expect(stats.totalSpentAllTime).toBe(65);
  });

  it('counts distinct roasters across open and backlog', () => {
    const open = [sampleRow({ id: 1, roaster: 'Roaster A' })];
    const backlog = [
      sampleRow({ id: 2, roaster: 'Roaster A' }),
      sampleRow({ id: 3, roaster: 'Roaster B' })
    ];
    const stats = buildBacklogStats(open, backlog, [], rates, roastLevels, today);
    expect(stats.distinctRoasterCount).toBe(2);
  });

  it('finds the oldest and youngest unopened bags by roast date, with slug for linking', () => {
    const backlog = [
      sampleRow({ id: 1, coffee_name: 'Newer', roast_date: '2026-08-01', slug: 'newer-slug' }),
      sampleRow({ id: 2, coffee_name: 'Older', roast_date: '2026-06-01', slug: 'older-slug' })
    ];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.oldestUnopenedBag?.coffeeName).toBe('Older');
    expect(stats.oldestUnopenedBag?.daysOld).toBe(112); // 2026-06-01 -> 2026-09-21
    expect(stats.oldestUnopenedBag?.slug).toBe('older-slug');
    expect(stats.youngestUnopenedBag?.coffeeName).toBe('Newer');
    expect(stats.youngestUnopenedBag?.slug).toBe('newer-slug');
  });

  it('returns a null oldest/youngest bag when the backlog is empty or has no roast dates', () => {
    const empty = buildBacklogStats([], [], [], rates, roastLevels, today);
    expect(empty.oldestUnopenedBag).toBeNull();
    expect(empty.youngestUnopenedBag).toBeNull();
    const backlog = [sampleRow({ roast_date: null })];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.oldestUnopenedBag).toBeNull();
    expect(stats.youngestUnopenedBag).toBeNull();
  });

  it('averages bag size over rows with a known weight, skipping nulls', () => {
    const backlog = [
      sampleRow({ id: 1, amount_g: 100 }),
      sampleRow({ id: 2, amount_g: null }),
      sampleRow({ id: 3, amount_g: 300 })
    ];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.averageBagSizeGrams).toBe(200);
  });

  it('averages the age (days since roast) of backlog + open rows, excluding archived and null roast dates', () => {
    const open = [sampleRow({ id: 1, roast_date: '2026-08-01' })]; // 51 days old
    const backlog = [
      sampleRow({ id: 2, roast_date: '2026-09-01' }), // 20 days old
      sampleRow({ id: 3, roast_date: null }) // excluded
    ];
    const archived = [sampleRow({ id: 4, roast_date: '2026-01-01', status: 'archive' })]; // excluded
    const stats = buildBacklogStats(open, backlog, archived, rates, roastLevels, today);
    expect(stats.averageAgeBacklogAndOpen).toBe(35.5); // (51 + 20) / 2
  });

  it('returns null averageAgeBacklogAndOpen when no backlog/open row has a roast date', () => {
    const stats = buildBacklogStats([], [], [], rates, roastLevels, today);
    expect(stats.averageAgeBacklogAndOpen).toBeNull();
  });

  it('averages days from roast to open across open/backlog/archived, skipping rows never opened', () => {
    const open = [sampleRow({ id: 1, roast_date: '2026-08-01', opened_date: '2026-08-11' })]; // 10 days
    const backlog = [sampleRow({ id: 2, roast_date: '2026-08-01', opened_date: null })]; // never opened, excluded
    const archived = [sampleRow({ id: 3, roast_date: '2026-07-01', opened_date: '2026-07-21', status: 'archive' })]; // 20 days
    const stats = buildBacklogStats(open, backlog, archived, rates, roastLevels, today);
    expect(stats.averageDaysToOpen).toBe(15);
  });

  it('returns null averageDaysToOpen when no row has both a roast date and an opened date', () => {
    const backlog = [sampleRow({ roast_date: '2026-08-01', opened_date: null })];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.averageDaysToOpen).toBeNull();
  });

  it('averages days from open to finish over archived rows with both dates, skipping ones without', () => {
    const archived = [
      sampleRow({ id: 1, opened_date: '2026-06-01', moved_date: '2026-06-11', status: 'archive' }), // 10 days
      sampleRow({ id: 2, opened_date: '2026-06-01', moved_date: '2026-06-21', status: 'archive' }), // 20 days
      sampleRow({ id: 3, opened_date: null, moved_date: '2026-06-21', status: 'archive' }) // missing opened_date, excluded
    ];
    const stats = buildBacklogStats([], [], archived, rates, roastLevels, today);
    expect(stats.averageDaysToFinish).toBe(15);
  });

  it('returns null averageDaysToFinish when there are no archived rows with both dates', () => {
    const stats = buildBacklogStats([], [], [], rates, roastLevels, today);
    expect(stats.averageDaysToFinish).toBeNull();
  });

  it('buckets a null origin/processing/roast_level into "Unknown"', () => {
    const backlog = [sampleRow({ origin: null, processing: null, roast_level: null })];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.breakdowns.origin.map((e) => e.label)).toEqual(['Unknown']);
    expect(stats.breakdowns.processing.map((e) => e.label)).toEqual(['Unknown']);
    expect(stats.breakdowns.roastLevel.map((e) => e.label)).toEqual(['Unknown']);
  });

  it('orders the roast-level breakdown by roast order, not alphabetically', () => {
    const backlog = [
      sampleRow({ id: 1, roast_level: 'Dark' }),
      sampleRow({ id: 2, roast_level: 'Light' }),
      sampleRow({ id: 3, roast_level: 'Medium' })
    ];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.breakdowns.roastLevel.map((e) => e.label)).toEqual(['Light', 'Medium', 'Dark']);
  });

  it('always includes both Caffeinated and Decaf in the caffeine breakdown, even at zero', () => {
    const backlog = [sampleRow({ decaf: 0 })];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    const labels = stats.breakdowns.caffeine.map((e) => e.label).sort();
    expect(labels).toEqual(['Caffeinated', 'Decaf']);
    const decafEntry = stats.breakdowns.caffeine.find((e) => e.label === 'Decaf');
    expect(decafEntry).toEqual({ label: 'Decaf', grams: 0, count: 0 });
  });

  it('sorts roaster/origin/processing breakdowns by grams descending', () => {
    const backlog = [
      sampleRow({ id: 1, roaster: 'Small', amount_g: 100 }),
      sampleRow({ id: 2, roaster: 'Big', amount_g: 500 })
    ];
    const stats = buildBacklogStats([], backlog, [], rates, roastLevels, today);
    expect(stats.breakdowns.roaster.map((e) => e.label)).toEqual(['Big', 'Small']);
  });

  it('excludes archived rows from the composition breakdowns', () => {
    const backlog = [sampleRow({ id: 1, roaster: 'Backlog Roaster' })];
    const archived = [sampleRow({ id: 2, roaster: 'Archived Roaster', status: 'archive' })];
    const stats = buildBacklogStats([], backlog, archived, rates, roastLevels, today);
    expect(stats.breakdowns.roaster.map((e) => e.label)).toEqual(['Backlog Roaster']);
  });
});
