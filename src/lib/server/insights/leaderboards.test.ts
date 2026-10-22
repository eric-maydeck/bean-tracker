import { dialInIds, onceDialed } from './dialed';
import { describe, it, expect } from 'vitest';
import { cutBoards, hiddenRows, leaderboard, leaderboards, pageFilters, withMovement, type BoardRow } from './leaderboards';
import { roastLevelLabels, type BrewFact, type BagFact } from './facts';

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
// Rated: Sey's bag 1 (8, 9, 8, 9) and Moonwake's bag 2 (7 ×4), weight 4/6 each; Sey's 1-brew bag 3 (2), weight 1/3.
const RATED = [
  ...[8, 9, 8, 9].map((rating) => brew({ coffeeId: 1, rating })),
  ...[7, 7, 7, 7].map((rating) => brew({ coffeeId: 2, roaster: 'Moonwake', rating })),
  brew({ coffeeId: 3, rating: 2 })
];

// hiddenRows' reasons over every board, in order.
const why = (h: ReturnType<typeof hiddenRows>) => [...new Set(Object.values(h.by).flat())];

describe('leaderboard', () => {
  it('brews: count per key, bags distinct', () =>
    expect(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'brews', 'all', 'raw')).toMatchObject([
      { label: 'Sey', value: 2, bags: 1, brews: 2 },
      { label: 'Moonwake', value: 1, bags: 1, brews: 1 }
    ]));
  it('grams: sum of doses in the period', () =>
    expect(vals(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'grams', 'all', 'raw'))).toEqual([['Moonwake', 40], ['Sey', 30]]));
  it('rating: every bag counts under every Score, its mean weighted n/(n+2) (a 1-brew bag a third)', () => {
    expect(vals(leaderboard(RATED, BAGS, SEPT, 'roasters', 'rating', 'all', 'min3'))).toEqual([]); // under 3 bags each: Low confidence
    expect(vals(leaderboard(RATED, BAGS, SEPT, 'roasters', 'rating', 'all', 'k2')).map(([l]) => l)).toEqual(['Moonwake', 'Sey']);
    for (const avg of ['k2', 'raw', 'best'] as const)
      expect(leaderboard(RATED, BAGS, SEPT, 'roasters', 'rating', 'all', avg).find((r) => r.label === 'Sey')!.bags, avg).toBe(2);
    // Sey: bags at 8.5 (weight 2/3) and 2 (1/3).
    expect(vals(leaderboard(RATED, BAGS, SEPT, 'roasters', 'rating', 'all', 'raw'))).toEqual([['Moonwake', expect.closeTo(7)], ['Sey', expect.closeTo((2 / 3) * 8.5 + (1 / 3) * 2)]]);
    // The coffees board is single bags: the 1-brew bag stays, marked by the one-bag rule.
    expect(leaderboard(RATED, BAGS, SEPT, 'coffees', 'rating', 'all', 'raw')).toHaveLength(3);
  });
  it('bag size counts dial-in brews: a 4-brew bag (3 left once dialed) is no small coffee (user ruling 2026-10-17)', () => {
    const four = [6, 8, 8, 8].map((rating, i) => brew({ id: i + 1, coffeeId: 1, rating }));
    const scored = onceDialed(four, dialInIds(four));
    const [r] = leaderboard(scored, [], SEPT, 'coffees', 'rating', 'all', 'min3');
    expect(r).toMatchObject({ value: 8, brews: 3, sample: { brews: 4, small: false } });
  });
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
    // Many: 3 bags, 12 brews (kept). Thin: 2 bags. Few: 1 bag. Tiny: one 1-brew bag, only on Raw (See all).
    const brews = [
      ...[2, 3, 4].flatMap(many(4)),
      ...[5, 6].flatMap((i) => Array.from({ length: 4 }, () => brew({ coffeeId: i, roaster: 'Thin', rating: 7 }))),
      ...Array.from({ length: 4 }, () => brew({ coffeeId: 1, roaster: 'Few', rating: 10 })),
      brew({ coffeeId: 7, roaster: 'Tiny', rating: 9 })
    ];
    const names = (b: 'roasters' | 'coffees', avg: 'min3' | 'raw' | 'k2') => leaderboard(brews, [], SEPT, b, 'rating', 'all', avg).map((r) => r.label);
    expect(names('roasters', 'min3')).toEqual(['Many']);
    expect(names('roasters', 'raw')).toEqual(['Few', 'Tiny', 'Thin', 'Many']);
    expect(names('roasters', 'k2')).toHaveLength(4); // every rated group shows; only min3 cuts
    // Coffees: 4 rated brews stay, 3 go (single rule, edge at 4).
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'min3').map((r) => r.value)).toEqual([10, 7, 7, 6, 6, 6]);
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'raw')).toHaveLength(7);
  });
  it('best: value is the top brew; coffees board is that bag\'s top brew', () => {
    const brews = [...[6, 9, 6, 6].map((rating) => brew({ coffeeId: 1, rating })), ...[9, 5, 5, 5].map((rating) => brew({ coffeeId: 2, rating }))];
    const [r] = leaderboard(brews, [], SEPT, 'roasters', 'rating', 'all', 'best');
    expect(r).toMatchObject({ value: 9, atBest: 2, bags: 2, brews: 8 });
    expect(r.sample).toEqual({ bags: 2, brews: 8, small: true });
    expect(leaderboard(brews, [], SEPT, 'coffees', 'rating', 'all', 'best').map((x) => [x.value, x.atBest])).toEqual([[9, 1], [9, 1]]);
  });
  it('rating rows carry a sample; the coffees board uses the one-bag rule', () => {
    const bs = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3].map((coffeeId, i) => brew({ coffeeId, roaster: 'R', rating: 8, id: i + 1 }));
    for (const avg of ['k2', 'raw'] as const) // every bag, 3 brews or not
      expect(leaderboard(bs, [], SEPT, 'roasters', 'rating', 'all', avg)[0].sample).toEqual({ bags: 3, brews: 11, small: false });
    const coffees = leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'raw');
    expect(coffees.map((r) => r.sample)).toEqual([{ bags: 1, brews: 4, small: false, one: true }, { bags: 1, brews: 4, small: false, one: true }, { bags: 1, brews: 3, small: true, one: true }]);
    expect(leaderboard(bs, [], SEPT, 'roasters', 'brews', 'all', 'raw')[0].sample).toBeUndefined();
  });
  it('roast level link includes alias labels', () => {
    const [r] = leaderboard([brew({ roastLevel: 'Light/Medium' })], [], SEPT, 'roast', 'brews', 'all', 'raw');
    expect(r.href).toBe('/coffees?status=open&status=archive&roast_level=Light%2FMedium&roast_level=Light%2FMed');
  });
  it('attribute boards link to the filtered coffee list, Backlog left out', () => {
    const [r] = leaderboard(BREWS, BAGS, SEPT, 'roasters', 'brews', 'all', 'raw');
    expect(r.href).toBe('/coffees?status=open&status=archive&roaster=Sey');
    const [p] = leaderboard(BREWS, [...BAGS, bag({ id: 7, processing: 'Fully washed' })], SEPT, 'process', 'brews', 'all', 'raw');
    expect(p.href).toBe('/coffees?status=open&status=archive&processing=Washed&processing=Fully+washed');
    expect(leaderboard(BREWS, BAGS, SEPT, 'dripper', 'brews', 'all', 'raw')[0].href).toBeUndefined();
  });
  it('the link status follows the rank: consumption ranks open+archive, spend and ppg all (Backlog bags were bought)', () => {
    const bought = [bag({ id: 8, roaster: 'Sey', cost: 20, amountG: 250, purchaseDate: '2026-09-02' })];
    for (const rank of ['spend', 'ppg'] as const) {
      expect(leaderboard([], bought, SEPT, 'roasters', rank, 'all', 'raw')[0].href).toBe('/coffees?status=all&roaster=Sey');
    }
    expect(leaderboard(BREWS, BAGS, SEPT, 'roasters', 'rating', 'all', 'raw')[0].href).toContain('status=open&status=archive');
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

describe('coffees under k2 / adjusted: shrunk by brews', () => {
  // A lucky 1-brew bag at 10, a 6-brew bag at 9, an 8-brew bag at 7; brew mean (10 + 54 + 56) / 15 = 8.
  const n = (k: number, coffeeId: number, rating: number) => Array.from({ length: k }, () => brew({ coffeeId, rating }));
  const bs = [...n(1, 1, 10), ...n(6, 2, 9), ...n(8, 3, 7)];
  const o = 8;
  it('K brews at the brew mean: the 6-brew bag tops; the row keeps its plain average', () => {
    const rows = leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'k2');
    expect(rows.map((r) => r.key)).toEqual(['2', '1', '3']);
    expect(rows[0]).toMatchObject({ value: expect.closeTo((54 + 2 * o) / 8), mean: 9 });
    expect(rows[1]).toMatchObject({ value: expect.closeTo((10 + 2 * o) / 3), mean: 10 });
    expect(leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'adjusted')[0].value).toBeCloseTo((54 + 5 * o) / 11);
    expect(leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'raw').map((r) => r.key)).toEqual(['1', '2', '3']); // Raw: no shrink
  });
  it('the plain average rides along under k2/adjusted only, never under Raw or min3 (by mode, not float equality)', () => {
    // 1/3-point ratings: a weighted mean of one bag isn't bit-equal to its plain one.
    const odd = [brew({ coffeeId: 9, rating: 7.1 }), brew({ coffeeId: 9, rating: 8.3 }), brew({ coffeeId: 9, rating: 7.7 }), brew({ coffeeId: 9, rating: 8.9 })];
    for (const avg of ['raw', 'min3'] as const)
      expect(leaderboard([...bs, ...odd], [], SEPT, 'coffees', 'rating', 'all', avg).every((r) => r.mean === undefined), avg).toBe(true);
    for (const avg of ['k2', 'adjusted'] as const)
      expect(leaderboard([...bs, ...odd], [], SEPT, 'coffees', 'rating', 'all', avg).every((r) => r.mean !== undefined), avg).toBe(true);
  });
  it('no avg param: Coffees k2, every other board min3; an explicit avg is every board\u2019s', () => {
    const def = leaderboards(bs, [], SEPT, null, 'rating', 'all', undefined);
    expect(def.coffees.map((r) => r.key)).toEqual(['2', '1', '3']); // k2: the 1-brew bag shows, below
    // min3 on the group boards: one roaster (Sey), 3 bags and 15 brews, passes; its mean weights each bag n/(n+2).
    expect(def.roasters.map((r) => r.value)).toEqual([expect.closeTo((0.75 * 9 + 0.8 * 7 + (1 / 3) * 10) / (0.75 + 0.8 + 1 / 3))]);
    expect(leaderboards(bs, [], SEPT, null, 'rating', 'all', 'min3').coffees.map((r) => r.key)).toEqual(['2', '3']);
    expect(cutBoards(def, bs, [], SEPT, 'rating', 'all', undefined)).not.toContain('coffees');
  });
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
    expect(vals(leaderboards(RATED, BAGS, SEPT, null, 'rating', 'all', 'raw', 2).roasters)[0]).toEqual(['Moonwake', expect.closeTo(7)]); // rating isn't split
    const ppg = leaderboards(BREWS, BAGS, SEPT, null, 'ppg', 'all', 'raw', 2).roasters[0];
    expect([ppg.value, ppg.cost, ppg.grams]).toEqual([0.2, 20, 100]);
  });
});

describe('hiddenRows', () => {
  const rated = [8, 9, 8, 9].map((rating) => brew({ coffeeId: 1, rating }));
  const run = (scored: BrewFact[], all: BrewFact[], ratings: 'current' | 'all', avg: 'min3' | 'raw') =>
    hiddenRows(leaderboards(scored, [bag({ id: 1 })], SEPT, null, 'rating', ratings, avg), scored, all, [bag({ id: 1 })], SEPT, 'rating', ratings);
  it('blames each setting that hid rows, and only those', () => {
    // One bag, four brews: min3 hides every board; raw shows it.
    expect(why(run(rated, rated, 'all', 'min3'))).toEqual(['avg']);
    expect(run(rated, rated, 'all', 'min3').by.roasters).toEqual(['avg']);
    expect(run(rated, rated, 'all', 'raw')).toEqual({ rows: {}, by: {}, cut: [] });
    // Once dialed nulled the ratings (scored) that the full history has: Brews setting only.
    const dialed = rated.map((b) => ({ ...b, rating: null }));
    const d = run(dialed, rated, 'all', 'raw');
    expect(why(d)).toEqual(['dial']);
    expect(d.rows.roasters).toBe(1);
    // Calibrated hides a pre-calibration brew's rating: Ratings setting only.
    const old = rated.map((b) => ({ ...b, localDate: '2026-05-01' }));
    expect(why(hiddenRows(leaderboards(old, [bag({ id: 1 })], { start: '2026-05-01', end: '2026-05-31' }, null, 'rating', 'current', 'raw'), old, old, [bag({ id: 1 })], { start: '2026-05-01', end: '2026-05-31' }, 'rating', 'current')))
      .toEqual(['ratings']);
  });
  it('a group of only 1–3-brew bags: hidden by Score, back under See all (Raw)', () => {
    const bs = [...[8, 8, 8, 8].map((rating) => brew({ coffeeId: 1, rating })), brew({ coffeeId: 3, roaster: 'Onyx', rating: 9 })];
    const h = hiddenRows(leaderboards(bs, [], SEPT, null, 'rating', 'all', 'min3'), bs, bs, [], SEPT, 'rating', 'all');
    expect(h.by.roasters).toEqual(['avg']);
    expect(leaderboard(bs, [], SEPT, 'roasters', 'rating', 'all', 'raw').map((r) => r.label)).toContain('Onyx');
  });
  it('each board gets its own reasons', () => {
    // Bag 1 (Sey) has 4 rated brews, bag 2 (Moonwake) 4 brews whose ratings Once dialed nulls.
    const sey = [8, 9, 8, 9].map((rating) => brew({ coffeeId: 1, rating }));
    const moon = [7, 7, 7, 7].map((rating) => brew({ coffeeId: 2, roaster: 'Moonwake', rating }));
    const bags = [bag({ id: 1 }), bag({ id: 2, roaster: 'Moonwake', name: 'B', slug: 'b' })];
    const scored = [...sey, ...moon.map((b) => ({ ...b, rating: null }))], all = [...sey, ...moon];
    const r = hiddenRows(leaderboards(scored, bags, SEPT, null, 'rating', 'all', 'min3'), scored, all, bags, SEPT, 'rating', 'all');
    expect(r.by.roasters).toEqual(['avg', 'dial']); // both roasters gain at raw; Moonwake only once dialed shows
  });
  it('cut matches cutBoards', () => {
    const boards = leaderboards(rated, [bag({ id: 1 })], SEPT, null, 'rating', 'all', 'min3');
    const cut = cutBoards(boards, rated, [bag({ id: 1 })], SEPT, 'rating', 'all', 'min3');
    expect(cut.length).toBeGreaterThan(0);
    expect(hiddenRows(boards, rated, rated, [bag({ id: 1 })], SEPT, 'rating', 'all').cut).toEqual(cut);
  });
  it('a board of only 1–3-brew bags: min3 cuts it (Low confidence), k2/adjusted show it; cut matches cutBoards', () => {
    const small = [brew({ coffeeId: 1, rating: 8 }), brew({ coffeeId: 2, roaster: 'Moonwake', rating: 7 })];
    for (const avg of ['k2', 'adjusted', 'min3'] as const) {
      const boards = leaderboards(small, [], SEPT, null, 'rating', 'all', avg);
      const h = hiddenRows(boards, small, small, [], SEPT, 'rating', 'all');
      expect(h.cut.slice(0, 2), avg).toEqual(avg === 'min3' ? ['roasters', 'coffees'] : []);
      expect(cutBoards(boards, small, [], SEPT, 'rating', 'all', avg), avg).toEqual(h.cut);
      expect(h.rows.roasters ?? 0, avg).toBe(avg === 'min3' ? 2 : 0); // See all (Raw) adds only what min3 cut
    }
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
  it('a roaster\'s 10-brew rule counts dial-in brews (sample 12, though 9 are scored)', () => {
    const dialed = bs.map((b) => (b.id % 10 === 0 ? { ...b, rating: null, dialRating: b.rating } : b));
    const r = leaderboard(dialed, [], SEPT, 'roasters', 'like', 'all', 'min3');
    expect(r.map((x) => [x.key, x.brews, x.sample])).toEqual([['A', 9, { bags: 3, brews: 12, small: false, scored: 9 }], ['B', 9, { bags: 3, brews: 12, small: false, scored: 9 }]]);
  });
  it('one coffee shows the same brew count (its scored brews) under rating and like; its sample counts dial-in', () => {
    const dialed = bs.map((b) => (b.id % 10 === 0 ? { ...b, rating: null, dialRating: b.rating } : b));
    const by = (rank: 'rating' | 'like') => new Map(leaderboard(dialed, [], SEPT, 'coffees', rank, 'all', 'raw').map((r) => [r.key, [r.brews, r.sample]]));
    const rating = by('rating'), like = by('like');
    expect(like.size).toBe(6);
    for (const [k, v] of like) expect(rating.get(k), k).toEqual(v);
    expect(like.get('1')).toEqual([3, { bags: 1, brews: 4, small: false, one: true, scored: 3 }]);
    // Roaster rows: 9 scored on the row and in the sample, 12 counted by the rule (rating board too).
    const g = leaderboard(dialed, [], SEPT, 'roasters', 'rating', 'all', 'raw')[0];
    expect([g.brews, g.sample]).toEqual([9, { bags: 3, brews: 12, small: false, scored: 9 }]);
  });
  it('the See all note counts like rows that Once dialed hid', () => {
    const dialed = bs.map((b) => ({ ...b, rating: null }));
    const h = hiddenRows(leaderboards(dialed, [], SEPT, null, 'like', 'all', 'raw'), dialed, bs, [], SEPT, 'like', 'all');
    expect(h).toMatchObject({ rows: { coffees: 6, roasters: 2 } });
    expect(why(h)).toEqual(['dial']);
  });
  it('the confident cutoff: a 1-brew bag is no like row under the default, nor in its roaster figure; raw keeps the row', () => {
    const tiny = brew({ id: 999, coffeeId: 7, rating: 10, roaster: 'A', ...LW });
    const c = leaderboard([...bs, tiny], [], SEPT, 'coffees', 'like', 'all', 'min3');
    expect(c.map((r) => r.key)).not.toContain('7');
    expect(leaderboard([...bs, tiny], [], SEPT, 'coffees', 'like', 'all', 'raw').map((r) => r.key)).toContain('7');
    // A's figure under every Score: gaps 2, 1, 0 (weight 2/3 each) and the tiny bag's +3 (1/3): (2 + 1) / (7/3).
    for (const avg of ['k2', 'raw'] as const)
      expect(leaderboard([...bs, tiny], [], SEPT, 'roasters', 'like', 'all', avg)[0].value, avg).toBeCloseTo(9 / 7);
    const h = hiddenRows(leaderboards([...bs, tiny], [], SEPT, null, 'like', 'all', 'min3'), [...bs, tiny], [...bs, tiny], [], SEPT, 'like', 'all');
    expect(h).toMatchObject({ rows: { coffees: 1 } });
    expect(why(h)).toEqual(['avg']);
  });
  it('See all (raw) puts a roaster of only 1–3-brew bags on the like board, and the note counts it', () => {
    const small = brew({ id: 999, coffeeId: 7, rating: 9, roaster: 'C', ...LW });
    expect(leaderboard([...bs, small], [], SEPT, 'roasters', 'like', 'all', 'raw').map((r) => r.key)).toContain('C');
    expect(leaderboard([...bs, small], [], SEPT, 'roasters', 'like', 'all', 'k2').map((r) => r.key)).not.toContain('C');
    const h = hiddenRows(leaderboards([...bs, small], [], SEPT, null, 'like', 'all', 'min3'), [...bs, small], [...bs, small], [], SEPT, 'like', 'all');
    expect(h.rows.roasters).toBe(1); // C: min3 already shows A and B
  });
  it('like on other boards is empty', () => expect(leaderboard(bs, [], SEPT, 'origins', 'like', 'all', 'raw')).toEqual([]));
  it('the coffees board carries the like line under rating', () => {
    const like = leaderboard(bs, [], SEPT, 'coffees', 'rating', 'all', 'raw').find((r) => r.key === '1')!.like!;
    expect(like.label).toBe('Washed Light coffees');
    expect(like.gap).toBeCloseTo(1.8);
  });
  it('the like line shows under every rank but like (gate P4)', () => {
    for (const rank of ['brews', 'grams'] as const)
      expect(leaderboard(bs, [], SEPT, 'coffees', rank, 'all', 'raw').find((r) => r.key === '1')!.like!.gap).toBeCloseTo(1.8);
    expect(leaderboard(bs, [], SEPT, 'coffees', 'brews', 'all', 'raw', false).every((r) => !r.like)).toBe(true);
  });
});

describe('pageFilters', () => {
  it('translates a process group into its bags\' processing labels', () => {
    const bags = [bag({ id: 1, processing: 'Washed' }), bag({ id: 2, processing: 'Fully washed' }), bag({ id: 3, processing: 'Natural', processGroup: 'Natural' })];
    expect(pageFilters({ process: 'Washed' }, bags)).toEqual([{ column: 'processing', mode: 'any', values: ['Washed', 'Fully washed'] }]);
  });
  it('expands a roast alias, maps origin and roaster', () => {
    expect(pageFilters({ roast: 'Light/Medium' }, [])).toEqual([{ column: 'roast_level', mode: 'any', values: roastLevelLabels('Light/Medium') }]);
    expect(pageFilters({ origin: 'Kenya', roaster: 'Sey' }, [])).toEqual([
      { column: 'origin', mode: 'any', values: ['Kenya'] }, { column: 'roaster', mode: 'any', values: ['Sey'] }
    ]);
  });
  it('adds decaf only for caffeine=decaf', () => {
    expect(pageFilters({ caffeine: 'decaf' }, [])).toEqual([{ column: 'decaf', mode: 'bool', value: true }]);
    expect(pageFilters({ caffeine: 'all' }, [])).toEqual([]);
    expect(pageFilters({}, [])).toEqual([]);
  });
});

describe('brew filters: every board applies every brew filter', () => {
  const mk = (dripper: string, water: string, roaster: string, n: number) => Array.from({ length: n }, () => brew({ dripper, water, roaster, rating: 8 }));
  const all = [...mk('V60', 'W1', 'Sey', 3), ...mk('V60', 'W2', 'Moonwake', 2), ...mk('Origami', 'W1', 'Sey', 4), ...mk('Origami', 'W2', 'Moonwake', 5)];
  const bf = { dripper: 'V60', water: 'W1' };
  const counts = (rows: BoardRow[]) => Object.fromEntries(rows.map((r) => [r.label, r.value]));
  const boards = leaderboards(all, [bag({ id: 1 })], SEPT, null, 'brews', 'current', undefined, 1, bf);
  it('leaderboards', () => {
    expect(counts(boards.dripper)).toEqual({ V60: 3 });
    expect(counts(boards.water)).toEqual({ W1: 3 });
    expect(counts(boards.roasters)).toEqual({ Sey: 3 });
  });
  it('hiddenRows and cutBoards agree', () => {
    const rb = leaderboards(all, [], SEPT, null, 'rating', 'all', 'min3', 1, bf);
    const h = hiddenRows(rb, all, all, [], SEPT, 'rating', 'all', bf);
    expect(Object.values(h.rows).every((n) => n! > 0)).toBe(true);
    expect(cutBoards(rb, all, [], SEPT, 'rating', 'all', 'min3', bf)).toEqual(h.cut);
  });
});
