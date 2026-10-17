import { describe, it, expect } from 'vitest';
import { hiddenRows, leaderboard, leaderboards, withMovement, type BoardRow } from './leaderboards';
import type { BrewFact, BagFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: 15, rating: null, roaster: 'Sey', origin: 'Kenya',
  processGroup: 'Washed', roastLevel: 'Light', decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: 'V60', filter: 'Cafec Abaca', grinder: 'ZP6',
  water: 'Lotus', waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: '2026-09-10', cost: 25, amountG: 250, roaster: 'Sey', name: 'Kiambu', slug: 'sey-kiambu',
  processing: 'Washed', origin: 'Kenya', processGroup: 'Washed', roastLevel: 'Light', decaf: false, firstBrew: null,
  lastBrew: null, bagRating: null, ...o
});
const SEPT = { start: '2026-09-01', end: '2026-09-30' };
const AUG = { start: '2026-08-01', end: '2026-08-31' };

const BREWS = [
  brew({ coffeeId: 1, roaster: 'Sey', dose: 15, rating: 8 }),
  brew({ coffeeId: 1, roaster: 'Sey', dose: 15, rating: 9 }),
  brew({ coffeeId: 2, roaster: 'Moonwake', dose: 40, rating: 7, origin: 'N/A' }),
  brew({ coffeeId: 2, roaster: 'Moonwake', localDate: '2026-08-15', dose: 99 }) // outside SEPT
];
const BAGS = [
  bag({ id: 1 }),
  bag({ id: 2, roaster: 'Moonwake', name: 'Bombe', slug: 'moonwake-bombe', origin: 'N/A', cost: 40, amountG: 100 }),
  bag({ id: 3, roaster: 'Moonwake', name: 'Free', slug: 'free', cost: 0, amountG: 100 }),
  bag({ id: 4, roaster: 'Moonwake', cost: null }),               // no cost
  bag({ id: 5, roaster: 'Moonwake', amountG: null }),            // no amount
  bag({ id: 6, roaster: 'Sey', purchaseDate: '2026-08-01', cost: 99 }) // bought before SEPT
];
const vals = (rows: BoardRow[]) => rows.map((r) => [r.label, r.value]);

describe('leaderboard', () => {
  it('brews: count per key, bags distinct', () =>
    expect(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'brews', 'all', 'raw')).toMatchObject([
      { label: 'Sey', value: 2, bags: 1, brews: 2 },
      { label: 'Moonwake', value: 1, bags: 1, brews: 1 }
    ]));
  it('grams: sum of doses in the period', () =>
    expect(vals(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'grams', 'all', 'raw'))).toEqual([['Moonwake', 40], ['Sey', 30]]));
  it('rating: bag-weighted mean via ratedGroups', () =>
    expect(vals(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'rating', 'all', 'raw'))).toEqual([['Sey', 8.5], ['Moonwake', 7]]));
  it('spend: bags bought in the period, by purchase date not brew date', () =>
    expect(vals(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'spend', 'all', 'raw'))).toEqual([['Moonwake', 40 + 0 + 25], ['Sey', 25]]));
  it('ppg skips bags without cost or amount; a free bag counts', () => {
    const rows = leaderboard(BREWS, BAGS, SEPT, 'roasters', 'ppg', 'all', 'raw');
    expect(vals(rows)).toEqual([['Moonwake', 0.2], ['Sey', 0.1]]); // Moonwake: (40 + 0) / 200 g
    expect(rows.every((r) => Number.isFinite(r.value))).toBe(true);
    expect([rows[0].cost, rows[0].grams]).toEqual([40, 200]);
    expect(leaderboard(BREWS, BAGS, SEPT, 'coffees', 'ppg', 'all', 'raw')[0].cost).toBeGreaterThan(0);
  });
  it('gear and water boards have no spend or $/g rows', () => {
    expect(leaderboard(BREWS, BAGS, SEPT, 'dripper', 'spend', 'all', 'raw')).toEqual([]);
    expect(leaderboard(BREWS, BAGS, SEPT, 'water', 'ppg', 'all', 'raw')).toEqual([]);
  });
  it('origins skip N/A', () =>
    expect(leaderboard(BREWS, BAGS, SEPT, 'origins', 'brews', 'all', 'raw').map((r) => r.label)).toEqual(['Kenya']));
  it('filter board leaves out the mixed 155 filter', () =>
    expect(leaderboard([brew({ filter: '155 (mixed)' })], [], SEPT, 'filter', 'brews', 'all', 'raw')).toEqual([]));
  it('coffees: name, roaster, link, one-bag sample', () =>
    expect(leaderboard(BREWS, BAGS, SEPT, 'coffees', 'rating', 'all', 'raw')[0]).toEqual({
      key: '1', label: 'Kiambu', sub: 'Sey', href: '/coffees/sey-kiambu', value: 8.5, bags: 1, brews: 2, sample: { bags: 1, brews: 2, small: true, one: true }
    }));
  it('min3 (Raw average, confident): leaves out the rows the Low confidence chip marks', () => {
    const many = (n: number) => (i: number) => Array.from({ length: n }, () => brew({ coffeeId: i, roaster: 'Many', rating: 6 }));
    // Many: 3 bags, 12 brews (kept). Thin: 3 bags but 9 brews. Few: 1 bag.
    const brews = [
      ...[2, 3, 4].flatMap(many(4)),
      ...[5, 6, 7].flatMap((i) => Array.from({ length: 3 }, () => brew({ coffeeId: i, roaster: 'Thin', rating: 7 }))),
      brew({ coffeeId: 1, roaster: 'Few', rating: 10 })
    ];
    const names = (b: 'roasters' | 'coffees', avg: 'min3' | 'raw' | 'k2') => leaderboard(brews, [], SEPT, b, 'rating', 'all', avg).map((r) => r.label);
    expect(names('roasters', 'min3')).toEqual(['Many']);
    expect(names('roasters', 'raw')).toEqual(['Few', 'Thin', 'Many']);
    expect(names('roasters', 'k2')).toHaveLength(3);
    // Coffees: 4 rated brews stay, 3 go (single rule, edge at 4).
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'min3').map((r) => r.value)).toEqual([6, 6, 6]);
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'raw')).toHaveLength(7);
  });
  it('best: value is the top brew; coffees board is that bag\'s top brew', () => {
    const brews = [brew({ coffeeId: 1, rating: 6 }), brew({ coffeeId: 1, rating: 9 }), brew({ coffeeId: 2, rating: 9 })];
    const [r] = leaderboard(brews, [], SEPT, 'roasters', 'rating', 'all', 'best');
    expect(r).toMatchObject({ value: 9, atBest: 2, bags: 2, brews: 3 });
    expect(r.sample).toEqual({ bags: 2, brews: 3, small: true });
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'best').map((x) => [x.value, x.atBest])).toEqual([[9, 1], [9, 1]]);
  });
  it('rating rows carry a sample; the coffees board uses the one-bag rule', () => {
    const bs = [1, 1, 1, 2, 2, 2, 2].map((coffeeId, i) => brew({ coffeeId, roaster: 'R', rating: 8, id: i + 1 }));
    const roasters = leaderboard(bs, [], SEPT, 'roasters', 'rating', 'all', 'raw');
    expect(roasters[0].sample).toEqual({ bags: 2, brews: 7, small: true });
    const coffees = leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'raw');
    expect(coffees.map((r) => r.sample)).toEqual([{ bags: 1, brews: 4, small: false, one: true }, { bags: 1, brews: 3, small: true, one: true }]);
    expect(leaderboard(bs, [], SEPT, 'roasters', 'brews', 'all', 'raw')[0].sample).toBeUndefined();
  });
  it('roast level link includes alias labels', () => {
    const [r] = leaderboard([brew({ roastLevel: 'Light/Medium' })], [], SEPT, 'roast', 'brews', 'all', 'raw');
    expect(r.href).toBe('/coffees?status=all&roast_level=Light%2FMedium&roast_level=Light%2FMed');
  });
  it('attribute boards link to the filtered coffee list, archived included', () => {
    const [r] = leaderboard(BREWS, BAGS, SEPT, 'roasters', 'brews', 'all', 'raw');
    expect(r.href).toBe('/coffees?status=all&roaster=Sey');
    const [p] = leaderboard(BREWS, [...BAGS, bag({ id: 7, processing: 'Fully washed' })], SEPT, 'process', 'brews', 'all', 'raw');
    expect(p.href).toBe('/coffees?status=all&processing=Washed&processing=Fully+washed');
    expect(leaderboard(BREWS, BAGS, SEPT, 'dripper', 'brews', 'all', 'raw')[0].href).toBeUndefined();
  });
  it('ties: more bags, then more brews, then label', () =>
    expect(
      leaderboard(
        [brew({ coffeeId: 1, roaster: 'B' }), brew({ coffeeId: 2, roaster: 'A' }), brew({ coffeeId: 3, roaster: 'C', dose: 10 }), brew({ coffeeId: 4, roaster: 'C', dose: 5 })],
        [], SEPT, 'roasters', 'grams', 'all', 'raw'
      ).map((r) => r.label)
    ).toEqual(['C', 'A', 'B']));
});

describe('withMovement', () => {
  const row = (key: string): BoardRow => ({ key, label: key, value: 1, bags: 1, brews: 1 });
  it('up, down, same, new', () =>
    expect(withMovement([row('a'), row('b'), row('c'), row('d')], [row('b'), row('a'), row('c')]).map((r) => r.move)).toEqual([1, -1, 0, 'new']));
});

describe('leaderboards', () => {
  it('every board, movement only with a compare window', () => {
    const all = leaderboards(BREWS, BAGS, SEPT, null, 'brews', 'all', 'raw');
    expect(Object.keys(all)).toHaveLength(9);
    expect(all.roasters[0].move).toBeUndefined();
    const cmp = leaderboards(BREWS, BAGS, SEPT, AUG, 'brews', 'all', 'raw');
    // Aug: Moonwake #1 only. Sept: Sey #1 (new), Moonwake #2 (fell one).
    expect(cmp.roasters.map((r) => r.move)).toEqual(['new', -1]);
  });
  it('per person divides totals only', () => {
    expect(vals(leaderboards(BREWS, BAGS, SEPT, null, 'grams', 'all', 'raw', 2).roasters)).toEqual([['Moonwake', 20], ['Sey', 15]]);
    expect(vals(leaderboards(BREWS, BAGS, SEPT, null, 'rating', 'all', 'raw', 2).roasters)).toEqual([['Sey', 8.5], ['Moonwake', 7]]);
    const ppg = leaderboards(BREWS, BAGS, SEPT, null, 'ppg', 'all', 'raw', 2).roasters[0];
    expect([ppg.value, ppg.cost, ppg.grams]).toEqual([0.2, 20, 100]);
  });
});

describe('hiddenRows', () => {
  const rated = [brew({ coffeeId: 1, rating: 8 }), brew({ coffeeId: 1, rating: 9 })];
  const run = (scored: BrewFact[], all: BrewFact[], ratings: 'current' | 'all', avg: 'min3' | 'raw') =>
    hiddenRows(leaderboards(scored, [bag({ id: 1 })], SEPT, null, 'rating', ratings, avg), scored, all, [bag({ id: 1 })], SEPT, 'rating', ratings);
  it('blames each setting that hid rows, and only those', () => {
    // One bag, two brews: min3 hides every board; raw shows it.
    expect(run(rated, rated, 'all', 'min3').why).toEqual(['avg']);
    expect(run(rated, rated, 'all', 'min3').by.roasters).toEqual(['avg']);
    expect(run(rated, rated, 'all', 'raw')).toEqual({ rows: {}, why: [], by: {} });
    // Once dialed nulled the ratings (scored) that the full history has: Brews setting only.
    const dialed = rated.map((b) => ({ ...b, rating: null }));
    const d = run(dialed, rated, 'all', 'raw');
    expect(d.why).toEqual(['dial']);
    expect(d.rows.roasters).toBe(1);
    // Calibrated hides a pre-calibration brew's rating: Ratings setting only.
    const old = rated.map((b) => ({ ...b, localDate: '2026-05-01' }));
    expect(hiddenRows(leaderboards(old, [bag({ id: 1 })], { start: '2026-05-01', end: '2026-05-31' }, null, 'rating', 'current', 'raw'), old, old, [bag({ id: 1 })], { start: '2026-05-01', end: '2026-05-31' }, 'rating', 'current').why)
      .toEqual(['ratings']);
  });
  it('each board gets its own reasons', () => {
    // Bag 1 (Sey) has 2 rated brews, bag 2 (Moonwake) one dial-in brew whose rating Once dialed nulls.
    const sey = [brew({ coffeeId: 1, rating: 8 }), brew({ coffeeId: 1, rating: 9 })];
    const moon = brew({ coffeeId: 2, roaster: 'Moonwake', rating: 7 });
    const bags = [bag({ id: 1 }), bag({ id: 2, roaster: 'Moonwake', name: 'B', slug: 'b' })];
    const scored = [...sey, { ...moon, rating: null }], all = [...sey, moon];
    const r = hiddenRows(leaderboards(scored, bags, SEPT, null, 'rating', 'all', 'min3'), scored, all, bags, SEPT, 'rating', 'all');
    expect(r.by.roasters).toEqual(['avg', 'dial']); // both roasters gain at raw; Moonwake only once dialed shows
  });
});

describe('vs like coffees', () => {
  const LW = { roastLevel: 'Light', processGroup: 'Washed' as const };
  const bs = [[1, 9, 'A'], [2, 8, 'A'], [3, 7, 'A'], [4, 8, 'B'], [5, 7, 'B'], [6, 6, 'B']].flatMap(([id, r, roaster]) =>
    [0, 1, 2, 3].map((i) => brew({ id: Number(id) * 10 + i, coffeeId: Number(id), rating: Number(r), roaster: String(roaster), ...LW })));
  it('coffees: each bag’s gap, best first; roasters: the bag-weighted mean gap', () => {
    const c = leaderboard(bs, [], SEPT, 'coffees', 'like', 'all', 'raw');
    expect(c.map((r) => r.key)).toEqual(['1', '2', '4', '3', '5', '6']);
    // A roaster is compared with the other roaster's coffees only: A's 9/8/7 vs B's mean 7, B's 8/7/6 vs A's mean 8.
    const r = leaderboard(bs, [], SEPT, 'roasters', 'like', 'all', 'raw');
    expect(r.map((x) => [x.key, +x.value.toFixed(2), x.sample])).toEqual([['A', 1, { bags: 3, brews: 12, small: false }], ['B', -1, { bags: 3, brews: 12, small: false }]]);
  });
  it('the See all note counts like rows that Once dialed hid', () => {
    const dialed = bs.map((b) => ({ ...b, rating: null }));
    const h = hiddenRows(leaderboards(dialed, [], SEPT, null, 'like', 'all', 'raw'), dialed, bs, [], SEPT, 'like', 'all');
    expect(h).toMatchObject({ rows: { coffees: 6, roasters: 2 }, why: ['dial'] });
  });
  it('like on other boards is empty', () => expect(leaderboard(bs, [], SEPT, 'origins', 'like', 'all', 'raw')).toEqual([]));
  it('the coffees board carries the like line under rating', () => {
    const like = leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'raw').find((r) => r.key === '1')!.like!;
    expect(like.label).toBe('Washed Light coffees');
    expect(like.gap).toBeCloseTo(1.8);
  });
});
