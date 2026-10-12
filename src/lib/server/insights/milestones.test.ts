import { describe, it, expect } from 'vitest';
import { LADDERS, thresholds, crossed, nextThreshold, brewDayThresholds, brewDayTitle, countEvents, streakEvents, firstEvents, bestEvents, gearEvents, anniversaryEvents, milestonesTab } from './milestones';
import { periodBounds } from './time';
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
  it('kg totals sum in grams: 50 x 20 g hits 1 kg on the 50th brew', () => {
    const ev = countEvents(daily(50, { dose: 20 }), []).find((e) => e.key === 'kgBrewed:1')!;
    expect(ev.date).toBe(day(49));
    const big = countEvents(daily(5000, { dose: 20 }), []).find((e) => e.key === 'kgBrewed:100')!;
    expect(big.date).toBe(day(4999));
  });
  it('nines count rated 9+ brews; bagsFinished counts archived bags with a last brew', () => {
    const brews = [brew({ rating: 9, localDate: '2026-02-01' }), brew({ rating: 8.5, localDate: '2026-02-02', localTime: '2026-02-02T08:00' })];
    expect(countEvents(brews, []).filter((e) => e.key.startsWith('nines')).map((e) => [e.key, e.date])).toEqual([['nines:1', '2026-02-01']]);
    const bags = [bag({ id: 1, status: 'archive', lastBrew: '2026-03-01' }), bag({ id: 2, status: 'archive' }), bag({ id: 3, lastBrew: '2026-03-02' })];
    expect(countEvents([], bags).filter((e) => e.key.startsWith('bagsFinished')).map((e) => [e.key, e.date])).toEqual([['bagsFinished:1', '2026-03-01']]);
  });
  it('brew-day titles roll up', () => {
    expect(brewDayTitle(7)).toBe('A week of brew days');
    expect(brewDayTitle(30)).toBe('A month of brew days');
    expect(brewDayTitle(365)).toBe("A year's worth of brew days");
    expect(brewDayTitle(730)).toBe("Two years' worth of brew days");
    expect(brewDayTitle(100)).toBe('100 brew days');
  });
});

const BAGS = [bag({ id: 1, roaster: 'H&S', name: 'Ethiopia', slug: 'eth' })];
const keys = (ev: { key: string }[]) => ev.map((e) => e.key);
const at = (d: string, o: Partial<BrewFact> = {}) => brew({ localDate: d, localTime: `${d}T08:00`, ...o });
const ctx = (o: Partial<Parameters<typeof milestonesTab>[2]> = {}) =>
  ({ period: periodBounds('all', '2026-10-11'), prev: null, ratings: 'all' as const, today: '2026-10-11', ...o });

describe('firsts', () => {
  it('roaster, origin, process group, roast level, decaf, dripper, filter, grinder, water, brewer type', () => {
    const one = { roaster: 'H&S', origin: 'Kenya', processGroup: 'Washed' as const, roastLevel: 'Light', decaf: true, dripper: 'V60', filter: 'Abaca', grinder: 'Q2', water: 'RO' };
    const ev = firstEvents([at('2026-02-09', { ...one, brewerType: 'pourover' }), at('2026-03-01', { ...one, brewerType: 'soup' })], BAGS);
    expect(keys(ev)).toEqual(expect.arrayContaining(['first:roaster:H&S', 'first:origin:Kenya', 'first:process:Washed', 'first:roast:Light', 'first:decaf',
      'first:dripper:V60', 'first:filter:Abaca', 'first:grinder:Q2', 'first:water:RO', 'first:type:pourover', 'first:type:soup']));
    expect(ev.filter((e) => e.key === 'first:roaster:H&S')).toHaveLength(1);
    expect(ev.find((e) => e.key === 'first:type:soup')).toMatchObject({ date: '2026-03-01', title: 'First soup brew', kind: 'firsts' });
    expect(keys(firstEvents([at('2026-02-09', { brewerType: 'other' })], BAGS)).some((k) => k.startsWith('first:type'))).toBe(false);
    expect(ev.find((e) => e.key === 'first:roaster:H&S')).toMatchObject({ title: 'First roaster: H&S', href: '/coffees/eth' });
  });
  it('N/A origin and the mixed filter are skipped', () => {
    const ev = firstEvents([at('2026-02-09', { origin: 'N/A', filter: '155 (mixed)' })], BAGS);
    expect(keys(ev).filter((k) => /origin|filter/.test(k))).toEqual([]);
  });
  it('nth roaster / origin ever on the bag ladder', () => {
    const bags = Array.from({ length: 10 }, (_, i) => bag({ id: i + 1, roaster: `R${i}`, origin: `O${i}`, purchaseDate: day(i) }));
    const ev = firstEvents([], bags);
    expect(ev.find((e) => e.key === 'roasters:10')).toMatchObject({ title: '10th roaster', date: day(9), kind: 'firsts' });
    expect(ev.find((e) => e.key === 'origins:10')!.title).toBe('10th origin');
    expect(keys(ev).filter((k) => k.startsWith('roasters:'))).toEqual(['roasters:1', 'roasters:10']);
  });
  it('per-roaster depth: 10th bag from H&S', () => {
    const bags = Array.from({ length: 10 }, (_, i) => bag({ id: i + 1, roaster: 'H&S', purchaseDate: day(i) }));
    const ev = firstEvents([], bags).find((e) => e.key === 'perRoaster:H&S:10')!;
    expect(ev).toMatchObject({ title: '10th bag from H&S', date: day(9), kind: 'firsts' });
  });
});

describe('bests', () => {
  const rated = [at('2026-03-01', { rating: 8 }), at('2026-03-02', { rating: 7 }), at('2026-03-03', { rating: 9 })];
  it('new personal-best brew follows Current/All', () => {
    const ev = bestEvents(rated, BAGS, 'all').filter((e) => e.key.startsWith('best:brew'));
    expect(ev.map((e) => [e.key, e.date, e.rating])).toEqual([['best:brew:8', '2026-03-01', true], ['best:brew:9', '2026-03-03', true]]);
    const cur = [at('2026-05-01', { rating: 9.5 }), at('2026-06-02', { rating: 8 })];
    expect(keys(bestEvents(cur, BAGS, 'current').filter((e) => e.key.startsWith('best:brew')))).toEqual(['best:brew:8']);
  });
  it('best bag needs 3 rated brews and a strictly higher mean', () => {
    const ev = bestEvents(rated, BAGS, 'all').filter((e) => e.key.startsWith('best:bag'));
    expect(ev.map((e) => [e.date, e.title])).toEqual([['2026-03-03', 'New best bag: Ethiopia']]);
    const two = bestEvents(rated.slice(0, 2), BAGS, 'all').filter((e) => e.key.startsWith('best:bag'));
    expect(two).toEqual([]);
  });
  it('busiest-day record broken (first day only sets the bar)', () => {
    const dayOf = (d: string, n: number) => Array.from({ length: n }, (_, i) => brew({ localDate: d, localTime: `${d}T0${i}:00` }));
    const ev = bestEvents([...dayOf('2026-03-01', 3), ...dayOf('2026-03-02', 2), ...dayOf('2026-03-03', 5)], BAGS, 'all').filter((e) => e.key.startsWith('best:day'));
    expect(ev.map((e) => [e.key, e.date, e.kind])).toEqual([['best:day:5', '2026-03-03', 'bests']]);
  });
});

describe('gear mileage', () => {
  it('per brewer, dripper and water; 100 brews on V60', () => {
    const ev = gearEvents(daily(100, { brewer: 'V60 - Abaca', dripper: 'V60', water: 'RO' }));
    expect(keys(ev).sort()).toEqual(['mileage:brewer:V60 - Abaca:100', 'mileage:dripper:V60:100', 'mileage:water:RO:100']);
    expect(ev.find((e) => e.key === 'mileage:dripper:V60:100')).toMatchObject({ title: '100th brew on V60', date: day(99), kind: 'gear' });
    expect(ev.find((e) => e.key === 'mileage:water:RO:100')!.title).toBe('100th brew with RO');
  });
  it('keeps climbing past 1000', () => {
    expect(keys(gearEvents(daily(1500, { dripper: 'V60' }))).slice(-2)).toEqual(['mileage:dripper:V60:1000', 'mileage:dripper:V60:1500']);
  });
});

describe('anniversaries', () => {
  const first = [bag({ id: 1, roaster: 'A', purchaseDate: '2026-01-19' })];
  it('tracking, roaster >= 5 bags, gear used in the last 60 days', () => {
    const fiveBags = Array.from({ length: 5 }, (_, i) => bag({ id: 10 + i, roaster: 'Five', purchaseDate: `2026-01-2${i}` }));
    const fourBags = Array.from({ length: 4 }, (_, i) => bag({ id: 20 + i, roaster: 'Four', purchaseDate: `2026-01-2${i}` }));
    const brews = [at('2026-02-09', { dripper: 'Old', water: 'RO' }), at('2026-08-01', { dripper: 'Old' }), at('2026-10-05', { dripper: 'V60' })];
    const ev = anniversaryEvents(brews, [...first, ...fiveBags, ...fourBags], '2027-02-10');
    const find = (k: string) => ev.find((e) => e.key === k);
    expect(find('ann:bag:1')).toMatchObject({ date: '2026-02-19', title: '1 month since the first bag', kind: 'anniversaries' });
    expect(find('ann:bag:12')).toMatchObject({ date: '2027-01-19', title: '1 year since the first bag' });
    expect(find('ann:brew:12')).toMatchObject({ date: '2027-02-09', title: '1 year since the first brew' });
    expect(find('ann:roaster:Five:12')).toMatchObject({ date: '2027-01-20', title: '1 year with Five' });
    expect(keys(ev).some((k) => k.startsWith('ann:roaster:Four'))).toBe(false);
    expect(find('ann:dripper:V60:12')).toBeUndefined(); // V60 started 2026-10-05: not a year yet
    expect(keys(ev).some((k) => k.startsWith('ann:dripper:Old'))).toBe(false); // last used 2026-08-01: 193 days ago
  });
  it('gear anniversary needs a brew in the last 60 days', () => {
    const brews = [at('2026-02-09', { dripper: 'V60' }), at('2027-01-01', { dripper: 'V60' }), at('2026-01-01', { dripper: 'Gone' })];
    const ev = anniversaryEvents(brews, [], '2027-02-20');
    expect(keys(ev)).toContain('ann:dripper:V60:12');
    expect(keys(ev).some((k) => k.includes('Gone'))).toBe(false);
    const stale = anniversaryEvents([at('2026-02-09', { dripper: 'V60' }), at('2026-12-12', { dripper: 'V60' })], [], '2027-02-20'); // 70 days
    expect(keys(stale).some((k) => k.startsWith('ann:dripper'))).toBe(false);
  });
  it('rating scale anniversary at 6 months and 1 year', () => {
    expect(anniversaryEvents([], [], '2027-06-01').filter((e) => e.key.startsWith('ann:ratings')).map((e) => [e.date, e.title]))
      .toEqual([['2026-12-01', '6 months of the Current rating scale'], ['2027-06-01', '1 year of the Current rating scale']]);
    expect(anniversaryEvents([], [], '2026-11-30')).toEqual([]);
  });
});

describe('milestonesTab', () => {
  it('period filters events; thresholds count all-time', () => {
    const brews = Array.from({ length: 1000 }, (_, i) => at(day(i % 200 + 31), { id: i, localTime: `${day(i % 200 + 31)}T${String(Math.floor(i / 200) + 6).padStart(2, '0')}:00` }));
    const aug = { start: '2026-08-01', end: '2026-08-31' };
    const tab = milestonesTab(brews, BAGS, ctx({ period: aug }));
    const all = tab.months.flatMap((m) => m.events);
    expect(all.every((e) => e.date >= '2026-08-01' && e.date <= '2026-08-31')).toBe(true);
    expect(tab.months.map((m) => m.month)).toEqual(['2026-08']);
    expect(all.some((e) => e.key === 'brews:1000')).toBe(true);
  });
  it('kinds filter', () => {
    const brews = [at('2026-02-09', { roaster: 'H&S' })];
    const tab = milestonesTab(brews, BAGS, ctx({ kinds: ['firsts'] }));
    const ev = tab.months.flatMap((m) => m.events);
    expect(ev.length).toBeGreaterThan(0);
    expect(new Set(ev.map((e) => e.kind))).toEqual(new Set(['firsts']));
  });
  it('months and events are newest first', () => {
    const tab = milestonesTab([at('2026-02-09', { roaster: 'A' }), at('2026-03-05', { roaster: 'B' })], BAGS, ctx({ kinds: ['firsts'] }));
    expect(tab.months.map((m) => m.month)).toEqual(['2026-03', '2026-02']);
  });
  it('summary and compare summary', () => {
    const brews = [at('2026-02-09', { roaster: 'A', rating: 8 }), at('2026-03-05', { roaster: 'B', rating: 9 })];
    const feb = { start: '2026-02-01', end: '2026-02-28' }, mar = { start: '2026-03-01', end: '2026-03-31' };
    const tab = milestonesTab(brews, [], ctx({ period: mar, prev: feb, kinds: ['firsts', 'bests'] }));
    // March: first roaster B (process and type already seen) + new best brew 9
    expect(tab.summary).toEqual({ total: 2, firsts: 1, bests: 1 });
    // February: first roaster A, process Washed and pour-over type, plus best brew 8 (day one sets no busiest-day record)
    expect(tab.summaryPrev).toEqual({ total: 4, firsts: 3, bests: 1 });
    expect(milestonesTab(brews, [], ctx()).summaryPrev).toBeNull();
  });
  it('next up: closest thresholds by fraction done, from all-time totals', () => {
    const brews = daily(1365).map((b, i) => ({ ...b, coffeeId: i % 3 }));
    const tab = milestonesTab(brews, BAGS, ctx({ period: { start: '2026-09-01', end: '2026-09-30' } }));
    expect(tab.nextUp.length).toBeGreaterThanOrEqual(4);
    expect(tab.nextUp.length).toBeLessThanOrEqual(6);
    expect(tab.nextUp).toContainEqual(expect.objectContaining({ key: 'brews', target: 1500, value: 1365 }));
    const frac = tab.nextUp.map((n) => n.value / n.target);
    expect(frac).toEqual([...frac].sort((a, b) => b - a));
  });
  it('next up kg brewed is rounded to one decimal', () => {
    const tab = milestonesTab(daily(3, { dose: 18.37 }), BAGS, ctx());
    expect(tab.nextUp.find((n) => n.key === 'kgBrewed')!.value).toBe(0.1);
  });
  it('next up streak uses the current run only', () => {
    const run = (s: number, n: number) => Array.from({ length: n }, (_, i) => at(day(s + i)));
    const tab = milestonesTab([...run(0, 40), ...run(100, 10)], BAGS, ctx({ today: day(109) }));
    expect(tab.nextUp.find((n) => n.key === 'streak')).toMatchObject({ value: 10, target: 14 });
  });
  it('on this day: a year ago today, only with >= a year of data', () => {
    const b = [at('2026-02-09', { rating: 7, brewer: 'V60' }), at('2026-02-09', { rating: 9, brewer: 'Kalita', localTime: '2026-02-09T09:00' })];
    const hit = milestonesTab(b, BAGS, ctx({ today: '2027-02-09' }));
    expect(hit.onThisDay).toMatchObject({ rating: 9, brewer: 'Kalita', holder: { label: 'Ethiopia', date: '2026-02-09' } });
    expect(milestonesTab(b, BAGS, ctx({ today: '2026-12-09' })).onThisDay).toBeNull();
    expect(milestonesTab([at('2026-01-01')], BAGS, ctx({ today: '2027-02-09' })).onThisDay).toBeNull(); // nothing brewed that day
  });
});
