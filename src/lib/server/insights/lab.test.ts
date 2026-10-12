import { describe, it, expect } from 'vitest';
import { brewZ, demeaned, groupZ, sd, strengthOf } from './stats';
import { breakdown, brewingTab, cellOf, groupsFor, labFn, labOptions, ladder, pairedDeltas, ratedIn, SLICE_OF, sweetSpotsTab, verdictOf, waterTab, gearTab, ranked } from './lab';
import type { BagFact, BrewFact } from './facts';
import type { BandStat } from './lab';

let n = 0;
const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: ++n, coffeeId: 1, localTime: '2026-09-15T08:00', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null,
  grind: null, dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
// k brews of one bag at one temp, ratings r-0.1 / r / r+0.1 cycling (non-zero SDs).
const many = (k: number, coffeeId: number, tempC: number, r: number, o: Partial<BrewFact> = {}) =>
  Array.from({ length: k }, (_, i) => brew({ coffeeId, tempC, rating: +(r + ((i % 3) - 1) * 0.1).toFixed(2), ...o }));
// Same, with +-0.3 noise: keeps z near the solid bar, so the Bonferroni test count changes the verdict.
const noisy = (k: number, coffeeId: number, tempC: number, r: number) =>
  Array.from({ length: k }, (_, i) => brew({ coffeeId, tempC, rating: +(r + ((i % 3) - 1) * 0.3).toFixed(2) }));
const temp = labFn('temp'), exact = labFn('tempExact');
const P = { start: '2026-09-01', end: '2026-09-30' };

describe('ratedIn', () => {
  it('period, ratings switch, rated, linked only', () => {
    const rows = [brew({ rating: 8 }), brew({ rating: 0 }), brew({ rating: null }), brew({ rating: 8, coffeeId: null }),
      brew({ rating: 8, localDate: '2026-08-31' })];
    expect(ratedIn(rows, P, 'all')).toHaveLength(1);
    expect(ratedIn([brew({ rating: 8, localDate: '2026-05-01' })], { start: null, end: '2026-09-30' }, 'current')).toHaveLength(0);
  });
});

describe('pairedDeltas', () => {
  it('paired-bag rule: ≥ 2 bands with ≥ 2 brews each', () => {
    const rows = [...many(2, 1, 91, 8), ...many(2, 1, 94, 7), ...many(3, 2, 91, 6)];
    const [a, b] = pairedDeltas(rows, temp);
    expect(a).toMatchObject({ label: '90–92 °C', bags: 1, brews: 2, plainBrews: 5, plainBags: 2 });
    expect(a.delta).toBeCloseTo(0.5);
    expect(b).toMatchObject({ label: '93–94 °C', bags: 1, brews: 2 });
    expect(b.delta).toBeCloseTo(-0.5);
  });
  it('minPerBand 1 pairs single brews (dial-in)', () => {
    const rows = [...many(1, 1, 91, 8), ...many(2, 1, 94, 7)];
    expect(pairedDeltas(rows, temp)[0].delta).toBeNull();
    expect(pairedDeltas(rows, temp, 1)[0].delta).not.toBeNull();
  });
  it('solid needs ≥ 3 paired bags and ≥ 30 brews', () => {
    const three = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8), ...many(10, id, 94, 7)]);
    expect(pairedDeltas(three, temp).map((s) => s.solid)).toEqual([true, true]);
    const two = [1, 2].flatMap((id) => [...many(20, id, 91, 8), ...many(20, id, 94, 7)]);
    expect(pairedDeltas(two, temp).map((s) => s.solid)).toEqual([false, false]);
  });
  const near = (extra: BrewFact[] = []) => [1, 2, 3].flatMap((id) => [...noisy(10, id, 91, 8.06), ...noisy(10, id, 94, 7.94), ...noisy(10, id, 88, 7.94)]).concat(extra);
  const zOf = (rows: BrewFact[], skip = -1) => {
    const dm = demeaned(rows);
    const of = (lo: number, hi: number) => dm.filter((r) => r.tempC! >= lo && r.tempC! < hi && r.coffeeId !== skip).map((r) => r.dm);
    return brewZ(of(90, 93), [...of(0, 90), ...of(93, 99)], sd(of(0, 99)));
  };
  it('strength: brewZ vs the other bands, Bonferroni over the band count', () => {
    const rows = near();
    const z = zOf(rows);
    const got = pairedDeltas(rows, temp).find((s) => s.label === '90–92 °C')!.strength;
    expect(got).toBe(strengthOf(z, true, 3));
    expect(got).toBe('hint');
    expect(got).not.toBe(strengthOf(z, true, 1)); // would be solid without the correction
  });
  it('Bonferroni counts every band in the data, also bands with no pairs', () => {
    // 96 °C is a 4th band (one unpaired bag, no pairs): tests = 4, not 3.
    const more = near(many(3, 9, 96, 7));
    const z = zOf(more, 9);
    const got = pairedDeltas(more, temp).find((s) => s.label === '90–92 °C')!.strength;
    expect(got).toBe(strengthOf(z, true, 4));
    expect(got).toBe('early');
    expect(got).not.toBe(strengthOf(z, true, 3));
  });
  it('in-period bag means (ratedIn drops the old brews before demeaning)', () => {
    const rows = [...many(2, 1, 91, 8), ...many(2, 1, 94, 7), ...many(5, 1, 91, 2, { localDate: '2026-01-01' })];
    expect(pairedDeltas(ratedIn(rows, P, 'all'), temp)[0].delta).toBeCloseTo(0.5);
  });
  it('single band: no strength, no NaN', () => {
    const st = pairedDeltas(many(6, 1, 92, 8), temp);
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ delta: null, strength: null, solid: false });
    expect(JSON.stringify(st)).not.toMatch(/NaN|Infinity/);
  });
  it('empty rows: no bands, no NaN', () => expect(pairedDeltas([], temp)).toEqual([]));
  it('ties are deterministic: band order, then label', () => {
    const rows = [...many(2, 1, 0, 8, { tempC: null, water: 'B' }), ...many(2, 1, 0, 8, { tempC: null, water: 'A' })];
    expect(pairedDeltas(rows, labFn('water')).map((s) => s.label)).toEqual(['A', 'B']);
  });
  it('spread: sample SD of the band brews\' same-bag deltas', () => {
    const st = pairedDeltas([...many(3, 1, 91, 8), ...many(3, 1, 94, 7)], temp);
    expect(st[0].spread).toBeCloseTo(0.1);
  });
  it('spread ignores unpaired bags', () => {
    const wide = [4, 6, 8].map((rating) => brew({ coffeeId: 2, tempC: 91, rating })); // bag 2 never leaves 90–92: unpaired
    const st = pairedDeltas([...many(3, 1, 91, 8), ...many(3, 1, 94, 7), ...wide], temp);
    expect(st[0].spread).toBeCloseTo(0.1);
  });
});

describe('ladder', () => {
  const sameBag = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8), ...many(10, id, 94, 7)]);
  it('tier 1: same bag, ≥ 2 solid bands; exact temps first', () => {
    const s = ladder(sameBag, [], [exact, temp])!;
    expect(s).toMatchObject({ tier: 1, verdict: 'win', group: null, bags: 3 });
    expect(s.best).toMatchObject({ label: '91 °C', strength: 'solid' });
    expect(s.best!.value).toBeCloseTo(0.5);
  });
  it('falls back to bands when no exact temp is solid', () => {
    const rows = [1, 2, 3].flatMap((id) => [...many(5, id, 91, 8), ...many(5, id, 92, 8), ...many(10, id, 94, 7)]);
    expect(ladder(rows, [], [exact, temp])!.best!.label).toBe('90–92 °C');
  });
  it('tier 2: bag means within the narrowest group that has ≥ 2 solid bands', () => {
    const cross = [...[1, 2, 3].flatMap((id) => many(10, id, 91, 8)), ...[4, 5, 6].flatMap((id) => many(10, id, 94, 7))];
    const s = ladder(cross, [{ name: 'too narrow', brews: cross.slice(0, 20) }, { name: 'Natural Ultralight coffees', brews: cross }], [temp])!;
    expect(s).toMatchObject({ tier: 2, group: 'Natural Ultralight coffees', bags: 3, next: { label: '93–94 °C' } });
    expect(s.best!.value).toBeCloseTo(8, 1);
  });
  it('tier 2: strength is Bonferroni-corrected over every band of the group, solid or not', () => {
    const a = [1, 2, 3].flatMap((id) => many(12, id, 91, 8));
    const bm = [6.8, 7.2, 6.9, 7.1, 6.8, 7.2];
    const b = bm.flatMap((r, i) => many(6, 10 + i, 94, r));
    const cross = [...a, ...b, ...many(3, 20, 96, 7)]; // 95+ °C: a third band, one bag, not solid
    const z = groupZ([8, 8, 8], [8, 8, 8, ...bm]);
    const s = ladder(cross, [{ name: 'g', brews: cross }], [temp])!;
    expect(s).toMatchObject({ tier: 2, verdict: 'leaning', best: { label: '90–92 °C', strength: 'hint' } });
    expect(strengthOf(z, true, 2)).toBe('solid'); // solid.length as the test count would say win
  });
  it('tier 2: bag means identical to float noise are not a finding', () => {
    const cross = [...[1, 2, 3].flatMap((id) => many(12, id, 91, 8)), ...[4, 5, 6].flatMap((id) => many(12, id, 94, 8))];
    expect(ladder(cross, [{ name: 'g', brews: cross }], [temp])).toMatchObject({ tier: 2, verdict: 'none', best: { strength: 'early' } });
  });
  it('tier 1: a hint leans, a weak gap is no clear winner', () => {
    const two = (hi: number, lo: number) => [1, 2, 3].flatMap((id) => [...noisy(10, id, 91, hi), ...noisy(10, id, 94, lo)]);
    expect(ladder(two(8.07, 7.93), [], [temp])).toMatchObject({ tier: 1, verdict: 'leaning', best: { label: '90–92 °C', strength: 'hint' } });
    expect(ladder(two(8.02, 7.98), [], [temp])).toMatchObject({ tier: 1, verdict: 'none', best: { strength: 'early' } });
  });
  it('usual.mean is bag-weighted: a 40-brew bag does not outvote a 2-brew one', () => {
    const rows = [...many(39, 1, 91, 8), ...many(2, 2, 91, 6)];
    expect(ladder(rows, [], [temp])!.usual.mean).toBeCloseTo(7, 1);
  });
  it('tier 2 counts bags, not brews: one big bag is not solid', () => {
    const rows = [...many(40, 1, 91, 8), ...[4, 5, 6].flatMap((id) => many(10, id, 94, 7))];
    expect(ladder(rows, [{ name: 'g', brews: rows }], [temp])!.tier).toBe(3);
  });
  it('tier 3: not varied → always; varied but thin → varied', () => {
    expect(ladder(many(6, 1, 92, 8), [{ name: 'g', brews: many(6, 1, 92, 8) }], [temp])).toMatchObject(
      { tier: 3, verdict: 'none', best: null, varied: false, usual: { label: '90–92 °C' } });
    const thin = [...many(3, 1, 91, 8), ...many(3, 2, 94, 7)];
    expect(ladder(thin, [{ name: 'g', brews: thin }], [temp])).toMatchObject({ tier: 3, varied: true });
  });
  it('usual: most-brewed coarse band and its plain mean; null when nothing has the variable', () => {
    expect(ladder(sameBag, [], [exact, temp])!.usual.label).toBe('90–92 °C');
    expect(ladder([brew({ rating: 8 })], [], [temp])).toBeNull();
  });
  it('bands: every band of the tier used, in band order, solid as that tier counts it', () => {
    // Tier 1: same-bag deltas of the band set that won (exact temps), thin bands pale.
    const t1 = ladder([...sameBag, ...many(2, 1, 96, 7), ...many(2, 1, 91, 8)], [], [exact, temp])!;
    expect(t1.tier).toBe(1);
    expect(t1.bands.map((b) => [b.label, b.solid])).toEqual([['91 °C', true], ['94 °C', true], ['96 °C', false]]);
    expect(t1.bands[0].value).toBeCloseTo(t1.best!.value);
    // Tier 2: the group's bands as means of bag means.
    const cross = [...[1, 2, 3].flatMap((id) => many(10, id, 91, 8)), ...[4, 5, 6].flatMap((id) => many(10, id, 94, 7)), ...many(3, 7, 96, 6)];
    const t2 = ladder(cross, [{ name: 'g', brews: cross }], [temp])!;
    expect(t2.bands).toMatchObject([
      { label: '90–92 °C', bags: 3, brews: 30, solid: true }, { label: '93–94 °C', bags: 3, brews: 30, solid: true },
      { label: '95+ °C', bags: 1, brews: 3, solid: false }]);
    expect(t2.bands[1].value).toBeCloseTo(7, 1); // 10 brews cycle r ± 0.1 unevenly
    // Tier 3: the widest group's coarse bands, all pale.
    const thin = [...many(3, 1, 91, 8), ...many(3, 2, 94, 7)];
    expect(ladder(thin, [{ name: 'g', brews: thin }], [temp])!.bands.map((b) => [b.label, b.solid])).toEqual([['90–92 °C', false], ['93–94 °C', false]]);
  });
  it('verdicts: solid wins, hint leans, anything else none', () =>
    expect([verdictOf('solid'), verdictOf('hint'), verdictOf('early'), verdictOf(null)]).toEqual(['win', 'leaning', 'none', 'none']));
});

describe('breakdown', () => {
  it('rows = slice values with ≥ 3 bags; thin cells blank with counts; missing cells null', () => {
    const light = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8, { roastLevel: 'Light' }), ...many(10, id, 94, 7, { roastLevel: 'Light' })]);
    const rare = [7, 8].flatMap((id) => [...many(10, id, 91, 8, { roastLevel: 'Medium' }), ...many(10, id, 94, 7, { roastLevel: 'Medium' })]);
    const thin = [4, 5, 6].flatMap((id) => [...many(2, id, 91, 8, { roastLevel: 'Nordic' }), ...many(2, id, 94, 7, { roastLevel: 'Nordic' })]);
    const b = breakdown([...light, ...rare, ...thin], temp, SLICE_OF.roast, ['< 90 °C', '90–92 °C', '93–94 °C'])!;
    expect(b.rows).toEqual(['Light', 'Nordic']);
    expect(b.cells[0][0]).toBeNull();
    expect(b.cells[0][1]!.delta).toBeCloseTo(0.5);
    // Thin: keeps its delta (drawn faded), not solid.
    expect(b.cells[1][1]).toMatchObject({ solid: false, brews: 6, bags: 3 });
    expect(b.cells[1][1]!.delta).toBeCloseTo(0.5);
    expect(b.cells[0][1]!.solid).toBe(true);
  });
  it('cellOf: counts are the paired brews and bags behind the delta', () => {
    const [a] = pairedDeltas([...many(2, 1, 91, 8), ...many(2, 1, 94, 7), ...many(3, 2, 91, 6)], temp);
    expect(cellOf(a)).toEqual({ delta: a.delta, solid: false, brews: 2, bags: 1 }); // thin: faded, counts match the pairs
    expect(a.delta).not.toBeNull();
    expect(cellOf({ ...a, solid: true })).toMatchObject({ delta: a.delta, solid: true, brews: 2, bags: 1 });
    expect(cellOf({ ...a, delta: null, brews: 0, bags: 0 })).toMatchObject({ delta: null, solid: false }); // no paired brews: blank
  });
  it('nothing qualifies → null', () => expect(breakdown(many(4, 1, 91, 8), temp, SLICE_OF.roast, ['90–92 °C'])).toBeNull());
});

const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, ...o
});
describe('labOptions', () => {
  const bags = [1, 2, 3, 4].map((id) => bag({ id, slug: `s${id}`, roastLevel: id < 4 ? 'Light' : 'Medium', processGroup: 'Natural',
    origin: 'Kenya', roaster: `R${id}`, firstBrew: '2026-09-01', status: id === 1 ? 'archive' : 'open' }));
  const o = labOptions([...many(3, 1, 91, 8, { grinder: 'ZP6 (1ZPresso)' }), ...many(5, 2, 91, 8, { grinder: 'A4Z (Femobook)' })], bags);
  it('roast levels need ≥ 3 bags; other values any brewed bag', () => {
    expect(o.roasts).toEqual(['Light']);
    expect(o.roasters).toEqual(['R1', 'R2', 'R3', 'R4']);
  });
  it('grinders: most rated brews first, slugged', () =>
    expect(o.grinders).toEqual([{ slug: 'a4z-femobook', name: 'A4Z (Femobook)' }, { slug: 'zp6-1zpresso', name: 'ZP6 (1ZPresso)' }]));
  it('bags: every slugged bag, on-hand flagged', () =>
    expect(o.bags[0]).toEqual({ slug: 's1', label: 'R1 C', onHand: false, roast: 'Light', process: 'Natural' }));
});

describe('sweetSpotsTab', () => {
  const rows = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8, { roastLevel: 'Light', water: 'A', dripper: 'V60' }),
    ...many(10, id, 94, 7, { roastLevel: 'Light', water: 'B', dripper: 'V60' })]);
  const bags = [1, 2, 3].map((id) => bag({ id, slug: `s${id}`, name: `Bag ${id}` }));
  const tab = (filters = {}) => sweetSpotsTab(rows, bags, { period: P, ratings: 'all', grinder: null, filters });
  it('matching line counts the slice', () => expect(tab().matching).toEqual({ bags: 3, brews: 60 }));
  it('cards: only variables with data, in spec order', () =>
    expect(tab().cards.map((c) => c.key)).toEqual(['temp', 'water', 'dripper']));
  it('no matching brews: zero line, no cards, no top bags', () =>
    expect(tab({ roast: 'Nordic' })).toEqual({ matching: { bags: 0, brews: 0 }, cards: [], topBags: [] }));
  it('top bags: ≤ 5 by adjusted bag rating (K = 5 brews), usual temp · water · dripper', () => {
    const t = tab().topBags;
    expect(t.length).toBeLessThanOrEqual(5);
    expect(t[0]).toMatchObject({ label: 'Bag 1', sub: 'R', href: '/coffees/s1', brews: 20 });
    expect(t[0].usual).toBe('91 °C · A · V60');
  });
  it('top bags tie order: by score, then label', () => expect(tab().topBags.map((b) => b.label)).toEqual(['Bag 1', 'Bag 2', 'Bag 3']));
  it('top bags: shrinkage ranks 10 brews at 8.5 above one 10-rated brew', () => {
    const r = (id: number, k: number, v: number) => Array.from({ length: k }, () => brew({ coffeeId: id, rating: v }));
    const t = sweetSpotsTab([...r(1, 1, 10), ...r(2, 10, 8.5), ...r(3, 10, 6)], bags, { period: P, ratings: 'all', grinder: null, filters: {} }).topBags;
    expect(t.map((b) => b.label)).toEqual(['Bag 2', 'Bag 1', 'Bag 3']);
  });
  it('top bags: listed bags sharing a name get their roast dates as a tag', () => {
    const twins = [bag({ id: 1, name: 'Gesha', purchaseDate: '2026-03-04' }), bag({ id: 2, name: 'Gesha', purchaseDate: '2026-08-15' }), bag({ id: 3, name: 'Other', purchaseDate: '2026-05-01' })];
    const r = [1, 2, 3].map((id) => brew({ coffeeId: id, rating: 9 - id }));
    expect(sweetSpotsTab(r, twins, { period: P, ratings: 'all', grinder: null, filters: {} }).topBags.map((b) => [b.label, b.tag]))
      .toEqual([['Gesha', 'roasted Mar 4'], ['Gesha', 'roasted Aug 15'], ['Other', null]]);
    const sameDay = twins.map((b) => ({ ...b, purchaseDate: '2026-05-05', firstBrew: `2026-0${5 + b.id}-02` }));
    expect(sweetSpotsTab(r, sameDay, { period: P, ratings: 'all', grinder: null, filters: {} }).topBags.map((b) => [b.label, b.tag]))
      .toEqual([['Gesha', 'opened Jun 2'], ['Gesha', 'opened Jul 2'], ['Other', null]]);
  });
  it('top bags: at most 5 of 6', () => {
    const six = [1, 2, 3, 4, 5, 6].map((id) => brew({ coffeeId: id, rating: 8 }));
    expect(sweetSpotsTab(six, [], { period: P, ratings: 'all', grinder: null, filters: {} }).topBags).toHaveLength(5);
  });
  it('groups with partial filters', () => {
    expect(groupsFor(rows, { roast: 'Light', origin: 'Kenya' }).map((g) => g.name)).toEqual(['Light coffees from Kenya', 'Light coffees']);
    expect(groupsFor(rows, { origin: 'Kenya' }).map((g) => g.name)).toEqual(['all coffees from Kenya', 'all coffees']);
  });
  it('groups widen origin → roaster → process → roast, deduped', () => {
    expect(groupsFor(rows, { roast: 'Light', process: 'Natural', origin: 'Kenya', roaster: 'R' }).map((g) => g.name)).toEqual(
      ['Natural Light coffees from Kenya by R', 'Natural Light coffees by R', 'Natural Light coffees', 'Light coffees']);
    expect(groupsFor(rows, {}).map((g) => g.name)).toEqual(['all coffees']);
  });
});

describe('brewingTab', () => {
  const c0 = { period: P, ratings: 'all' as const, grinder: null, by: {}, exact: false };
  // 3 Light + 3 Nordic bags: 10 brews each at rest 10 (0–21 d), 25 (22–30 d), 35 (31–45 d); 91 °C beats 94 °C.
  const rows = [1, 2, 3, 4, 5, 6].flatMap((id) => [10, 25, 35].flatMap((rest, k) =>
    Array.from({ length: 10 }, (_, i) => brew({ coffeeId: id, restDays: rest, roastLevel: id < 4 ? 'Light' : 'Nordic', tempC: i % 2 ? 91 : 94,
      rating: +(7 + (i % 2) * 0.5 + (k === 1 ? 0.3 : 0) + ((i % 3) - 1) * 0.1).toFixed(2), brewIndex: k * 10 + i + 1,
      grinder: 'A4Z', grind: `1.${6 - k}.0`, ratio: i % 2 ? 16 : 17, dose: i % 2 ? 15 : 17, brewTimeSeconds: i % 2 ? 100 : 200, bloomSeconds: i % 2 ? 30 : 45 }))));
  const tab = (o: Partial<Parameters<typeof brewingTab>[1]> = {}) =>
    brewingTab(rows, { period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: false, ...o });
  it('rest curve: a line per roast level with ≥ 2 solid bands, bag means less the roast level\'s mean', () => {
    const r = tab().rest!;
    expect(r.x).toEqual(['0–21 d', '22–30 d', '31–45 d']); // trimmed to the bands with data
    expect(r.lines.map((l) => l.label)).toEqual(['Light', 'Nordic']);
    // Each bag: 7.24 / 7.54 / 7.24 by band, mean 7.34.
    expect(r.lines[0].values).toEqual([-0.1, 0.2, -0.1]);
    expect(r.faded).toBe(false);
    expect(r.unit).toBe('vs roast level average');
    // A bag with no rest band (and an outlier rating) moves neither the bands nor the centre.
    const extra = [...rows, ...Array.from({ length: 10 }, () => brew({ coffeeId: 7, roastLevel: 'Light', restDays: null, rating: 2 }))];
    expect(brewingTab(extra, { period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: false }).rest!.lines[0].values).toEqual([-0.1, 0.2, -0.1]);
  });
  it('rest curve: bags at one rest band each still draw (unit = bag, no pairs needed)', () => {
    // 6 Light bags, 10 brews each, all at one rest: 3 at 10 d rated 7, 3 at 25 d rated 8.
    const one = [1, 2, 3, 4, 5, 6].flatMap((id) => Array.from({ length: 10 }, () => brew({ coffeeId: id, roastLevel: 'Light', restDays: id < 4 ? 10 : 25, rating: id < 4 ? 7 : 8 })));
    expect(brewingTab(one, c0).rest!.lines).toEqual([{ label: 'Light', values: [-0.5, 0.5] }]);
    // Leading and trailing empty bands trimmed, an inner gap kept: 22–30 d and 46–60 d → x 22–30 … 46–60.
    const gap = one.map((b) => ({ ...b, restDays: b.restDays === 10 ? 25 : 50 }));
    const g = brewingTab(gap, c0).rest!;
    expect(g.x).toEqual(['22–30 d', '31–45 d', '46–60 d']);
    expect(g.lines[0].values).toEqual([-0.5, null, 0.5]);
  });
  it('rest curve: no roast level with 2 solid bands → every band drawn, faded', () => {
    const at = (id: number, rest: number, n: number, ratings: number[]) =>
      Array.from({ length: n }, (_, i) => brew({ coffeeId: id, roastLevel: 'Solo', restDays: rest, rating: ratings[i % ratings.length] }));
    const solo = [4, 5, 6].flatMap((id) => [...at(id, 10, 10, [7, 8]), ...at(id, 25, 2, [8])]);
    const r = brewingTab(solo, c0).rest!;
    expect(r.faded).toBe(true);
    expect(r.lines).toEqual([{ label: 'Solo', values: [-0.08, 0.42] }]);
    expect(brewingTab(solo.filter((b) => b.restDays === 10), c0).rest).toBeNull(); // one band: no line at all
  });
  it('variable charts drop bands with no paired brews; exact temps keep every °C used', () => {
    const extra = [...rows, ...[7, 8].flatMap((id) => Array.from({ length: 4 }, () => brew({ coffeeId: id, tempC: 88, rating: 7 })))];
    const t = (exact: boolean) => brewingTab(extra, { period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact }).vars[0].bands.map((b) => b.label);
    expect(t(false)).toEqual(['90–92 °C', '93–94 °C']);
    expect(t(true)).toEqual(['88 °C', '91 °C', '94 °C']);
  });
  it('dial-in pairs single brews per brew number', () => {
    const d = tab().dialIn;
    expect(d.map((s) => s.label)).toEqual(['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10+']);
    expect(d[0].delta).not.toBeNull();
  });
  it('brews to your best: brew # of each bag\'s best (earliest on ties), every label', () => {
    const b = tab().bestAt;
    expect(b.map((x) => x.label)).toEqual(['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10+']);
    expect(b.reduce((s, x) => s + x.bags, 0)).toBe(6);
  });
  it('grind drift: change vs the bag\'s first setting, negative = finer', () => {
    const d = tab().drift;
    expect(d[0]).toMatchObject({ label: '#1', value: 0, bags: 6, solid: true });
    expect(d.at(-1)!.value).toBeLessThan(0);
    expect(tab({ grinder: 'ZP6' }).drift).toEqual([]);
  });
  it('variable charts; exact temps; breakdown rows', () => {
    expect(tab().vars.map((v) => v.key)).toEqual(['temp', 'ratio', 'dose', 'time', 'bloom', 'grind']);
    expect(tab().vars.map((v) => v.bands[0].label)).toEqual(['90–92 °C', '1:15.5–16.5', '< 16 g', '1:30–1:44', '30 s', '1.4.0']);
    expect(tab({ grinder: 'ZP6' }).vars.map((v) => v.key)).not.toContain('grind');
    expect(tab({ exact: true }).vars[0].bands.map((b) => b.label)).toEqual(['91 °C', '94 °C']);
    const by = tab({ by: { temp: 'roast' } }).vars[0].by!;
    expect(by.rows).toEqual(['Light', 'Nordic']);
    expect(by.cols).toEqual(['90–92 °C', '93–94 °C']);
    expect(tab().vars[0].by).toBeNull();
  });
  it('empty period: nothing, no NaN', () => {
    const e = brewingTab(rows, { period: { start: '2000-01-01', end: '2000-01-31' }, ratings: 'all', grinder: 'A4Z', by: {}, exact: false });
    expect(e).toEqual({ rest: null, dialIn: [], bestAt: [], drift: [], vars: [] });
  });
  it('rest curve: a lone solid band draws no line; a thin band is null; values are rounded', () => {
    const at = (id: number, roastLevel: string, rest: number, n: number, ratings: number[]) =>
      Array.from({ length: n }, (_, i) => brew({ coffeeId: id, roastLevel, restDays: rest, rating: ratings[i % ratings.length] }));
    // Thin: bags 1-3 have 10 + 10 solid brews per band and 2 at 31–45 d (6 paired brews < 30). Solo: one solid band, one thin.
    const thin = [1, 2, 3].flatMap((id) => [...at(id, 'Thin', 10, 10, [7, 8]), ...at(id, 'Thin', 25, 10, [8, 9]), ...at(id, 'Thin', 35, 2, [7])]);
    const solo = [4, 5, 6].flatMap((id) => [...at(id, 'Solo', 10, 10, [7, 8]), ...at(id, 'Solo', 25, 2, [8])]);
    const r = brewingTab([...thin, ...solo], { period: P, ratings: 'all', grinder: null, by: {}, exact: false }).rest!;
    expect(r.lines.map((l) => l.label)).toEqual(['Thin']);
    expect(r.faded).toBe(false);
    expect(r.lines[0].values).toEqual([-0.41, 0.59]);
  });
  const bag1 = (ratings: number[], ids = [1]) => ids.flatMap((coffeeId) => ratings.map((rating, i) => brew({ coffeeId, rating, brewIndex: i + 1, grinder: 'A4Z', grind: `1.${6 - i}.0` })));
  const c1 = { period: P, ratings: 'all' as const, grinder: 'A4Z', by: {}, exact: false };
  it('best brew: earliest wins a tie', () => {
    expect(brewingTab(bag1([7, 8, 8, 7, 7]), c1).bestAt.find((x) => x.bags)).toEqual({ label: '#2', bags: 1 });
  });
  it('best brew: a 4-brew bag does not count', () => {
    const b = brewingTab([...bag1([7, 8, 8, 7, 7]), ...bag1([7, 7, 7, 9], [2])], c1).bestAt;
    expect(b.reduce((s, x) => s + x.bags, 0)).toBe(1);
    expect(b.find((x) => x.label === '#4')!.bags).toBe(0);
  });
  it('drift: solid needs ≥ 3 bags; a single brew number is no curve', () => {
    expect(brewingTab(bag1([7, 8, 8], [1, 2]), c1).drift.map((d) => d.solid)).toEqual([false, false, false]);
    expect(brewingTab(bag1([7, 8, 8], [1, 2, 3]), c1).drift.map((d) => d.solid)).toEqual([true, true, true]);
    expect(brewingTab(bag1([7]), c1).drift).toEqual([]);
  });
  it('drift baseline: the first in-period brew on the chosen grinder', () => {
    const rows = [
      brew({ coffeeId: 1, brewIndex: 1, grinder: 'ZP6', grind: '9.0.0' }), // another grinder: not the baseline
      brew({ coffeeId: 1, brewIndex: 2, grinder: 'A4Z', grind: '1.5.0' }),
      brew({ coffeeId: 1, brewIndex: 3, grinder: 'A4Z', grind: '1.4.0' }),
      brew({ coffeeId: 1, brewIndex: 0, grinder: 'A4Z', grind: '2.0.0', localDate: '2026-08-01' }) // before the period: not the baseline
    ];
    expect(brewingTab(rows, c1).drift).toMatchObject([{ label: '#2', value: 0 }, { label: '#3', value: -0.1 }]);
  });
});

describe('waterTab', () => {
  const prof = (calcium: number, magnesium: number) => ({ calcium, magnesium, sodium: 0, potassium: 5, chloride: 10, sulfate: 10, gh: calcium * 2.5 + magnesium * 4.1, kh: 6 });
  const rows = [1, 2, 3].flatMap((id) => [
    ...many(10, id, 92, 8, { water: 'A', waterProfile: prof(10, 15), roastLevel: 'Light', localDate: '2026-09-02' }),
    ...many(10, id, 92, 7.5, { water: 'B', waterProfile: prof(20, 5), roastLevel: 'Light', localDate: '2026-09-20' })]);
  const bags = [1, 2, 3].map((id) => bag({ id, slug: `s${id}`, name: `Bag ${id}` }));
  const w = waterTab(rows, bags, { period: P, ratings: 'all' });
  it('recipes: same-bag delta first, months used', () => {
    expect(w.recipes.map((r) => r.label)).toEqual(['A', 'B']);
    expect(w.recipes[0]).toMatchObject({ months: 'Sep', solid: true });
    expect(w.recipes[0].delta).toBeCloseTo(0.25);
  });
  it('minerals: plain adjusted means per value, only minerals with ≥ 2 values', () => {
    expect(w.minerals.map((m) => m.key)).toEqual(['calcium', 'magnesium', 'gh', 'mgca', 'mgk']);
    expect(w.minerals[0].bars.map((b) => b.label)).toEqual(['10', '20']);
    expect(w.minerals[0].bars.map((b) => b.solid)).toEqual([true, true]); // 3 bags, 30 brews each
    expect(w.minerals[0].bars[0].value).toBeGreaterThan(w.minerals[0].bars[1].value);
    expect(w.minerals[0].overall).toBeCloseTo(7.74);
  });
  it('mineral bars are not solid under MIN_BAGS / MIN_BREWS', () => {
    const thin = waterTab(rows.filter((r) => r.coffeeId === 1 || r.coffeeId === 2), bags, { period: P, ratings: 'all' });
    expect(thin.minerals[0].bars.map((b) => b.solid)).toEqual([false, false]); // 2 bags
    const few = waterTab([1, 2, 3].flatMap((id) => [
      ...many(5, id, 92, 8, { water: 'A', waterProfile: prof(10, 15) }), ...many(5, id, 92, 7.5, { water: 'B', waterProfile: prof(20, 5) })]), bags, { period: P, ratings: 'all' });
    expect(few.minerals[0].bars.map((b) => b.solid)).toEqual([false, false]); // 15 brews each
  });
  it('GH bands, heatmaps, pairs', () => {
    expect(w.gh.map((s) => s.label)).toEqual(['60–90 ppm']);
    expect(w.byRoast!.rows).toEqual(['Light']);
    expect(w.byProcess!.cols).toEqual(['A', 'B']);
    expect(w.pairs[0]).toMatchObject({ label: 'R Bag 1', href: '/coffees/s1', best: { water: 'A' }, others: [{ water: 'B' }] });
    expect(w.pairs[0].gap).toBeCloseTo(0.5);
  });
  it('pairs: biggest gap first, capped at 10, need ≥ 2 brews per water', () => {
    const many12 = Array.from({ length: 12 }, (_, i) => i + 1);
    const r = many12.flatMap((id) => [...many(2, id, 92, 8, { water: 'A' }), ...many(2, id, 92, 8 - id / 10, { water: 'B' })]);
    const p = waterTab(r, many12.map((id) => bag({ id, slug: `s${id}`, name: `Bag ${id}` })), { period: P, ratings: 'all' }).pairs;
    expect(p).toHaveLength(10);
    expect(p[0].label).toBe('R Bag 12');
    const one = waterTab([...many(1, 1, 92, 8, { water: 'A' }), ...many(2, 1, 92, 7, { water: 'B' }), ...many(2, 1, 92, 6, { water: 'C' })], bags, { period: P, ratings: 'all' }).pairs;
    expect(one[0].best.water).toBe('B');
    expect(one[0].others.map((o) => o.water)).toEqual(['C']);
  });
  it('months span years as "Nov 25–Feb 26"', () => {
    const span = waterTab([...many(2, 1, 92, 8, { water: 'A', localDate: '2025-11-03' }), ...many(2, 1, 92, 8, { water: 'A', localDate: '2026-02-01' })],
      bags, { period: { start: null, end: '2026-09-30' }, ratings: 'all' });
    expect(span.recipes[0].months).toBe('Nov 25–Feb 26');
  });
  it('months within a year: "Feb–Apr"', () => {
    const s = waterTab([...many(2, 1, 92, 8, { water: 'A', localDate: '2026-02-03' }), ...many(2, 1, 92, 8, { water: 'A', localDate: '2026-04-01' })], bags, { period: { start: null, end: '2026-09-30' }, ratings: 'all' });
    expect(s.recipes[0].months).toBe('Feb–Apr');
  });
  it('empty period: every list empty, nulls, no NaN', () => {
    const e = waterTab(rows, bags, { period: { start: '2000-01-01', end: '2000-01-31' }, ratings: 'all' });
    expect(e).toEqual({ recipes: [], minerals: [], gh: [], byRoast: null, byProcess: null, eras: null, pairs: [] });
  });
});

describe('ranked', () => {
  it('delta rows first (desc), then adjusted desc', () => {
    const s = (label: string, delta: number | null, adjusted: number) => ({ label, delta, adjusted }) as unknown as BandStat;
    expect(ranked([s('x', null, 9), s('a', 0.1, 1), s('b', 0.4, 1), s('y', null, 8)]).map((r) => r.label)).toEqual(['b', 'a', 'x', 'y']);
  });
});

describe('gearTab', () => {
  const rows = [1, 2, 3].flatMap((id) => [...many(10, id, 92, 8, { dripper: 'V60', filter: 'Abaca', roastLevel: 'Light' }),
    ...many(10, id, 92, 7, { dripper: 'Origami', filter: 'Abaca', roastLevel: 'Light' }),
    ...many(2, id, 92, 7, { dripper: 'Gabi Master A', filter: '155 (mixed)', roastLevel: 'Light' })]);
  const g = gearTab(rows, { period: P, ratings: 'all' });
  it('drippers ranked by same-bag delta; spread = consistency', () => {
    expect(g.drippers.map((d) => d.label)).toEqual(['V60', 'Origami', 'Gabi Master A']);
    expect(g.drippers[0].spread).not.toBeNull();
  });
  it('filters leave the mixed filter out', () => expect(g.filters.map((f) => f.label)).toEqual(['Abaca']));
  it('dripper × filter matrix and dripper × roast level', () => {
    expect(g.matrix).toMatchObject({ rows: ['V60', 'Origami'], cols: ['Abaca'] });
    expect(g.matrix!.cells[0][0]!.delta).toBeGreaterThan(g.matrix!.cells[1][0]!.delta!);
    expect(g.matrix!.cells[0][0]).toMatchObject({ brews: 30, bags: 3 });
    expect(g.byRoast!.cols).toEqual(['V60', 'Origami', 'Gabi Master A']);
  });
  it('no filters at all: no matrix', () => {
    const r = [1, 2, 3].flatMap((id) => [...many(4, id, 92, 8, { dripper: 'V60' }), ...many(4, id, 92, 7, { dripper: 'Origami' })]);
    expect(gearTab(r, { period: P, ratings: 'all' }).matrix).toBeNull();
  });
});
