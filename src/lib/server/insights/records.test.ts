import { describe, it, expect } from 'vitest';
import { pick, RECORDS } from './records';
import type { BrewFact, BagFact } from './facts';
import type { Ratings } from '$lib/insightsUrl';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 0, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, ...o
});
const BAGS = [1, 2, 3, 4].map((id) => bag({ id, name: `Bag ${id}`, slug: `bag-${id}` }));
// Consecutive rated brews of one bag, one per ten minutes from 09:00.
const rated = (coffeeId: number, ratings: number[], date = '2026-07-01'): BrewFact[] =>
  ratings.map((rating, i) => {
    const m = 540 + i * 10;
    const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
    return brew({ coffeeId, rating, localDate: date, localTime: `${date}T${hh}:${mm}` });
  });
const run = (key: string, brews: BrewFact[], bags: BagFact[] = BAGS, ratings: Ratings = 'all') =>
  pick(RECORDS.find((r) => r.key === key)!.run({ brews, bags, ratings, today: '2026-10-11' }),
       RECORDS.find((r) => r.key === key)!.dir);

describe('pick', () => {
  it('ties: earliest wins, rest listed in date order', () => {
    const h = (date: string) => ({ label: date, date });
    expect(pick([{ value: 9, holder: h('2026-03-02') }, { value: 9, holder: h('2026-03-01') },
                 { value: 8, holder: h('2026-01-01') }], 'max'))
      .toEqual({ value: 9, holder: h('2026-03-01'), ties: [h('2026-03-02')] });
  });
  it('empty → null', () => expect(pick([], 'max')).toBeNull());
});

describe('taste', () => {
  it('best bag needs ≥3 counted rated brews', () => {
    const brews = [...rated(1, [9, 9]), ...rated(2, [8, 8, 8])];
    expect(run('bestBag', brews)?.holder.label).toBe('Bag 2');
  });
  it('dialed in = mean of the top ⌈n/2⌉', () =>
    expect(run('bestBagDialed', rated(1, [5, 9, 10]))?.value).toBe(9.5));
  it('biggest dial-in jump between consecutive rated brews', () => {
    const p = run('dialJump', rated(1, [1, 8.5, 7]));
    expect(p).toMatchObject({ value: 7.5, detail: '1 → 8.5' });
  });
  it('biggest climb: first → best', () =>
    expect(run('climb', rated(1, [2.5, 4, 9, 6]))).toMatchObject({ value: 6.5, detail: '2.5 → 9 at brew 3 of 4' }));
  it('hole-in-one counts bags best on their first brew; holder = highest', () => {
    const p = run('holeInOne', [...rated(1, [9, 8, 8]), ...rated(2, [7, 6]), ...rated(3, [5, 8])]);
    expect(p).toMatchObject({ value: 2, holder: { label: 'Bag 1' } });
  });
  it('most consistent needs ≥5 rated brews, lowest SD', () =>
    expect(run('consistent', [...rated(1, [8.5, 8.5, 8.5, 8.5, 8.5]), ...rated(2, [8, 8, 8, 8])])?.value).toBe(0));
  it('best day needs ≥3 rated brews that day', () => {
    const d = (date: string, r: number) => brew({ localDate: date, localTime: `${date}T09:00`, rating: r, coffeeId: 1 });
    expect(run('bestDay', [d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-19', 10)])?.holder.date)
      .toBe('2026-08-18');
  });
  it('best decaf only among decaf bags; omitted when none', () => {
    expect(run('bestDecaf', rated(1, [9, 9, 9]))).toBeNull();
    expect(run('bestDecaf', rated(4, [7, 7, 7]).map((b) => ({ ...b, decaf: true })))?.value).toBe(7);
  });
  it('Current excludes pre-2026-06-01 ratings', () =>
    expect(run('bestBag', rated(1, [9, 9, 9], '2026-05-01'), BAGS, 'current')).toBeNull());
});

describe('volume', () => {
  it('rolling 24 h windows are not calendar days', () => {
    const t = (lt: string) => brew({ localTime: lt, localDate: lt.slice(0, 10), dose: 20 });
    const brews = [t('2026-03-01T20:00'), t('2026-03-02T08:00'), t('2026-03-02T19:00'), t('2026-03-03T21:00')];
    expect(run('brews24h', brews)?.value).toBe(3);
    expect(run('grams24h', brews)?.value).toBe(60);
  });
  it('marathon = most brews of one bag in one calendar day', () =>
    expect(run('marathon', [...rated(1, [8, 8, 8], '2026-04-15'), ...rated(2, [8, 8], '2026-04-15')])?.value).toBe(3));
  it('night owl (caffeinated) skips decaf; back-filled brews skipped', () => {
    const late = brew({ localTime: '2026-03-01T23:37', decaf: true });
    const later = brew({ localTime: '2026-03-02T23:59', backfilled: true });
    const caf = brew({ localTime: '2026-03-03T22:10' });
    expect(run('nightOwl', [late, later, caf])?.value).toBe(23 * 60 + 37);
    expect(run('nightOwlCaf', [late, later, caf])?.value).toBe(22 * 60 + 10);
  });
  it('gear tour = distinct brewers on one bag', () =>
    expect(run('gearTour', ['A - x', 'B - y', 'A - x'].map((m) => brew({ coffeeId: 1, brewer: m })))?.value).toBe(2));
});

it('empty facts: no records', () => {
  for (const r of RECORDS) expect(pick(r.run({ brews: [], bags: [], ratings: 'all', today: '2026-10-11' }), r.dir)).toBeNull();
});
