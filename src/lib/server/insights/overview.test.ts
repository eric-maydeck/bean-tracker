import { describe, it, expect } from 'vitest';
import { overviewTiles, tileDelta, compareTiles, TILE_KIND } from './overview';
import type { BrewFact, BagFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', origin: null, processGroup: 'Washed',
  roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, ...o
});
const SEPT = { start: '2026-09-01', end: '2026-09-30' };

describe('overviewTiles', () => {
  const brews = [
    brew({ localDate: '2026-09-01', dose: 15, rating: 8, costPerBrew: 1.5 }),
    brew({ localDate: '2026-09-30', dose: 16 }),
    brew({ localDate: '2026-08-31', dose: 20, rating: 9, costPerBrew: 3 }), // before
    brew({ localDate: '2026-10-01', dose: 20, rating: 2 }) // after
  ];
  const bags = [
    bag({ id: 1, status: 'archive', purchaseDate: '2026-08-20', cost: 30, lastBrew: '2026-09-30' }), // finished, bought before
    bag({ id: 2, status: 'open', purchaseDate: '2026-09-10', cost: 25, lastBrew: '2026-09-15' }), // bought, not finished
    bag({ id: 3, status: 'archive', purchaseDate: '2026-07-01', cost: 20, lastBrew: '2026-08-31' }), // finished before
    bag({ id: 4, purchaseDate: '2026-09-05', cost: null }), // no cost
    bag({ id: 5, purchaseDate: null, cost: 40 }) // no roast date: never in a period
  ];

  it('aggregates each tile over the period', () =>
    expect(overviewTiles(brews, bags, SEPT, 'all')).toEqual({
      brews: 2, grams: 31, spend: 25, avgRating: 8, rated: 1, bagsFinished: 1, costPerBrew: 1.5,
      brewsPerDay: 2 / 30, avgDose: 15.5, avgRestDays: null, avgBrewTime: null
    }));

  it('averages skip missing values (dose 0 is missing)', () => {
    const t = overviewTiles(
      [
        brew({ dose: 18, restDays: 10, brewTimeSeconds: 180 }),
        brew({ dose: 0, restDays: 20, brewTimeSeconds: null }),
        brew({ dose: null, restDays: null, brewTimeSeconds: 200 })
      ],
      [], SEPT, 'all'
    );
    expect(t).toMatchObject({ avgDose: 18, avgRestDays: 15, avgBrewTime: 190, brewsPerDay: 3 / 30 });
  });

  it('avg rest skips negative rest (a brew before its bag\'s roast date)', () =>
    expect(overviewTiles([brew({ restDays: -7 }), brew({ restDays: 9 })], [], SEPT, 'all').avgRestDays).toBe(9));

  it('brews per day over all time counts from the first brew', () =>
    expect(overviewTiles(brews, [], { start: null, end: '2026-10-09' }, 'all', '2026-10-09', '2026-08-31').brewsPerDay)
      .toBe(4 / 40));

  it('brews per day counts from the first brew ever when tracking starts mid-period', () => {
    // SEPT starts 09-01; tracking started 09-21 → 10 days.
    expect(overviewTiles([brew({ localDate: '2026-09-25' })], [], SEPT, 'all', SEPT.end, '2026-09-21').brewsPerDay).toBe(1 / 10);
    // A window fully inside tracking keeps its full length.
    expect(overviewTiles([brew({ localDate: '2026-09-25' })], [], SEPT, 'all', SEPT.end, '2026-01-01').brewsPerDay).toBe(1 / 30);
  });

  it('a previous period that partly overlaps tracking divides by the tracked days', () => {
    const aug = { start: '2026-08-01', end: '2026-08-31' };
    const t = overviewTiles([brew({ localDate: '2026-08-30' }), brew({ localDate: '2026-08-31' })], [], aug, 'all', aug.end, '2026-08-22');
    expect(t.brewsPerDay).toBe(2 / 10);
  });

  it('brews per day stops at today in a period that runs past it', () =>
    expect(overviewTiles(brews, [], SEPT, 'all', '2026-09-10').brewsPerDay).toBe(2 / 10));

  it('all time has no start', () => expect(overviewTiles(brews, bags, { start: null, end: '2026-10-09' }, 'all').brews).toBe(4));

  it('Settled hides calibration-period ratings, volume and spend ignore it', () => {
    const may = { start: '2026-05-01', end: '2026-05-31' };
    const early = [brew({ localDate: '2026-05-20', dose: 15, rating: 2 })];
    expect(overviewTiles(early, [], may, 'settled')).toMatchObject({ brews: 1, grams: 15, avgRating: null, rated: 0 });
    expect(overviewTiles(early, [], may, 'all')).toMatchObject({ avgRating: 2, rated: 1 });
  });

  it('an empty period is zeros and nulls', () =>
    expect(overviewTiles([], [], SEPT, 'settled')).toEqual({
      brews: 0, grams: 0, spend: 0, avgRating: null, rated: 0, bagsFinished: 0, costPerBrew: null,
      brewsPerDay: null, avgDose: null, avgRestDays: null, avgBrewTime: null
    }));

  it('every tile has a kind', () => {
    expect(Object.keys(TILE_KIND).sort()).toEqual(Object.keys(overviewTiles([], [], SEPT, 'all')).sort());
    expect(Object.entries(TILE_KIND).filter(([, k]) => k === 'total').map(([t]) => t).sort())
      .toEqual(['bagsFinished', 'brews', 'grams', 'rated', 'spend']);
  });
});

describe('tileDelta', () => {
  it('absolute and percent change', () => {
    expect(tileDelta(12, 10)).toEqual({ abs: 2, pct: 20 });
    expect(tileDelta(8, 10)).toEqual({ abs: -2, pct: -20 });
    expect(tileDelta(0, 10)).toEqual({ abs: -10, pct: -100 });
  });
  it('no change without previous data', () => {
    expect(tileDelta(5, 0)).toBeNull();
    expect(tileDelta(5, null)).toBeNull();
    expect(tileDelta(null, 5)).toBeNull();
    expect(tileDelta(9, -7)).toBeNull();
  });
  it('compareTiles covers every tile', () => {
    const t = {
      brews: 2, grams: 30, spend: 0, avgRating: null, rated: 1, bagsFinished: 1, costPerBrew: 1,
      brewsPerDay: 0.5, avgDose: 15, avgRestDays: null, avgBrewTime: 180
    };
    const d = compareTiles(t, { ...t, brews: 1, avgDose: 12, avgBrewTime: null });
    expect(Object.keys(d).sort()).toEqual(Object.keys(t).sort());
    expect(d.brews).toEqual({ abs: 1, pct: 100 });
    expect(d.spend).toBeNull();
    expect(d.avgDose).toEqual({ abs: 3, pct: 25 });
    expect(d.avgBrewTime).toBeNull();
    expect(d.avgRestDays).toBeNull();
  });
});
