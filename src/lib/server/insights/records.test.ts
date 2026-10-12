import { describe, it, expect } from 'vitest';
import { pick, RECORDS, recordsTab, type RecordsCtx } from './records';
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
  it('ties name each bag once, at its earliest', () => {
    const h = (label: string, date: string) => ({ label, href: `/coffees/${label}`, date });
    expect(pick([{ value: 1, holder: h('a', '2026-03-02') }, { value: 1, holder: h('a', '2026-03-01') },
                 { value: 1, holder: h('b', '2026-03-03') }, { value: 1, holder: h('a', '2026-03-04') }], 'min'))
      .toEqual({ value: 1, holder: h('a', '2026-03-01'), ties: [h('b', '2026-03-03')] });
  });
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
    expect(run('climb', rated(1, [2.5, 4, 9, 6]))).toMatchObject({ value: 6.5, detail: 'First 2.5 → Best 9 (brew 3 of 4)' }));
  it('hole-in-one counts bags (≥3 rated brews) best on their first brew; holder = highest', () => {
    const p = run('holeInOne', [...rated(1, [9, 8, 8]), ...rated(2, [7, 6, 7]), ...rated(3, [5, 8, 8]), ...rated(4, [9, 1])]);
    expect(p).toMatchObject({ value: 2, detail: 'Of 3 bags with 3+ ratings', holder: { label: 'Bag 1' } });
  });
  it('most consistent needs ≥5 rated brews, lowest SD; detail names the mean', () =>
    expect(run('consistent', [...rated(1, [8.5, 8.5, 8.5, 8.5, 8.5]), ...rated(2, [8, 8, 8, 8])]))
      .toMatchObject({ value: 0, detail: '5 brews at 8.50' }));
  it('best day needs ≥3 rated brews that day', () => {
    const d = (date: string, r: number) => brew({ localDate: date, localTime: `${date}T09:00`, rating: r, coffeeId: 1 });
    expect(run('bestDay', [d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-19', 10)])?.holder.date)
      .toBe('2026-08-18');
  });
  it('most perfect 10s: the bag with the most 10s; ties listed; none → no record', () => {
    expect(run('mostTens', [...rated(1, [10, 9, 10]), ...rated(2, [10, 10]), ...rated(3, [10])]))
      .toMatchObject({ value: 2, holder: { label: 'Bag 1' }, ties: [{ label: 'Bag 2' }] });
    expect(run('mostTens', rated(1, [9, 9.5]))).toBeNull();
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
  it('night owl skips back-filled brews', () => {
    const late = brew({ localTime: '2026-03-01T23:37', decaf: true });
    const later = brew({ localTime: '2026-03-02T23:59', backfilled: true });
    expect(run('nightOwl', [late, later])?.value).toBe(23 * 60 + 37);
  });
  it('clock records turn over at 04:00: 00:40 is a night owl, not an early bird', () => {
    const at = (lt: string) => brew({ localTime: lt });
    const b = [at('2026-03-01T00:40'), at('2026-03-01T05:10'), at('2026-03-01T23:37')];
    expect(run('earlyBird', b)?.value).toBe(5 * 60 + 10);
    expect(run('nightOwl', b)?.value).toBe(24 * 60 + 40); // shown as 12:40 AM
  });
  it('gear tour = distinct brewers on one bag', () =>
    expect(run('gearTour', ['A - x', 'B - y', 'A - x'].map((m) => brew({ coffeeId: 1, brewer: m })))?.value).toBe(2));
});

it('empty facts: no records', () => {
  for (const r of RECORDS) expect(pick(r.run({ brews: [], bags: [], ratings: 'all', today: '2026-10-11' }), r.dir)).toBeNull();
});

const CTX: RecordsCtx = { period: { start: null, end: '2026-10-11' }, prev: null, ratings: 'all', size: 1, today: '2026-10-11' };
const tilesOf = (t: ReturnType<typeof recordsTab>) => t.sections.flatMap((s) => s.tiles);
const tileOf = (t: ReturnType<typeof recordsTab>, k: string) => tilesOf(t).find((x) => x.key === k);

describe('freshness and money', () => {
  it('fastest drinking rate = grams / inclusive days; thin bags are skipped', () => {
    const thin = [brew({ coffeeId: 1, dose: 90, localDate: '2026-03-01' })]; // 90 g/day but 1 day and < 100 g
    const big = [10, 11, 12].flatMap((d) => [1, 2, 3, 4, 5].map(() => brew({ coffeeId: 2, dose: 16.6, localDate: `2026-03-${d}` })));
    const p = run('drinkRate', [...thin, ...big]);
    expect(p).toMatchObject({ holder: { label: 'Bag 2' }, detail: '249g over 3 days' });
    expect(p?.value).toBeCloseTo(83, 6);
  });
  it('fastest finish only counts finished bags', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', status: 'archive', firstBrew: '2026-03-01', lastBrew: '2026-03-04' }),
      bag({ id: 2, name: 'Bag 2', status: 'open', firstBrew: '2026-03-01', lastBrew: '2026-03-02' })];
    const brews = [brew({ coffeeId: 1, localDate: '2026-03-01' }), brew({ coffeeId: 1, localDate: '2026-03-04' }),
      brew({ coffeeId: 2, localDate: '2026-03-01' }), brew({ coffeeId: 2, localDate: '2026-03-02' })];
    expect(run('fastestFinish', brews, bags)).toMatchObject({ value: 4, holder: { label: 'Bag 1' } });
  });
  it('longest wait to open counts rest days net of freezer', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', purchaseDate: '2026-03-01', firstBrew: '2026-03-15' })];
    expect(run('waitToOpen', [brew({ coffeeId: 1, localDate: '2026-03-15', restDays: 10 })], bags)?.value).toBe(10);
  });
  it('oldest bag waiting is net of freezer days', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', status: 'backlog', purchaseDate: '2026-09-01', frozenStart: '2026-09-02', frozenEnd: '2026-09-22' }),
      bag({ id: 2, name: 'Bag 2', status: 'backlog', purchaseDate: '2026-09-20' })];
    expect(run('oldestWaiting', [], bags)).toMatchObject({ value: 21, holder: { label: 'Bag 2' } });
  });
  it('oldest coffee brewed uses rest days net of freezer; freshest is the min', () => {
    const b = [brew({ restDays: 147 }), brew({ restDays: 20 }), brew({ restDays: null })];
    expect(run('oldestBrewed', b)?.value).toBe(147);
    expect(run('freshestBrew', b)?.value).toBe(20);
  });
  it('money skips cost 0/null and amount null', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', cost: 0, amountG: 250, purchaseDate: '2026-03-01' }),
      bag({ id: 2, name: 'Bag 2', cost: 30, amountG: null, purchaseDate: '2026-03-01' }),
      bag({ id: 3, name: 'Bag 3', cost: 20, amountG: 250, purchaseDate: '2026-03-01' })];
    expect(run('priciestBag', [], bags)).toMatchObject({ holder: { label: 'Bag 3' }, value: 8, detail: '$20.00 for 250g' });
  });
  it('best value = mean / $ per 100 g, detail names both', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', cost: 20, amountG: 200 }), bag({ id: 2, name: 'Bag 2', cost: 10, amountG: 100 })];
    const brews = [...rated(1, [8, 8, 8]), ...rated(2, [9, 9, 9])];
    expect(run('bestValue', brews, bags)).toMatchObject({ holder: { label: 'Bag 2' }, value: 0.9, mean: 9, per100: 10, detail: '9.00 at $10.00/100\u00a0g' });
    expect(run('toughValue', brews, bags)).toMatchObject({ holder: { label: 'Bag 1' }, value: 0.8 });
  });
  it('biggest buying month is all-time, by bags', () => {
    expect(RECORDS.find((r) => r.key === 'buyingMonth')!.scope).toBe('alltime');
    const bags = [bag({ id: 1, purchaseDate: '2026-03-02', cost: 10 }), bag({ id: 2, purchaseDate: '2026-03-20', cost: 15 }), bag({ id: 3, purchaseDate: '2026-04-01' })];
    expect(run('buyingMonth', [], bags)).toMatchObject({ value: 2, holder: { label: '2026-03' }, detail: '$25.00 spent' });
  });
  it('roaster records group bags by roaster', () => {
    const bags = [bag({ id: 1, roaster: 'A', cost: 10, purchaseDate: '2026-03-02' }), bag({ id: 2, roaster: 'A', cost: 15, purchaseDate: '2026-03-20' }),
      bag({ id: 3, roaster: 'B', cost: 40, purchaseDate: '2026-03-21' })];
    expect(run('roasterBags', [], bags)).toMatchObject({ value: 2, holder: { label: 'A' }, detail: '$25.00 spent' });
    expect(run('roasterSpend', [], bags)).toMatchObject({ value: 40, holder: { label: 'B' }, detail: '1 bag bought' });
  });
  it('cups: priciest and cheapest, detail = dose at the bag price', () => {
    const bags = [bag({ id: 1, name: 'Bag 1', cost: 25, amountG: 250 })];
    const b = [brew({ costPerBrew: 1.5, dose: 15 }), brew({ costPerBrew: 0.4 })];
    expect(run('priciestCup', b, bags)).toMatchObject({ value: 1.5, detail: '15g at $10.00/100\u00a0g' });
    expect(run('cheapestCup', b, bags)?.value).toBe(0.4);
  });
});

describe('floors and junk', () => {
  it('pour-over ratio floor 1:12 and brew-time floor 60 s', () => {
    const b = [brew({ ratio: 6.7 }), brew({ ratio: 15 }), brew({ brewTimeSeconds: 30 }), brew({ brewTimeSeconds: 200 })];
    expect(run('ratioShort', b)?.value).toBe(15);
    expect(run('ratioLong', [brew({ ratio: 16, dose: 15, waterG: 240 })])?.detail).toBe('15g to 240g');
    expect(run('brewTimeShort', b)?.value).toBe(200);
  });
  it('soup has no floors', () =>
    expect(run('ratioShort', [brew({ ratio: 6.7, brewerType: 'soup' })])?.value).toBe(6.7));
  it('dose, bloom, water extremes', () => {
    const b = [brew({ dose: 12, bloomSeconds: 20, waterG: 200 }), brew({ dose: 25, bloomSeconds: 45, waterG: 400 })];
    expect([run('doseHeavy', b)?.value, run('doseLight', b)?.value, run('bloomLong', b)?.value, run('bloomShort', b)?.value,
      run('waterMost', b)?.value]).toEqual([25, 12, 45, 20, 400]);
  });
  it('brew-held records skip brews without a bag', () =>
    expect(run('doseHeavy', [brew({ coffeeId: null, dose: 99 }), brew({ dose: 20 })])?.value).toBe(20));
  it('grind extremes per grinder, malformed skipped', () => {
    const t = recordsTab([brew({ grinder: 'A4Z', grind: '2.4.1' }), brew({ grinder: 'A4Z', grind: '1..5.0' }),
      brew({ grinder: 'A4Z', grind: '3.2' }), brew({ grinder: 'ZP6', grind: '5.5' })], BAGS, CTX);
    const ex = t.sections.find((s) => s.key === 'extremes')!.tiles;
    expect(ex.map((x) => x.key)).toEqual(expect.arrayContaining(['grindFine:A4Z', 'grindCoarse:A4Z', 'grindFine:ZP6']));
    expect(ex.find((x) => x.key === 'grindFine:A4Z')!.detail).toBe('2.4.1');
    expect(ex.find((x) => x.key === 'grindCoarse:A4Z')!.detail).toBe('3.2');
  });
  it('brewer with no brews hides extremes', () =>
    expect(recordsTab([brew({ dose: 20 })], BAGS, { ...CTX, brewer: 'soup' }).sections.find((s) => s.key === 'extremes')).toBeUndefined());
});

describe('gentle', () => {
  it('lowest-rated bag, biggest drop, least consistent, slowest to peak', () => {
    const b = [...rated(1, [8, 4, 6, 9, 5]), ...rated(2, [7, 7, 7])];
    expect(run('lowestBag', b)?.holder.label).toBe('Bag 1');
    expect(run('lowestBag', b)?.value).toBeCloseTo(6.4, 9);
    expect(run('biggestDip', b)).toMatchObject({ value: 4, detail: '8 → 4' });
    expect(run('wildest', b)).toMatchObject({ holder: { label: 'Bag 1' }, detail: 'Ratings ranged 4–9 over 5 brews' });
    expect(run('slowestPeak', b)).toMatchObject({ value: 4, detail: 'Best brew was #4 of 5' });
  });
  it('toughest day is the lowest day with 3+ rated brews', () => {
    const d = (date: string, r: number) => brew({ localDate: date, localTime: `${date}T09:00`, rating: r });
    expect(run('toughDay', [d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-18', 9), d('2026-08-19', 4), d('2026-08-19', 4), d('2026-08-19', 4)])?.holder.date)
      .toBe('2026-08-19');
  });
  it('least favourite roaster needs 3+ bags', () => {
    const mk = (roaster: string, ids: number[], r: number) => ids.flatMap((id) => rated(id, [r, r, r]).map((b) => ({ ...b, roaster })));
    const brews = [...mk('A', [1, 2, 3], 5), ...mk('B', [4, 5], 3), ...mk('C', [6, 7, 8], 9)];
    const bags = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => bag({ id, name: `Bag ${id}` }));
    // Your average = mean of bag means, 6; A adjusted (3×5 + 5×6) / 8 = 5.625 → −0.375 (ranked), raw 5 → −1 (shown).
    expect(run('leastRoaster', brews, bags)).toMatchObject({ value: -0.375, mean: -1, holder: { label: 'A' } });
    expect(run('leastRoaster', mk('A', [1, 2, 3], 5), bags)).toBeNull(); // one group is the average
  });
});

describe('recordsTab', () => {
  const at = (id: number, date: string, ratings: number[]) => rated(id, ratings, date);
  const history = [...at(3, '2026-01-10', [10, 10, 10]), ...at(2, '2026-02-10', [8, 8, 8]), ...at(1, '2026-03-05', [9, 9, 9])];
  const march = { start: '2026-03-01', end: '2026-03-31' };
  it('allTime is null when the period holder is the all-time record', () => {
    const t = recordsTab(history, BAGS, CTX);
    expect(tileOf(t, 'bestBag')).toMatchObject({ value: 10, holder: { label: 'Bag 3' }, allTime: null });
  });
  it('allTime holds the all-time record otherwise; was = compare holder', () => {
    const t = recordsTab(history, BAGS, { ...CTX, period: march, prev: { start: '2026-02-01', end: '2026-02-28' } });
    const tile = tileOf(t, 'bestBag')!;
    expect(tile).toMatchObject({ value: 9, holder: { label: 'Bag 1' } });
    expect(tile.allTime).toMatchObject({ value: 10, holder: { label: 'Bag 3' } });
    expect(tile.was).toMatchObject({ value: 8, holder: { label: 'Bag 2' } });
  });
  it('all-time records ignore the period', () => {
    const bags = [bag({ id: 1, purchaseDate: '2026-01-02', cost: 20, amountG: 250 }), bag({ id: 2, purchaseDate: '2026-01-20' })];
    const t = recordsTab([], bags, { ...CTX, period: march });
    expect(tileOf(t, 'buyingMonth')).toMatchObject({ value: 2, scope: 'alltime', allTime: null });
    expect(tileOf(t, 'roasterBags')).toBeUndefined(); // bought outside March
    expect(tileOf(t, 'priciestBag')).toBeUndefined();
  });
  it('people split divides perDay records only', () => {
    const MARATHON = 6, MOST_BREWED = 8;
    const MANY = [...rated(1, Array(MARATHON).fill(8), '2026-04-01'), ...rated(1, [8, 8], '2026-04-02')];
    const t = recordsTab(MANY, BAGS, { ...CTX, size: 2 });
    expect(tileOf(t, 'marathon')!.value).toBe(MARATHON / 2);
    expect(tileOf(t, 'mostBrewedBag')!.value).toBe(MOST_BREWED);
  });
  it('topBrews <= 50 best first; perfectTens = bags with a 10, with counts', () => {
    const r = [10, 9.5, 9, 10, 9, 9.5, 9, 9, 10, 9, 9, 9.5, ...Array(48).fill(8)];
    const t = recordsTab(r.map((rating, i) => brew({ coffeeId: 1, rating, localDate: `2026-05-${String(i + 1).padStart(2, '0')}` })), BAGS, CTX);
    expect(t.topBrews.map((x) => x.rating)).toEqual([10, 10, 10, 9.5, 9.5, 9.5, 9, 9, 9, 9, 9, 9, ...Array(38).fill(8)]);
    expect(t.perfectTens).toMatchObject([{ holder: { label: 'Bag 1' }, count: 3 }]);
  });
  it('brewerTypes: present all-time, in BREWER_TYPES order; sections in order, empty omitted', () => {
    const t = recordsTab([brew({ brewerType: 'soup', dose: 10 }), brew({ brewerType: 'pourover', dose: 12 })], BAGS, CTX);
    expect(t.brewerTypes).toEqual(['pourover', 'soup']);
    expect(t.sections.map((s) => s.key)).toEqual(['volume', 'extremes']);
  });
  it('topCoffees: bags with 3+ rated brews by mean, best first', () => {
    const t = recordsTab([...rated(1, [8, 8, 8]), ...rated(2, [9, 9, 9, 9]), ...rated(3, [10, 10])], BAGS, CTX);
    expect(t.topCoffees).toMatchObject([{ mean: 9, brews: 4, holder: { label: 'Bag 2' } }, { mean: 8, brews: 3, holder: { label: 'Bag 1' } }]);
  });
  it('caffeine filters brews and bags; brewer types stay all-time', () => {
    const bags = [bag({ id: 1, name: 'Caf', cost: 30, amountG: 250, purchaseDate: '2026-03-01' }),
      bag({ id: 2, name: 'Dec', decaf: true, cost: 10, amountG: 250, purchaseDate: '2026-03-01' })];
    const b = [brew({ coffeeId: 1, dose: 20, brewerType: 'soup' }), brew({ coffeeId: 2, dose: 12, decaf: true })];
    const t = recordsTab(b, bags, { ...CTX, caffeine: 'decaf' });
    expect(tileOf(t, 'doseHeavy')!.value).toBe(12);
    expect(tileOf(t, 'priciestBag')!.holder.label).toBe('Dec');
    expect(t.brewerTypes).toEqual(['pourover', 'soup']);
    expect(tileOf(recordsTab(b, bags, { ...CTX, caffeine: 'caf' }), 'doseLight')!.value).toBe(20);
  });
  it('coversAll when the period spans the first to the last brew', () => {
    const b = [brew({ localDate: '2026-09-01', dose: 10 })];
    expect(recordsTab(b, BAGS, { ...CTX, period: { start: '2026-08-01', end: '2026-10-11' } }).coversAll).toBe(true);
    expect(recordsTab(b, BAGS, { ...CTX, period: { start: '2026-09-02', end: '2026-10-11' } }).coversAll).toBe(false);
    expect(recordsTab(b, BAGS, CTX).coversAll).toBe(true);
    // A window ending before the last brew (a past year) doesn't cover it all.
    const later = [...b, brew({ localDate: '2026-10-01', dose: 10 })];
    expect(recordsTab(later, BAGS, { ...CTX, period: { start: '2026-08-01', end: '2026-09-01' } }).coversAll).toBe(false);
    expect(recordsTab(later, BAGS, { ...CTX, period: { start: '2026-08-01', end: '2026-10-01' } }).coversAll).toBe(true);
  });
  it('brewer switch limits extremes only', () => {
    const b = [brew({ brewerType: 'soup', dose: 40 }), brew({ brewerType: 'pourover', dose: 15 })];
    const t = recordsTab(b, BAGS, { ...CTX, brewer: 'pourover' });
    expect(tileOf(t, 'doseHeavy')!.value).toBe(15);
    expect(tileOf(t, 'mostBrewedBag')!.value).toBe(2);
  });
});

it('every record detail reads as a sentence: no lowercase first letter', () => {
  const bags = [1, 2, 3, 4].map((id) => bag({
    id, name: `Bag ${id}`, roaster: id < 3 ? 'A' : 'B', cost: 20 + id, amountG: 250, purchaseDate: '2026-03-01',
    status: id === 4 ? 'backlog' : 'archive', firstBrew: id === 4 ? null : '2026-03-02', lastBrew: id === 4 ? null : '2026-03-05'
  }));
  const brews = [1, 2, 3].flatMap((id) => [10, 6, 9, 4, 10, 8].map((rating, i) => brew({
    coffeeId: id, rating, localDate: `2026-03-0${2 + (i % 4)}`, localTime: `2026-03-0${2 + (i % 4)}T0${i}:1${id}`,
    dose: 15 + i, waterG: 250, ratio: 250 / (15 + i), restDays: 10 + i, costPerBrew: 1 + i / 10,
    brewTimeSeconds: 120 + i, bloomSeconds: 30 + i, brewer: `D${i} - F`, dripper: `D${i}`, water: 'RO', roaster: id < 3 ? 'A' : 'B'
  })));
  const lower = RECORDS.flatMap((r) => {
    const p = pick(r.run({ brews, bags, ratings: 'all', today: '2026-10-11' }), r.dir);
    return p?.detail && /^[a-z]/.test(p.detail) ? [`${r.key}: ${p.detail}`] : [];
  });
  expect(lower).toEqual([]);
});
