import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { importBeanConquerorData } from '$lib/server/beanconqueror';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

type SeededBrew = Parameters<typeof importBeanConquerorData>[1]['brews'][number];

function brewsFor(
  beanId: string,
  timestamps: string[],
  rating: number | null,
  tdsPercent: number | null,
  extractionYieldPercent: number | null,
  { preparationId = 'm1', millId = 'g1' }: { preparationId?: string; millId?: string } = {}
): SeededBrew[] {
  return timestamps.map((bcCreatedAt) => ({
    bcCreatedAt,
    beanId,
    preparationId,
    millId,
    grindSetting: null,
    groundCoffeeG: 20,
    brewTemperature: 92,
    beanType: null,
    grindSpeedRpm: null,
    grindTime: null,
    profile: null,
    preparationTools: null,
    temperatureTime: null,
    brewTime: null,
    bloomTime: null,
    firstDripTime: null,
    waterAmountG: 300,
    coffeeType: null,
    coffeeConcentration: null,
    rating,
    notes: null,
    beverageQuantity: null,
    tdsPercent,
    extractionYieldPercent,
    brewRatio: null,
    beanAgeDays: null,
    bcArchived: false,
    water: null
  }));
}

function seed(db: ReturnType<typeof createDb>) {
  importBeanConquerorData(db, {
    beans: [
      { id: 'b1', name: 'Bean A', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: 2.5, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false },
      { id: 'b2', name: 'Bean B', roaster: 'Roaster B', roastDate: '2026-06-01', roastType: null, degreeOfRoast: 4, customDegreeOfRoast: null, blend: null, weightG: 250, cost: 25, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
    ],
    beanOrigins: [
      { beanId: 'b1', componentNumber: 1, country: 'Ethiopia', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Washed', certification: null, harvested: null, percentage: null },
      { beanId: 'b2', componentNumber: 1, country: 'Colombia', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Natural', certification: null, harvested: null, percentage: null }
    ],
    methods: [{ id: 'm1', preparationMethod: 'V60', name: 'V60', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }],
    grinders: [{ id: 'g1', name: 'Comandante', notes: null, bcArchived: false, bcCreatedAt: null }],
    // Three brews per bean, all with the same rating/TDS/yield per bean, so
    // every average below is unchanged by the count — but each group clears
    // the MIN_BREWS_PER_RATED_GROUP (3) threshold the breakdown queries
    // apply. A group with fewer brews is deliberately excluded (see the
    // dedicated test for that below).
    brews: [
      ...brewsFor('b1', ['2026-06-10T08:00:00.000Z', '2026-06-10T09:00:00.000Z', '2026-06-10T10:00:00.000Z'], 8, 1.3, 20),
      ...brewsFor('b2', ['2026-06-11T08:00:00.000Z', '2026-06-11T09:00:00.000Z', '2026-06-11T10:00:00.000Z'], 6, 1.1, 18)
    ]
  });
}

describe('buildBeanConquerorStats', () => {
  it('computes totals, average rating, and per-dimension favorites', () => {
    const db = createDb(':memory:');
    seed(db);
    const stats = buildBeanConquerorStats(db);
    expect(stats.totalBrews).toBe(6);
    expect(stats.totalBeans).toBe(2);
    expect(stats.averageRating).toBe(7);
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster A')?.averageRating).toBe(8);
    expect(stats.favoritesByOrigin.find((g) => g.label === 'Ethiopia')?.averageRating).toBe(8);
    expect(stats.favoritesByProcessing.find((g) => g.label === 'Natural')?.averageRating).toBe(6);
    expect(stats.byMethod.find((g) => g.label === 'V60')?.brewCount).toBe(6);
    expect(stats.byGrinder.find((g) => g.label === 'Comandante')?.brewCount).toBe(6);
    expect(stats.averageExtractionYieldPercent).toBe(19);
    expect(stats.averageTdsPercent).toBeCloseTo(1.2);
  });

  it('returns zeroed/null stats gracefully with no data', () => {
    const db = createDb(':memory:');
    const stats = buildBeanConquerorStats(db);
    expect(stats.totalBrews).toBe(0);
    expect(stats.totalBeans).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.favoritesByRoaster).toEqual([]);
  });

  it('excludes groups whose only brews are unrated, rather than surfacing a null averageRating', () => {
    const db = createDb(':memory:');
    seed(db);
    importBeanConquerorData(db, {
      beans: [
        { id: 'b3', name: 'Bean C', roaster: 'Roaster C', roastDate: '2026-06-01', roastType: null, degreeOfRoast: 5.0, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [
        { beanId: 'b3', componentNumber: 1, country: 'Kenya', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Honey', certification: null, harvested: null, percentage: null }
      ],
      methods: [
        { id: 'm2', preparationMethod: 'AeroPress', name: 'AeroPress', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }
      ],
      grinders: [{ id: 'g2', name: 'Niche Zero', notes: null, bcArchived: false, bcCreatedAt: null }],
      // Three unrated brews, not one: that clears the minimum-brew-count
      // threshold, so these groups can only be excluded by the
      // `rating IS NOT NULL` filter this test is actually about.
      brews: brewsFor(
        'b3',
        ['2026-06-12T08:00:00.000Z', '2026-06-12T09:00:00.000Z', '2026-06-12T10:00:00.000Z'],
        null,
        null,
        null,
        { preparationId: 'm2', millId: 'g2' }
      )
    });

    const stats = buildBeanConquerorStats(db);

    // The unrated brews still count toward the raw totals...
    expect(stats.totalBrews).toBe(9);
    expect(stats.totalBeans).toBe(3);
    // ...but since every brew for "Roaster C" / Kenya / Honey / AeroPress /
    // Niche Zero / Dark is unrated, AVG(rating) over that group would be SQL
    // NULL — those groups must be excluded from the RatedGroup breakdowns
    // entirely rather than surfacing with a `null` averageRating (the
    // `RatedGroup` type declares it as `number`, not `number | null`).
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster C')).toBeUndefined();
    expect(stats.favoritesByOrigin.find((g) => g.label === 'Kenya')).toBeUndefined();
    expect(stats.favoritesByProcessing.find((g) => g.label === 'Honey')).toBeUndefined();
    expect(stats.favoritesByRoastLevel.find((g) => g.label === 'Dark')).toBeUndefined();
    expect(stats.byMethod.find((g) => g.label === 'AeroPress')).toBeUndefined();
    expect(stats.byGrinder.find((g) => g.label === 'Niche Zero')).toBeUndefined();
    // Existing rated groups are unaffected by the new unrated brews.
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster A')?.averageRating).toBe(8);
  });

  it('excludes a group with fewer than the minimum number of rated brews', () => {
    const db = createDb(':memory:');
    seed(db);
    importBeanConquerorData(db, {
      beans: [
        { id: 'b4', name: 'Bean D', roaster: 'One Hit Wonder', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [
        { beanId: 'b4', componentNumber: 1, country: 'Panama', region: null, farm: null, farmer: null, elevation: null, variety: null, processing: 'Anaerobic', certification: null, harvested: null, percentage: null }
      ],
      methods: [
        { id: 'm3', preparationMethod: 'Chemex', name: 'Chemex', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }
      ],
      grinders: [{ id: 'g3', name: 'Ode Gen 2', notes: null, bcArchived: false, bcCreatedAt: null }],
      // Only two brews, both rated a perfect 10 — exactly the "one lucky
      // brew tops the chart" case the threshold exists to suppress.
      brews: brewsFor('b4', ['2026-06-13T08:00:00.000Z', '2026-06-13T09:00:00.000Z'], 10, null, null, {
        preparationId: 'm3',
        millId: 'g3'
      })
    });

    const stats = buildBeanConquerorStats(db);

    expect(stats.favoritesByRoaster.find((g) => g.label === 'One Hit Wonder')).toBeUndefined();
    expect(stats.favoritesByOrigin.find((g) => g.label === 'Panama')).toBeUndefined();
    expect(stats.favoritesByProcessing.find((g) => g.label === 'Anaerobic')).toBeUndefined();
    expect(stats.byMethod.find((g) => g.label === 'Chemex')).toBeUndefined();
    expect(stats.byGrinder.find((g) => g.label === 'Ode Gen 2')).toBeUndefined();
    // Groups that do clear the threshold are untouched.
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster A')?.brewCount).toBe(3);
  });

  it('aggregates ratingsOverTime into one averaged point per week, not one per brew', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [
        { id: 'b1', name: 'Bean A', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [],
      methods: [{ id: 'm1', preparationMethod: 'V60', name: 'V60', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }],
      grinders: [{ id: 'g1', name: 'Comandante', notes: null, bcArchived: false, bcCreatedAt: null }],
      // 2026-06-08 is a Monday. Two brews land in that same calendar week
      // (Mon 6/8 - Sun 6/14) with different ratings (8 and 6, averaging 7);
      // a third brew lands in the following week (Mon 6/15) on its own.
      // Real BeanConqueror histories run to hundreds of brews a year — the
      // whole point of this aggregation is that a chart never plots one
      // point per brew, so this asserts the grouping directly rather than
      // just the count.
      brews: [
        ...brewsFor('b1', ['2026-06-08T08:00:00.000Z'], 8, null, null),
        ...brewsFor('b1', ['2026-06-10T08:00:00.000Z'], 6, null, null),
        ...brewsFor('b1', ['2026-06-15T08:00:00.000Z'], 4, null, null)
      ]
    });

    const stats = buildBeanConquerorStats(db);

    expect(stats.ratingsOverTime).toEqual([
      { date: '2026-06-08', rating: 7 },
      { date: '2026-06-15', rating: 4 }
    ]);
  });
});
