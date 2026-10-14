import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { localToday } from '$lib/server/localToday';
import { importBeanConquerorData } from '$lib/server/beanconqueror';
import { buildBeanConquerorStats, bcPerPerson, type BeanConquerorStats } from './beanConquerorStatsData';

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
    beanAgeDays: 30,
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
    const stats = buildBeanConquerorStats(db, localToday());
    expect(stats.totalBrews).toBe(6);
    expect(stats.totalBeans).toBe(2);
    expect(stats.averageRating).toBe(7);
    expect(stats.totalGramsBrewed).toBe(120);
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster A')?.averageRating).toBe(8);
    expect(stats.favoritesByOrigin.find((g) => g.label === 'Ethiopia')?.averageRating).toBe(8);
    expect(stats.favoritesByProcessing.find((g) => g.label === 'Natural')?.averageRating).toBe(6);
    expect(stats.byMethod.find((g) => g.label === 'V60')?.brewCount).toBe(6);
    expect(stats.byGrinder.find((g) => g.label === 'Comandante')?.brewCount).toBe(6);
    expect(stats.averageBrewTemperatureC).toBe(92);
    expect(stats.averageBeanAgeAtBrewDays).toBe(30);
  });

  it('returns zeroed/null stats gracefully with no data', () => {
    const db = createDb(':memory:');
    const stats = buildBeanConquerorStats(db, localToday());
    expect(stats.totalBrews).toBe(0);
    expect(stats.totalBeans).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.totalGramsBrewed).toBeNull();
    expect(stats.favoritesByRoaster).toEqual([]);
    expect(stats.brewsPerDay).toEqual([]);
    for (const w of stats.periodAverages) {
      expect([w.brewsPerDay, w.brewsPerBrewDay, w.gramsPerDay, w.gramsPerBrewDay, w.rating]).toEqual([
        null,
        null,
        null,
        null,
        null
      ]);
    }
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

    const stats = buildBeanConquerorStats(db, localToday());

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

    const stats = buildBeanConquerorStats(db, localToday());

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

    const stats = buildBeanConquerorStats(db, localToday());

    expect(stats.ratingsOverTime).toEqual([
      { date: '2026-06-08', rating: 7 },
      { date: '2026-06-15', rating: 4 }
    ]);
  });

  it('counts brewsPerDay (brews and grams) for every day from first to last brew, gap days as 0, with trailing 7-day averages', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [
        { id: 'b1', name: 'Bean A', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [],
      methods: [{ id: 'm1', preparationMethod: 'V60', name: 'V60', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }],
      grinders: [{ id: 'g1', name: 'Comandante', notes: null, bcArchived: false, bcCreatedAt: null }],
      // 6/1: 2 brews, 6/2-6/3: none, 6/4: 1, 6/5-6/8: none, 6/9: 4 — one of
      // which has no recorded dose (20g each otherwise, per brewsFor).
      brews: [
        ...brewsFor(
          'b1',
          [
            '2026-06-01T08:00:00.000Z',
            '2026-06-01T15:00:00.000Z',
            '2026-06-04T08:00:00.000Z',
            '2026-06-09T07:00:00.000Z',
            '2026-06-09T09:00:00.000Z',
            '2026-06-09T11:00:00.000Z'
          ],
          null,
          null,
          null
        ),
        { ...brewsFor('b1', ['2026-06-09T13:00:00.000Z'], null, null, null)[0], groundCoffeeG: null }
      ]
    });

    const days = buildBeanConquerorStats(db, localToday()).brewsPerDay;

    expect(days.map((d) => [d.date, d.brews])).toEqual([
      ['2026-06-01', 2],
      ['2026-06-02', 0],
      ['2026-06-03', 0],
      ['2026-06-04', 1],
      ['2026-06-05', 0],
      ['2026-06-06', 0],
      ['2026-06-07', 0],
      ['2026-06-08', 0],
      ['2026-06-09', 4]
    ]);
    // Partial window at the start: day 1 = 2/1, day 4 = (2+0+0+1)/4.
    expect(days[0].rollingAverage).toBe(2);
    expect(days[3].rollingAverage).toBeCloseTo(0.75);
    // Full window: 6/2-6/8 = 1/7; 6/3-6/9 = (0+1+0+0+0+0+4)/7.
    expect(days[7].rollingAverage).toBeCloseTo(1 / 7);
    expect(days[8].rollingAverage).toBeCloseTo(5 / 7);
    // Grams: the NULL-dose brew still counts as a brew but adds 0g.
    expect(days.map((d) => d.grams)).toEqual([40, 0, 0, 20, 0, 0, 0, 0, 60]);
    expect(days[0].gramsRollingAverage).toBe(40);
    expect(days[3].gramsRollingAverage).toBeCloseTo(15);
    expect(days[8].gramsRollingAverage).toBeCloseTo(80 / 7);
  });

  it('averages brews/grams/rating over trailing windows ending today, clamped to the first brew day', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [
        { id: 'b1', name: 'Bean A', roaster: 'Roaster A', roastDate: '2026-04-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [],
      methods: [{ id: 'm1', preparationMethod: 'V60', name: 'V60', preparationStyle: null, preparationTools: null, notes: null, bcArchived: false, bcCreatedAt: null }],
      grinders: [{ id: 'g1', name: 'Comandante', notes: null, bcArchived: false, bcCreatedAt: null }],
      // First brew 5/1 (rated 8); 6/1: two brews (rated 6, unrated); 6/3:
      // one unrated brew with no dose. 20g per brew otherwise.
      brews: [
        ...brewsFor('b1', ['2026-05-01T08:00:00.000Z'], 8, null, null),
        ...brewsFor('b1', ['2026-06-01T08:00:00.000Z'], 6, null, null),
        ...brewsFor('b1', ['2026-06-01T15:00:00.000Z'], null, null, null),
        { ...brewsFor('b1', ['2026-06-03T08:00:00.000Z'], null, null, null)[0], groundCoffeeG: null }
      ]
    });

    const byWindow = Object.fromEntries(
      buildBeanConquerorStats(db, '2026-06-20').periodAverages.map((w) => [w.window, w])
    );

    // All time: 5/1-6/20 = 51 calendar days, 3 of them brew days.
    expect(byWindow.all.brewsPerDay).toBeCloseTo(4 / 51);
    expect(byWindow.all.brewsPerBrewDay).toBeCloseTo(4 / 3);
    expect(byWindow.all.gramsPerDay).toBeCloseTo(60 / 51);
    expect(byWindow.all.gramsPerBrewDay).toBe(20);
    expect(byWindow.all.rating).toBe(7);
    // Last year starts before the first brew, so it's clamped to all time.
    expect(byWindow.year).toEqual({ ...byWindow.all, window: 'year' });
    // Last month (5/22-6/20, 30 days) skips the 5/1 brew; the rating
    // ignores the unrated brews.
    expect(byWindow.month.brewsPerDay).toBeCloseTo(3 / 30);
    expect(byWindow.month.brewsPerBrewDay).toBe(1.5);
    expect(byWindow.month.gramsPerDay).toBeCloseTo(40 / 30);
    expect(byWindow.month.gramsPerBrewDay).toBe(20);
    expect(byWindow.month.rating).toBe(6);
    // Last week (6/14-6/20) has no brews: 0 per day, nothing per brew day.
    expect(byWindow.week).toEqual({
      window: 'week',
      brewsPerDay: 0,
      brewsPerBrewDay: null,
      gramsPerDay: 0,
      gramsPerBrewDay: null,
      rating: null
    });
  });

  it('orders costPerGramByRoaster most-expensive-first, matching its "top" framing', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [
        { id: 'b1', name: 'Cheap Bean', roaster: 'Budget Roaster', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 10, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false },
        { id: 'b2', name: 'Pricey Bean', roaster: 'Luxury Roaster', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 100, cost: 30, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: []
    });
    const stats = buildBeanConquerorStats(db, localToday());
    // Budget Roaster: $10/200g = $0.05/g. Luxury Roaster: $30/100g = $0.30/g.
    expect(stats.costPerGramByRoaster.map((g) => g.label)).toEqual(['Luxury Roaster', 'Budget Roaster']);
  });

  it('excludes a 0 brew_temperature/unset bean_age_days from their averages (Bean Conqueror\'s "not entered" sentinel)', () => {
    const db = createDb(':memory:');
    importBeanConquerorData(db, {
      beans: [
        { id: 'b1', name: 'Bean A', roaster: 'Roaster A', roastDate: '2026-06-01', roastType: null, degreeOfRoast: null, customDegreeOfRoast: null, blend: null, weightG: 200, cost: 20, aromatics: null, cuppingPoints: null, decaffeinated: false, url: null, eanArticleNumber: null, notes: null, rating: null, bcCreatedAt: null, bcArchived: false }
      ],
      beanOrigins: [],
      methods: [],
      grinders: [],
      brews: [
        {
          bcCreatedAt: '2026-06-10T08:00:00.000Z',
          beanId: 'b1',
          preparationId: null,
          millId: null,
          grindSetting: null,
          groundCoffeeG: null,
          brewTemperature: 0,
          beanType: null,
          grindSpeedRpm: null,
          grindTime: null,
          profile: null,
          preparationTools: null,
          temperatureTime: null,
          brewTime: null,
          bloomTime: null,
          firstDripTime: null,
          waterAmountG: null,
          coffeeType: null,
          coffeeConcentration: null,
          rating: null,
          notes: null,
          beverageQuantity: null,
          tdsPercent: null,
          extractionYieldPercent: null,
          brewRatio: null,
          beanAgeDays: null,
          bcArchived: false,
          water: null
        }
      ]
    });
    const stats = buildBeanConquerorStats(db, localToday());
    expect(stats.averageBrewTemperatureC).toBeNull();
    expect(stats.averageBeanAgeAtBrewDays).toBeNull();
  });
});

describe('bcPerPerson', () => {
  const S: BeanConquerorStats = {
    totalBrews: 13, totalBeans: 3, averageRating: 8, totalGramsBrewed: 195,
    ratingsOverTime: [{ date: '2026-10-01', rating: 8 }],
    periodAverages: [{ window: 'week', brewsPerDay: 2, brewsPerBrewDay: 3, gramsPerDay: 30, gramsPerBrewDay: 45, rating: 8 }],
    brewsPerDay: [{ date: '2026-10-01', brews: 2, rollingAverage: 1, grams: 30, gramsRollingAverage: 15 }],
    favoritesByRoaster: [{ label: 'R', averageRating: 8, brewCount: 4 }], favoritesByOrigin: [], favoritesByProcessing: [],
    favoritesByRoastLevel: [], byMethod: [{ label: 'V60', averageRating: 8, brewCount: 4 }], byGrinder: [],
    averageBrewTemperatureC: 93, averageBeanAgeAtBrewDays: 20, averageCostPerGram: 0.1, costPerGramByRoaster: []
  };
  it('divides totals and per-day values; averages, ratings, beans and breakdowns stay', () =>
    expect(bcPerPerson(S, 2)).toEqual({
      ...S,
      totalBrews: 6.5,
      totalGramsBrewed: 97.5,
      periodAverages: [{ window: 'week', brewsPerDay: 1, brewsPerBrewDay: 1.5, gramsPerDay: 15, gramsPerBrewDay: 22.5, rating: 8 }],
      brewsPerDay: [{ date: '2026-10-01', brews: 1, rollingAverage: 0.5, grams: 15, gramsRollingAverage: 7.5 }]
    }));
  it('keeps missing values missing', () => {
    const p = bcPerPerson({ ...S, totalGramsBrewed: null, periodAverages: [{ ...S.periodAverages[0], brewsPerDay: null }] }, 2);
    expect(p.totalGramsBrewed).toBeNull();
    expect(p.periodAverages[0].brewsPerDay).toBeNull();
  });
  it('a household of one is the household', () => expect(bcPerPerson(S, 1)).toBe(S));
});
