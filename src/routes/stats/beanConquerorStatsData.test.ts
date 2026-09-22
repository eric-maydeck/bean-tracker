import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { importBeanConquerorData } from '$lib/server/beanconqueror';
import { buildBeanConquerorStats } from './beanConquerorStatsData';

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
    brews: [
      { bcCreatedAt: '2026-06-10T08:00:00.000Z', beanId: 'b1', preparationId: 'm1', millId: 'g1', grindSetting: null, groundCoffeeG: 20, brewTemperature: 92, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: 300, coffeeType: null, coffeeConcentration: null, rating: 8, notes: null, beverageQuantity: null, tdsPercent: 1.3, extractionYieldPercent: 20, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null },
      { bcCreatedAt: '2026-06-11T08:00:00.000Z', beanId: 'b2', preparationId: 'm1', millId: 'g1', grindSetting: null, groundCoffeeG: 20, brewTemperature: 92, beanType: null, grindSpeedRpm: null, grindTime: null, profile: null, preparationTools: null, temperatureTime: null, brewTime: null, bloomTime: null, firstDripTime: null, waterAmountG: 300, coffeeType: null, coffeeConcentration: null, rating: 6, notes: null, beverageQuantity: null, tdsPercent: 1.1, extractionYieldPercent: 18, brewRatio: null, beanAgeDays: null, bcArchived: false, water: null }
    ]
  });
}

describe('buildBeanConquerorStats', () => {
  it('computes totals, average rating, and per-dimension favorites', () => {
    const db = createDb(':memory:');
    seed(db);
    const stats = buildBeanConquerorStats(db);
    expect(stats.totalBrews).toBe(2);
    expect(stats.totalBeans).toBe(2);
    expect(stats.averageRating).toBe(7);
    expect(stats.favoritesByRoaster.find((g) => g.label === 'Roaster A')?.averageRating).toBe(8);
    expect(stats.favoritesByOrigin.find((g) => g.label === 'Ethiopia')?.averageRating).toBe(8);
    expect(stats.favoritesByProcessing.find((g) => g.label === 'Natural')?.averageRating).toBe(6);
    expect(stats.byMethod.find((g) => g.label === 'V60')?.brewCount).toBe(2);
    expect(stats.byGrinder.find((g) => g.label === 'Comandante')?.brewCount).toBe(2);
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
});
