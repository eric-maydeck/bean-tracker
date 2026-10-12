import { describe, it, expect } from 'vitest';
import { LADDERS, thresholds, crossed, nextThreshold, brewDayThresholds, brewDayTitle, countEvents, streakEvents } from './milestones';
import type { BrewFact, BagFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, ...o
});
// n brews, one per day from 2026-01-01 (day i is Jan i+1 .. rolled via Date).
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const daily = (n: number, o: Partial<BrewFact> = {}, start = 0): BrewFact[] =>
  Array.from({ length: n }, (_, i) => brew({ id: start + i, localDate: day(start + i), localTime: `${day(start + i)}T08:00`, ...o }));

describe('ladders', () => {
  it('brews: early values, every 500 to 10,000, then every 1,000', () => {
    expect(thresholds(LADDERS.brews, 2000)).toEqual([1, 10, 50, 100, 250, 500, 1000, 1500, 2000]);
    expect(crossed(LADDERS.brews, 9999, 11000)).toEqual([10000, 11000]);
    expect(nextThreshold(LADDERS.brews, 1365)).toBe(1500);
  });
  it('kg: 1,2,5,10; 5s to 50; 10s to 100; 50s to 500; then 100s', () => {
    expect(thresholds(LADDERS.kgBrewed, 120)).toEqual([1, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]);
    expect(crossed(LADDERS.kgBrewed, 480, 620)).toEqual([500, 600]);
  });
  it('mileage: 100, 250, 500, 1000; 500s to 5000; then 1000s', () =>
    expect(crossed(LADDERS.mileage, 900, 6100)).toEqual([1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000]));
  it('roaster depth: 10, 25, 50, 100; 50s to 500; then 100s', () =>
    expect(thresholds(LADDERS.perRoaster, 200)).toEqual([10, 25, 50, 100, 150, 200]));
  it('brew days and streaks', () => {
    expect(brewDayThresholds(500)).toEqual([1, 7, 30, 100, 200, 300, 365, 400, 500]);
    expect(brewDayThresholds(800)).toContain(730);
    expect(thresholds(LADDERS.streak, 800)).toEqual([7, 14, 30, 50, 100, 150, 365, 730]);
  });
});

describe('count and streak events', () => {
  it('one step crosses two thresholds → two events, same date', () => {
    const bags = [bag({ id: 1, amountG: 4800, purchaseDate: '2026-02-01' }), bag({ id: 2, amountG: 1000, purchaseDate: '2026-03-01' })];
    const ev = countEvents([], bags).filter((e) => e.key.startsWith('kgBought'));
    expect(ev.map((e) => [e.key, e.date])).toEqual([['kgBought:1', '2026-02-01'], ['kgBought:2', '2026-02-01'],
      ['kgBought:5', '2026-03-01']]);
  });
  it('the 1000th brew is dated at the 1000th brew', () => {
    const ev = countEvents(daily(1000, { coffeeId: 1 }), [bag({ id: 1, name: 'Ethiopia', slug: 'eth' })]).find((e) => e.key === 'brews:1000')!;
    expect(ev.date).toBe(day(999));
    expect(ev.title).toBe('1000th brew');
    expect(ev.kind).toBe('counts');
    expect(ev.href).toBe('/coffees/eth');
  });
  it('water poured in litres', () => {
    const ev = countEvents(daily(40, { waterG: 250 }), []).filter((e) => e.key.startsWith('waterL'));
    expect(ev.map((e) => [e.key, e.title, e.date])).toEqual([['waterL:10', '10 L of water poured', day(39)]]);
  });
  it('streak thresholds fire on the day reached; a broken run restarts', () => {
    // 8 days, a gap, then 7 days
    const days = [...Array.from({ length: 8 }, (_, i) => day(i)), ...Array.from({ length: 7 }, (_, i) => day(10 + i))];
    const ev = streakEvents(days);
    expect(ev.map((e) => [e.title, e.date, e.kind])).toEqual([['7-day streak', day(6), 'streaks'], ['7-day streak', day(16), 'streaks']]);
    expect(new Set(ev.map((e) => e.key)).size).toBe(2);
  });
  it('brew-day titles roll up', () => {
    expect(brewDayTitle(7)).toBe('A week of brew days');
    expect(brewDayTitle(30)).toBe('A month of brew days');
    expect(brewDayTitle(365)).toBe("A year's worth of brew days");
    expect(brewDayTitle(730)).toBe("Two years' worth of brew days");
    expect(brewDayTitle(100)).toBe('100 brew days');
  });
});
