import { describe, it, expect } from 'vitest';
import { brewZ, demeaned, sd, strengthOf } from './stats';
import { breakdown, cellOf, labFn, ladder, pairedDeltas, ratedIn, SLICE_OF, verdictOf } from './lab';
import type { BrewFact } from './facts';

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
  it('strength: brewZ vs the other bands, Bonferroni over the band count', () => {
    const rows = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8), ...many(10, id, 94, 7.6), ...many(10, id, 88, 7.4)]);
    const st = pairedDeltas(rows, temp);
    const dm = demeaned(rows);
    const of = (lo: number, hi: number) => dm.filter((r) => r.tempC! >= lo && r.tempC! < hi).map((r) => r.dm);
    const z = brewZ(of(90, 93), [...of(0, 90), ...of(93, 99)], sd(dm.map((r) => r.dm)));
    expect(st.find((s) => s.label === '90–92 °C')!.strength).toBe(strengthOf(z, true, 3));
  });
  it('Bonferroni counts every band in the data, also bands with no pairs', () => {
    // 95 °C is a 4th band (one unpaired bag, no pairs): tests = 4, not 3.
    const rows = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8), ...many(10, id, 94, 7.6), ...many(10, id, 88, 7.4)]);
    const more = [...rows, ...many(3, 9, 96, 7)];
    const dm = demeaned(more);
    const of = (lo: number, hi: number) => dm.filter((r) => r.tempC! >= lo && r.tempC! < hi && r.coffeeId !== 9).map((r) => r.dm);
    const z = brewZ(of(90, 93), [...of(0, 90), ...of(93, 99)], sd(of(0, 99)));
    expect(pairedDeltas(more, temp).find((s) => s.label === '90–92 °C')!.strength).toBe(strengthOf(z, true, 4));
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
    expect(b.cells[1][1]).toMatchObject({ delta: null, brews: 6, bags: 3 });
  });
  it('cellOf: counts are the paired brews and bags behind the delta', () => {
    const [a] = pairedDeltas([...many(2, 1, 91, 8), ...many(2, 1, 94, 7), ...many(3, 2, 91, 6)], temp);
    expect(cellOf(a)).toEqual({ delta: null, brews: 2, bags: 1 }); // not solid: blank, but the counts match the pairs
    expect(cellOf({ ...a, solid: true })).toMatchObject({ delta: a.delta, brews: 2, bags: 1 });
  });
  it('nothing qualifies → null', () => expect(breakdown(many(4, 1, 91, 8), temp, SLICE_OF.roast, ['90–92 °C'])).toBeNull());
});
