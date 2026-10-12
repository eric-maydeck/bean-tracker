import { describe, it, expect } from 'vitest';
import { overviewTiles, tileDelta, compareTiles, perPerson, consumption, gramsOnHand, rightNow, paceDelta, TILE_KIND, type OverviewTiles } from './overview';
import type { BrewFact, BagFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed',
  roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, ...o
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

  it('Current hides calibration-period ratings, volume and spend ignore it', () => {
    const may = { start: '2026-05-01', end: '2026-05-31' };
    const early = [brew({ localDate: '2026-05-20', dose: 15, rating: 2 })];
    expect(overviewTiles(early, [], may, 'current')).toMatchObject({ brews: 1, grams: 15, avgRating: null, rated: 0 });
    expect(overviewTiles(early, [], may, 'all')).toMatchObject({ avgRating: 2, rated: 1 });
  });

  it('an empty period is zeros and nulls', () =>
    expect(overviewTiles([], [], SEPT, 'current')).toEqual({
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
  it('absolute and percent change, against base', () => {
    expect(tileDelta(12, 10)).toEqual({ abs: 2, pct: 20, base: 10 });
    expect(tileDelta(8, 10)).toEqual({ abs: -2, pct: -20, base: 10 });
    expect(tileDelta(0, 10)).toEqual({ abs: -10, pct: -100, base: 10 });
  });
  it('no change without previous data', () => {
    expect(tileDelta(5, 0)).toBeNull();
    expect(tileDelta(5, null)).toBeNull();
    expect(tileDelta(null, 5)).toBeNull();
    expect(tileDelta(9, -7)).toBeNull();
  });
});

describe('compareTiles', () => {
  const t = {
    brews: 2, grams: 30, spend: 0, avgRating: null, rated: 1, bagsFinished: 1, costPerBrew: 1,
    brewsPerDay: 0.5, avgDose: 15, avgRestDays: null, avgBrewTime: 180
  };
  it('equal day counts compare as they are', () => {
    const { deltas: d, scaled } = compareTiles(t, { ...t, brews: 1, avgDose: 12, avgBrewTime: null }, 30, 30);
    expect(scaled).toBe(false);
    expect(Object.keys(d).sort()).toEqual(Object.keys(t).sort());
    expect(d.brews).toEqual({ abs: 1, pct: 100, base: 1 });
    expect(d.spend).toBeNull();
    expect(d.avgDose).toEqual({ abs: 3, pct: 25, base: 12 });
    expect(d.avgBrewTime).toBeNull();
    expect(d.avgRestDays).toBeNull();
  });
  it('a longer baseline paces totals to the period\'s days; averages stay', () => {
    // 90 brews / 1350 g over 90 days → 7 / 105 at the period's 7 days.
    const { deltas: d, scaled } = compareTiles({ ...t, brews: 14, grams: 210 }, { ...t, brews: 90, grams: 1350, avgDose: 12 }, 7, 90);
    expect(scaled).toBe(true);
    expect(d.brews).toEqual({ abs: 7, pct: 100, base: 7, paced: true });
    expect(d.grams).toEqual({ abs: 105, pct: 100, base: 105, paced: true });
    expect(d.avgDose).toEqual({ abs: 3, pct: 25, base: 12 });
  });
  it('a paced base of 0 shows no change', () =>
    expect(compareTiles(t, { ...t, bagsFinished: 0 }, 7, 90).deltas.bagsFinished).toBeNull());
  it('a baseline with no tracked days has no total to pace (no ∞)', () => {
    const { deltas: d } = compareTiles(t, t, 7, 0);
    expect(d.brews).toBeNull();
    expect(d.avgDose).toEqual({ abs: 0, pct: 0, base: 15 });
  });
});

describe('perPerson', () => {
  const T: OverviewTiles = {
    brews: 13, grams: 195, spend: 30, avgRating: 8, rated: 4, bagsFinished: 1, costPerBrew: 1.5,
    brewsPerDay: 1.3, avgDose: 15, avgRestDays: 10, avgBrewTime: 180
  };
  it('divides totals and brews per day; averages stay', () =>
    expect(perPerson(T, 2)).toEqual({
      ...T, brews: 6.5, grams: 97.5, spend: 15, rated: 2, bagsFinished: 0.5, brewsPerDay: 0.65
    }));
  it('a household of one is the household', () => expect(perPerson(T, 1)).toBe(T));
  it('a missing brews per day stays missing', () =>
    expect(perPerson({ ...T, brewsPerDay: null }, 2).brewsPerDay).toBeNull());
  it('deltas on divided tiles: halved change, same %', () => {
    const prev = { ...T, brews: 10 };
    const h = compareTiles(T, prev, 7, 7).deltas.brews!;
    const p = compareTiles(perPerson(T, 2), perPerson(prev, 2), 7, 7).deltas.brews!;
    expect(p).toEqual({ abs: h.abs / 2, pct: h.pct, base: h.base / 2 });
  });
});

describe('consumption', () => {
  const b = (localDate: string, dose: number) => brew({ localDate, dose });
  const TODAY = '2026-10-10';

  it('grams ÷ tracked days; ×7 and ×30.44; time to clear rounds up, with its date', () => {
    const c = consumption([b('2026-09-01', 150), b('2026-09-30', 150), b('2026-10-01', 99)], SEPT, '2026-01-01', TODAY, 1001);
    expect(c.perDay).toBe(10); // 300 g / 30 days
    expect(c.perWeek).toBe(70);
    expect(c.perMonth).toBeCloseTo(304.4);
    expect(c.daysToClear).toBe(101); // 100.1 → 101
    expect(c.clearBy).toBe('2027-01-19');
  });

  it('an exact multiple gives exactly that many days', () =>
    expect(consumption([b('2026-09-01', 300)], SEPT, '2026-01-01', TODAY, 1000).daysToClear).toBe(100));

  it('counts only tracked days: from the first brew, up to today', () => {
    expect(consumption([b('2026-09-21', 150), b('2026-09-30', 150)], SEPT, '2026-09-21', TODAY, 0).perDay).toBe(30);
    const oct = { start: '2026-10-01', end: '2026-10-31' }; // 10 days so far
    expect(consumption([b('2026-10-05', 100)], oct, '2026-01-01', TODAY, 0).perDay).toBe(10);
  });

  it('per person divides the rate; time to clear is one person alone', () => {
    const c = consumption([b('2026-09-01', 300)], SEPT, '2026-01-01', TODAY, 1000, 2);
    expect(c).toMatchObject({ perDay: 5, perWeek: 35, daysToClear: 200, clearBy: '2027-04-28' });
  });

  it('no brews in the period, or no tracked days: everything missing', () => {
    const none = { perDay: null, perWeek: null, perMonth: null, daysToClear: null, clearBy: null };
    expect(consumption([b('2026-08-01', 100)], SEPT, '2026-01-01', TODAY, 500)).toEqual(none);
    expect(consumption([], SEPT, null, TODAY, 500)).toEqual(none);
  });

  it('nothing on hand: rates, but no time to clear', () =>
    expect(consumption([b('2026-09-01', 300)], SEPT, '2026-01-01', TODAY, 0)).toMatchObject({
      perDay: 10, daysToClear: null, clearBy: null
    }));

  it('grams on hand: remaining grams of open and backlog bags', () =>
    expect(gramsOnHand(
      [
        bag({ id: 1, status: 'open', amountG: 250 }), bag({ id: 2, status: 'backlog', amountG: 340 }),
        bag({ id: 3, status: 'archive', amountG: 1000 }), bag({ id: 4, status: 'backlog', amountG: null })
      ],
      [brew({ coffeeId: 1, dose: 15 }), brew({ coffeeId: 1, dose: 20 }), brew({ coffeeId: 3, dose: 18 })]
    )).toBe(215 + 340));

  it('gramsOnHand floors at 0 (logged past the bag weight)', () =>
    expect(gramsOnHand([bag({ id: 1, status: 'open', amountG: 20 })], [brew({ coffeeId: 1, dose: 15 }), brew({ coffeeId: 1, dose: 15 })])).toBe(0));
});

describe('rightNow', () => {
  const bags = [
    bag({ id: 1, status: 'open', amountG: 250 }),
    bag({ id: 2, status: 'backlog', amountG: 340 }),
    bag({ id: 3, status: 'archive', amountG: 200, lastBrew: '2026-09-10' }), // finished in SEPT
    bag({ id: 4, status: 'archive', amountG: 300, lastBrew: '2026-08-10' }) // finished before
  ];
  const brews = [brew({ coffeeId: 1, dose: 50 })];
  it('snapshot by status (remaining grams) plus finished in the period', () =>
    expect(rightNow(bags, brews, SEPT)).toEqual({
      openedG: 200, unopenedG: 340, onHandG: 540, finishedG: 200, opened: 1, unopened: 1, onHand: 2, finished: 1
    }));
  it('per person splits only the finished values', () =>
    expect(rightNow(bags, brews, SEPT, 2)).toMatchObject({ onHandG: 540, onHand: 2, finishedG: 100, finished: 0.5 }));
});

describe('paceDelta', () => {
  it('compares raw without pacing', () => expect(paceDelta(10, 5, 30, 10, false)).toMatchObject({ abs: 5, base: 5 }));
  it('paces the base to the current length', () => expect(paceDelta(10, 5, 30, 10, true)).toMatchObject({ abs: -5, base: 15 }));
  it('same length: no pacing even when asked', () => expect(paceDelta(10, 5, 30, 30, true)).toMatchObject({ base: 5 }));
  it('no previous days: no delta', () => expect(paceDelta(10, 5, 30, 0, true)).toBeNull());
});
