import { describe, it, expect } from 'vitest';
import { restZ, strengthOf } from './stats';
import { breakdown, brewingTab, emptyStat, fillGrind, trimBlank, cellOf, groupsFor, matchesCoffee, labFn, labOptions, ladder, HEAD_FIT, MAYBE_FIT, TIE_MARGIN, mightBe, thinOf, tieHead, pairedDeltas, ratedIn, SLICE_OF, sweetSpotsTab, verdictOf, waterTab, gearTab, ranked } from './lab';
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
// Bag i: k brews at 91 °C and k at 94 °C, `gaps[i]` apart (the brew noise cancels in the difference).
const bagGaps = (gaps: number[], k = 10) => gaps.flatMap((g, i) => [...many(k, i + 1, 91, 7 + g / 2), ...many(k, i + 1, 94, 7 - g / 2)]);
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
  // The bag-unit paired t: each bag's 91 °C mean minus its 94 °C mean.
  const zOf = (rows: BrewFact[]) => {
    const d = [...new Set(rows.map((r) => r.coffeeId))].map((id) => {
      const m = (lo: number, hi: number) => { const rs = rows.filter((r) => r.coffeeId === id && r.tempC! >= lo && r.tempC! < hi); return rs.reduce((t, r) => t + r.rating!, 0) / rs.length; };
      return m(90, 93) - m(93, 99);
    }).filter(Number.isFinite);
    const m = d.reduce((t, x) => t + x, 0) / d.length, s = Math.sqrt(d.reduce((t, x) => t + (x - m) ** 2, 0) / (d.length - 1));
    return m / (s / Math.sqrt(d.length));
  };
  const six = [0.5, 0.2, 0.8, -0.1, 0.6, 0.3];
  it('strength: a paired t test with the bag as the unit (stats review I-2), Bonferroni over the band count', () => {
    const rows = bagGaps(six), z = zOf(rows);
    const got = pairedDeltas(rows, temp).find((s) => s.label === '90–92 °C')!.strength;
    expect(got).toBe(strengthOf(z, true, 2, 6));
    expect(got).toBe('hint');
    expect(got).not.toBe(strengthOf(z, true, 1, 6)); // would be solid without the correction
    // Brews are not units: three times the brews per bag, same bags, same verdict.
    expect(pairedDeltas(bagGaps(six, 30), temp).find((s) => s.label === '90–92 °C')!.strength).toBe('hint');
  });
  it('a bar and its badge never disagree in sign: the per-bag gap against the bar is Too early (stats re-review B)', () => {
    // Every bag: 94 °C 0.5 under 91 °C, plus one 1-rated 88 °C brew (unpaired) that pulls the bag mean down, so the
    // 94 °C brews still sit above it: the bar reads +, the per-bag test says − with a large |t|.
    const rows = [0.5, 0.4, 0.6, 0.45, 0.55, 0.5].flatMap((g, i) => [...bagGaps([g]).map((r) => ({ ...r, coffeeId: i + 1 })), ...many(1, i + 1, 88, 1)]);
    const b94 = pairedDeltas(rows, temp).find((s) => s.label === '93–94 °C')!;
    expect(b94.delta!).toBeGreaterThan(0);
    expect(b94.strength).toBe('early');
    expect(pairedDeltas(rows, temp).find((s) => s.label === '90–92 °C')!.strength).toBe('solid'); // same sign: badged
  });
  it('Bonferroni counts every band in the data, also bands with no pairs', () => {
    // 3 bags at t(2) 4.16: Possible over 2 bands; an unpaired 88 °C bag makes it 3 tests: Too early.
    const rows = bagGaps([0.25, 0.1, 0.2]);
    expect(pairedDeltas(rows, temp).find((s) => s.label === '90–92 °C')!.strength).toBe('hint');
    expect(pairedDeltas([...rows, ...many(3, 9, 88, 7)], temp).find((s) => s.label === '90–92 °C')!.strength).toBe('early');
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
  it('sd: sample SD of the band\'s rated brews\' ratings (every brew, paired or not); null under 2', () => {
    const st = pairedDeltas([...many(3, 1, 91, 8), ...many(3, 1, 94, 7), brew({ coffeeId: 2, tempC: 96, rating: 5 })], temp);
    expect(st[0].sd).toBeCloseTo(0.1);
    expect(st[2]).toMatchObject({ label: '95+ °C', sd: null });
  });
  it('spread ignores unpaired bags', () => {
    const wide = [4, 6, 8].map((rating) => brew({ coffeeId: 2, tempC: 91, rating })); // bag 2 never leaves 90–92: unpaired
    const st = pairedDeltas([...many(3, 1, 91, 8), ...many(3, 1, 94, 7), ...wide], temp);
    expect(st[0].spread).toBeCloseTo(0.1);
  });
});

describe('ladder', () => {
  // 3 bags, 91 °C about 1 above 94 °C in each (1.2, 0.8, 1.0: t(2) 8.7).
  const sameBag = [1.2, 0.8, 1.0].flatMap((g, i) => [...many(10, i + 1, 91, 7.5 + g / 2), ...many(10, i + 1, 94, 7.5 - g / 2)]);
  it('tier 1: same bag, ≥ 2 solid bands; exact temps first', () => {
    const s = ladder(sameBag, [], [exact, temp])!;
    expect(s).toMatchObject({ tier: 1, verdict: 'win', group: null, bags: 3 });
    expect(s.best).toMatchObject({ label: '91 °C', strength: 'solid' });
    expect(s.best!.value).toBeCloseTo(0.5);
  });
  it('grind bands carry their range into the card bands (tiers 1 and 2)', () => {
    const g = (coffeeId: number, grind: string, rating: number) => Array.from({ length: 10 }, () => brew({ coffeeId, grinder: 'A4Z', grind, rating }));
    const grind = labFn('grind', 'A4Z');
    const t1 = ladder([1, 2, 3].flatMap((id) => [...g(id, '1.3.4', 8), ...g(id, '1.4.1', 7)]), [], [grind])!;
    expect(t1.tier).toBe(1);
    expect(t1.bands.map((b) => [b.label, b.range])).toEqual([['1.3.0', '1.3.0 – 1.3.9'], ['1.4.0', '1.4.0 – 1.4.9']]);
    const cross = [...[1, 2, 3].flatMap((id) => g(id, '1.3.4', 8)), ...[4, 5, 6].flatMap((id) => g(id, '1.4.1', 7))];
    const t2 = ladder(cross, [{ name: 'g', brews: cross }], [grind])!;
    expect(t2.tier).toBe(2);
    expect(t2.bands.map((b) => b.range)).toEqual(['1.3.0 – 1.3.9', '1.4.0 – 1.4.9']);
  });
  it('grind keeps its no-match bands, so the card spans every setting brewed (S-grind)', () => {
    const g = (coffeeId: number, grind: string, rating: number) => Array.from({ length: 10 }, () => brew({ coffeeId, grinder: 'A4Z', grind, rating }));
    const grind = labFn('grind', 'A4Z');
    const rows = [...[1, 2, 3].flatMap((id) => [...g(id, '1.3.4', 8), ...g(id, '1.4.1', 7)]), ...g(4, '1.5.2', 6)]; // bag 4: one setting, never paired
    expect(ladder(rows, [], [grind])!.bands.map((b) => b.label)).toEqual(['1.3.0', '1.4.0']);
    const kept = ladder(rows, [], [grind], true)!;
    expect(kept.tier).toBe(1);
    expect(kept.bands.map((b) => [b.label, b.value === null, b.brews])).toEqual([['1.3.0', false, 30], ['1.4.0', false, 30], ['1.5.0', true, 10]]);
  });
  it('fillGrind: an empty band for each missing step, kept bands untouched', () => {
    const have = [emptyStat({ label: '1.3.0', order: 1 }), { ...emptyStat({ label: '1.6.0', order: 2 }), delta: 0.2, brews: 9 }];
    const out = fillGrind(have, emptyStat);
    expect(out.map((b) => [b.label, b.brews])).toEqual([['1.3.0', 0], ['1.4.0', 0], ['1.5.0', 0], ['1.6.0', 9]]);
    expect(out[3]).toBe(have[1]);
    expect(out[1]).toMatchObject({ delta: null, plainBrews: 0, range: '1.4.0 – 1.4.9' });
  });
  it('Brewing and Sweet spots grind (Bands) fill interior steps; Exact lists only settings used', () => {
    const g = (coffeeId: number, grind: string, rating: number) => Array.from({ length: 10 }, () => brew({ coffeeId, grinder: 'A4Z', grind, rating }));
    const rows = [1, 2, 3].flatMap((id) => [...g(id, '1.3.4', 8), ...g(id, '1.6.1', 7)]);
    const grindOf = (exact: boolean) => brewingTab(rows, { all: rows, period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: { grind: exact } }).vars.find((v) => v.key === 'grind')!.bands;
    expect(grindOf(false).map((b) => [b.label, b.plainBrews])).toEqual([['1.3.0', 30], ['1.4.0', 0], ['1.5.0', 0], ['1.6.0', 30]]);
    expect(grindOf(true).map((b) => b.label)).toEqual(['1.3.4', '1.6.1']);
    const spot = sweetSpotsTab(rows, [], { period: P, ratings: 'all', grinder: 'A4Z', filters: {}, all: rows }).cards.find((c) => c.key === 'grind')!.spot;
    expect(spot.bands.map((b) => [b.label, b.brews])).toEqual([['1.3.0', 30], ['1.4.0', 0], ['1.5.0', 0], ['1.6.0', 30]]);
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
  it('tier 2: the winner vs the other solid bands (t test on their 9 bags), Bonferroni over every band of the group', () => {
    const a = [1, 2, 3].flatMap((id) => many(12, id, 91, 8));
    const bm = [6.8, 7.2, 6.9, 7.1, 6.8, 7.2];
    const b = bm.flatMap((r, i) => many(6, 10 + i, 94, r));
    const cross = [...a, ...b, ...many(3, 20, 96, 7)]; // 95+ °C: a third band, one bag, not solid
    const z = restZ([8, 8, 8], bm);
    const s = ladder(cross, [{ name: 'g', brews: cross }], [temp])!;
    expect(s.best!.strength).toBe(strengthOf(z, true, 3, 9));
    expect(s).toMatchObject({ tier: 2, verdict: 'leaning', best: { label: '90–92 °C', strength: 'hint' } });
    expect(strengthOf(z, true, 2, 9)).toBe('solid'); // solid.length as the test count would say win
  });
  it('tier 2 counts a bag brewed in two compared bands once (stats re-review C)', () => {
    // Bags 1–3 at 91 °C and at 94 °C, each band brewed on separate days (no pairs in the slice: tier 1 is skipped).
    const cross = [[8, 7], [8.2, 7.2], [7.9, 7.1]].flatMap(([hi, lo], i) => [...many(12, i + 1, 91, hi), ...many(12, i + 1, 94, lo)]);
    const slice = cross.filter((b) => b.tempC === 91);
    const s = ladder(slice, [{ name: 'g', brews: cross }], [temp])!;
    const z = restZ([8, 8.2, 7.9], [7, 7.2, 7.1]);
    expect(s).toMatchObject({ tier: 2, best: { label: '90–92 °C' } });
    expect(s.best!.strength).toBe(strengthOf(z, true, 2, 3));
    expect(strengthOf(z, true, 2, 3)).not.toBe(strengthOf(z, true, 2, 6)); // 6 bag-band means would overstate it
  });
  it('tier 2: bag means identical to float noise are not a finding', () => {
    const cross = [...[1, 2, 3].flatMap((id) => many(12, id, 91, 8)), ...[4, 5, 6].flatMap((id) => many(12, id, 94, 8))];
    expect(ladder(cross, [{ name: 'g', brews: cross }], [temp])).toMatchObject({ tier: 2, verdict: 'tie', best: { strength: 'early' }, tie: { labels: ['90–92 °C', '93–94 °C'], within: 0, proven: true } });
  });
  it('tier 1: a hint leans, a weak gap is no clear winner', () => {
    // 3 bags: t(2) 4.16 is Possible over 2 bands; t(2) 1.89 is no clear winner.
    expect(ladder(bagGaps([0.25, 0.1, 0.2]), [], [temp])).toMatchObject({ tier: 1, verdict: 'leaning', best: { label: '90–92 °C', strength: 'hint' } });
    expect(ladder(bagGaps([0.3, 0, 0.2]), [], [temp])).toMatchObject({ tier: 1, verdict: 'tie', best: { strength: 'early' }, tie: { proven: false } });
  });
  describe('ties (equivalence within TIE_MARGIN) and early leads', () => {
    it('enough bags, small gaps: a tie of both bands, no badge strength', () => {
      const s = ladder(bagGaps([0.08, -0.08, 0.06, -0.06, 0.04, -0.04, 0.02, -0.02, 0.05, -0.05, 0.03, -0.03]), [], [temp])!;
      expect(s).toMatchObject({ tier: 1, verdict: 'tie', tie: { labels: expect.arrayContaining(['90–92 °C', '93–94 °C']), head: expect.stringMatching(/ or /), list: null } });
      expect(s.tie!.within).toBeLessThan(TIE_MARGIN);
    });
    it('thin data: a small observed gap but wide spread is an unproven tie (Early), not proven', () => {
      expect(ladder(bagGaps([0.3, -0.3, 0.05]), [], [temp])).toMatchObject({ tier: 1, verdict: 'tie', tie: { proven: false, labels: expect.any(Array) } });
    });
    it('an observed gap past the margin names the leader alone (Early, no tie)', () => {
      expect(ladder(bagGaps([0.9, 1.1, 1.0, 0.8]), [], [temp])!.tie?.labels ?? null).toBeNull();
    });
    it('a real gap is never a tie; a win and a lean stay as they are', () => {
      expect(ladder(sameBag, [], [exact, temp])).toMatchObject({ verdict: 'win', tie: null });
      expect(ladder(bagGaps([0.25, 0.1, 0.2]), [], [temp])).toMatchObject({ verdict: 'leaning', tie: null });
    });
    it('tier 2: many bags on each side, close means: a tie; few bags: early', () => {
      const side = (ids: number[], tempC: number, rs: number[]) => ids.flatMap((id, i) => many(10, id, tempC, rs[i % rs.length]));
      const near = [...side([...Array(12).keys()].map((i) => i + 1), 91, [8.0, 8.1, 7.9]), ...side([...Array(12).keys()].map((i) => i + 21), 94, [8.0, 7.9, 8.1])];
      expect(ladder(near, [{ name: 'g', brews: near }], [temp])).toMatchObject({ tier: 2, verdict: 'tie' });
      const few = [...side([1, 2, 3], 91, [8.2, 7.6, 8.0]), ...side([4, 5, 6], 94, [7.9, 8.3, 7.7])];
      expect(ladder(few, [{ name: 'g', brews: few }], [temp])).toMatchObject({ tier: 2, verdict: 'tie', tie: { proven: false } });
    });
  });
  it('an Early single leader is hedged "Maybe X" when that stays on the bare setting\'s line, else the bare setting', () => {
    expect(mightBe('60 s+')).toBe('Maybe 60 s+');
    expect(mightBe('Cafec T90')).toBeNull(); // 15 characters: over MAYBE_FIT
    expect(mightBe('x'.repeat(MAYBE_FIT - 6))).toHaveLength(MAYBE_FIT);
    expect(mightBe('x'.repeat(MAYBE_FIT - 5))).toBeNull();
    // through the ladder: a clear Early leader carries it; wins, leans and ties do not
    const early = ladder(bagGaps([1.4, -0.3, 1.0]), [], [exact, temp])!; // a gap past the margin, three bags with a wide spread
    expect(early).toMatchObject({ verdict: 'early', tie: null, might: 'Maybe 91 °C' });
    expect(ladder(sameBag, [], [exact, temp])!.might).toBeNull();
    expect(ladder(bagGaps([0.25, 0.1, 0.2]), [], [temp])!.might).toBeNull();
  });
  it('thinOf: the top band under the solid minimum that is TIE_MARGIN or more above the best gets the line', () => {
    const band = (label: string, value: number | null, solid: boolean, bags = 2) => ({ label, value, bags, brews: 4, solid, sample: { small: true } }) as never;
    const bands = [band('a', 0.1, true, 9), band('b', 0.1 + TIE_MARGIN, false), band('c', 0.9, false, 3), band('d', 0.1 + TIE_MARGIN - 0.01, false), band('e', null, false), band('f', 2, true, 9)];
    expect(thinOf(0.1, bands)).toEqual({ label: 'c', bags: 3 }); // c is the highest thin one; f is solid, so ignored
    expect(thinOf(0.1, [bands[3], bands[4], bands[0]])).toBeNull(); // below the margin, no value, solid: none
    expect(thinOf(0.1, [bands[1]])).toEqual({ label: 'b', bags: 2 }); // exactly the margin counts
    expect(ladder(sameBag, [], [exact, temp])!.thin).toBeNull();
  });
  it('tieHead: names that fit are listed, longer ones are summarized with the list for the line below', () => {
    expect(tieHead(['Gabi Master A', 'CT62'])).toEqual({ head: 'Gabi Master A or CT62', list: null });
    expect(tieHead(['A', 'B', 'C'])).toEqual({ head: 'A, B or C', list: null });
    const long = ['Lotus - Ultralight (Mg + K)', 'Lotus - Mg/K 60/10'];
    expect(tieHead(long)).toEqual({ head: '2 in the running', list: 'Lotus - Ultralight (Mg + K) or Lotus - Mg/K 60/10' });
    expect(tieHead([...long, 'Third water recipe', 'Fourth']).head).toBe('4 in the running');
    expect(tieHead(['x'.repeat(HEAD_FIT), 'y']).head).toBe('2 in the running');
    expect('4 in the running'.length).toBeLessThanOrEqual(HEAD_FIT);
  });
  it('usual.mean is bag-weighted n/(n+2): a 39-brew bag (0.95) does not outvote a 2-brew one (0.5) 39 to 2', () => {
    const rows = [...many(39, 1, 91, 8), ...many(2, 2, 91, 6)];
    expect(ladder(rows, [], [temp])!.usual.mean).toBeCloseTo(((39 / 41) * 8 + 0.5 * 5.95) / (39 / 41 + 0.5), 6); // the 2-brew bag rates 5.9, 6.0
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
  it('verdicts: solid wins, hint leans, anything else is an early lead', () =>
    expect([verdictOf('solid'), verdictOf('hint'), verdictOf('early'), verdictOf(null)]).toEqual(['win', 'leaning', 'early', 'early']));
});

describe('breakdown', () => {
  it('rows = slice values with ≥ 3 bags; thin cells blank with counts; all-blank columns dropped', () => {
    const light = [1, 2, 3].flatMap((id) => [...many(10, id, 91, 8, { roastLevel: 'Light' }), ...many(10, id, 94, 7, { roastLevel: 'Light' })]);
    const rare = [7, 8].flatMap((id) => [...many(10, id, 91, 8, { roastLevel: 'Medium' }), ...many(10, id, 94, 7, { roastLevel: 'Medium' })]);
    const thin = [4, 5, 6].flatMap((id) => [...many(2, id, 91, 8, { roastLevel: 'Nordic' }), ...many(2, id, 94, 7, { roastLevel: 'Nordic' })]);
    const b = breakdown([...light, ...rare, ...thin], temp, SLICE_OF.roast, ['< 90 °C', '90–92 °C', '93–94 °C'])!;
    expect(b.rows).toEqual(['Light', 'Nordic']);
    expect(b.cols).toEqual(['90–92 °C', '93–94 °C']); // '< 90 °C' had no cell anywhere
    expect(b.cells[0][0]!.delta).toBeCloseTo(0.5);
    // Thin: keeps its delta (drawn faded), not solid.
    expect(b.cells[1][0]).toMatchObject({ solid: false, brews: 6, bags: 3 });
    expect(b.cells[1][0]!.delta).toBeCloseTo(0.5);
    expect(b.cells[0][0]!.solid).toBe(true);
  });
  it('cellOf: counts are the paired brews and bags behind the delta', () => {
    const [a] = pairedDeltas([...many(2, 1, 91, 8), ...many(2, 1, 94, 7), ...many(3, 2, 91, 6)], temp);
    expect(cellOf(a)).toEqual({ delta: a.delta, solid: false, sample: { bags: 1, brews: 2, small: true }, brews: 2, bags: 1 }); // thin: faded, counts match the pairs
    expect(a.delta).not.toBeNull();
    expect(cellOf({ ...a, solid: true })).toMatchObject({ delta: a.delta, solid: true, brews: 2, bags: 1 });
    expect(cellOf({ ...a, delta: null, brews: 0, bags: 0 })).toMatchObject({ delta: null, solid: false }); // no paired brews: blank
  });
  it('trimBlank: rows, then columns, with no delta are dropped; nothing left → null', () => {
    const c = (delta: number | null) => ({ delta, solid: true, sample: { bags: 2, brews: 4, small: true }, brews: 4, bags: 2 });
    expect(trimBlank({ rows: ['a', 'b', 'c'], cols: ['x', 'y', 'z'], cells: [[c(1), null, c(null)], [null, c(null), null], [c(-1), c(null), null]] }))
      .toEqual({ rows: ['a', 'c'], cols: ['x'], cells: [[c(1)], [c(-1)]] });
    expect(trimBlank({ rows: ['a'], cols: ['x'], cells: [[c(null)]] })).toBeNull();
  });
  it('trimBlank ordered: interior blank columns stay, leading/trailing ones go', () => {
    const c = (delta: number | null) => ({ delta, solid: true, sample: { bags: 2, brews: 4, small: true }, brews: 4, bags: 2 });
    expect(trimBlank({ rows: ['a'], cols: ['w', 'x', 'y', 'z'], cells: [[null, c(1), null, c(2)]] }, true))
      .toEqual({ rows: ['a'], cols: ['x', 'y', 'z'], cells: [[c(1), null, c(2)]] });
    expect(trimBlank({ rows: ['a'], cols: ['x'], cells: [[c(null)]] }, true)).toBeNull();
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
  const tab = (filters = {}) => sweetSpotsTab(rows.filter(matchesCoffee(filters)), bags, { period: P, ratings: 'all', grinder: null, filters, all: rows });
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
    const t = (() => { const x = [...r(1, 1, 10), ...r(2, 10, 8.5), ...r(3, 10, 6)]; return sweetSpotsTab(x, bags, { period: P, ratings: 'all', grinder: null, filters: {}, all: x }); })().topBags;
    expect(t.map((b) => b.label)).toEqual(['Bag 2', 'Bag 1', 'Bag 3']);
    expect(t.map((b) => b.sd)).toEqual([0, null, 0]); // sample SD of the bag's ratings; null under 2 brews
  });
  it('top bags: listed bags sharing a name get their roast dates as a tag', () => {
    const twins = [bag({ id: 1, name: 'Gesha', purchaseDate: '2026-03-04' }), bag({ id: 2, name: 'Gesha', purchaseDate: '2026-08-15' }), bag({ id: 3, name: 'Other', purchaseDate: '2026-05-01' })];
    const r = [1, 2, 3].map((id) => brew({ coffeeId: id, rating: 9 - id }));
    expect(sweetSpotsTab(r, twins, { period: P, ratings: 'all', grinder: null, filters: {}, all: r }).topBags.map((b) => [b.label, b.tag]))
      .toEqual([['Gesha', 'roasted Mar 4'], ['Gesha', 'roasted Aug 15'], ['Other', null]]);
    const sameDay = twins.map((b) => ({ ...b, purchaseDate: '2026-05-05', firstBrew: `2026-0${5 + b.id}-02` }));
    expect(sweetSpotsTab(r, sameDay, { period: P, ratings: 'all', grinder: null, filters: {}, all: r }).topBags.map((b) => [b.label, b.tag]))
      .toEqual([['Gesha', 'opened Jun 2'], ['Gesha', 'opened Jul 2'], ['Other', null]]);
  });
  it('top bags: at most 5 of 6', () => {
    const six = [1, 2, 3, 4, 5, 6].map((id) => brew({ coffeeId: id, rating: 8 }));
    expect(sweetSpotsTab(six, [], { period: P, ratings: 'all', grinder: null, filters: {}, all: six }).topBags).toHaveLength(5);
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
  const c0 = { period: P, ratings: 'all' as const, grinder: null, by: {}, exact: {} };
  it('brews until dialed in: the median settle brew per roast level and process, small groups marked (gate P4)', () => {
    const bag = (id: number, roastLevel: string, rs: number[]) =>
      rs.map((rating, i) => brew({ coffeeId: id, roastLevel, processGroup: 'Washed', rating, brewIndex: i + 1 }));
    const all = [...[1, 2, 3].flatMap((id) => bag(id, 'Light', [8, 8, 8, 8, 8, 8])), ...[4, 5].flatMap((id) => bag(id, 'Nordic', [5, 6, 7, 8, 8, 8]))];
    const t = brewingTab(all, { ...c0, all });
    expect(t.settle.roast).toEqual([
      { label: 'Light', value: 1, bags: 3, brews: 18, sample: { bags: 3, brews: 18, small: false } },
      { label: 'Nordic', value: 4, bags: 2, brews: 12, sample: { bags: 2, brews: 12, small: true } }
    ]);
    expect(t.settle.process).toEqual([]); // one group: nothing to compare
  });
  // 3 Light + 3 Nordic bags: 10 brews each at rest 10 (0–21 d), 25 (22–30 d), 35 (31–45 d); 91 °C beats 94 °C.
  const rows = [1, 2, 3, 4, 5, 6].flatMap((id) => [10, 25, 35].flatMap((rest, k) =>
    Array.from({ length: 10 }, (_, i) => brew({ coffeeId: id, restDays: rest, roastLevel: id < 4 ? 'Light' : 'Nordic', tempC: i % 2 ? 91 : 94,
      rating: +(7 + (i % 2) * 0.5 + (k === 1 ? 0.3 : 0) + ((i % 3) - 1) * 0.1).toFixed(2), brewIndex: k * 10 + i + 1,
      grinder: 'A4Z', grind: `1.${6 - k}.0`, ratio: i % 2 ? 16 : 17, dose: i % 2 ? 15 : 17, brewTimeSeconds: i % 2 ? 100 : 200, bloomSeconds: i % 2 ? 30 : 45 }))));
  const tab = (o: Partial<Parameters<typeof brewingTab>[1]> = {}) =>
    brewingTab(rows, { all: rows, period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: {}, ...o });
  it('rest heatmap: a row per roast level, cells = bag-mean per band less the roast level\'s mean', () => {
    const r = tab().rest!;
    expect(r.cols).toEqual(['0–21 d', '22–30 d', '31–45 d']); // trimmed to the bands with data
    expect(r.rows).toEqual(['Light', 'Nordic']);
    // Each bag: 7.24 / 7.54 / 7.24 by band, mean 7.34.
    expect(r.cells[0].map((c) => c!.delta)).toEqual([-0.1, 0.2, -0.1].map((x) => expect.closeTo(x)));
    expect(r.cells[0][1]).toMatchObject({ solid: true, bags: 3, brews: 30 });
    expect(r.best).toEqual([1, 1]);
    // A bag with no rest band (and an outlier rating) moves neither the bands nor the center.
    const extra = [...rows, ...Array.from({ length: 10 }, () => brew({ coffeeId: 7, roastLevel: 'Light', restDays: null, rating: 2 }))];
    expect(brewingTab(extra, { ...c0, all: extra }).rest!.cells[0].map((c) => c!.delta)).toEqual([-0.1, 0.2, -0.1].map((x) => expect.closeTo(x)));
  });
  it('rest heatmap: bags at one rest band each still count (unit = bag, no pairs needed); leading/trailing empty windows dropped', () => {
    // 6 Light bags, 10 brews each, all at one rest: 3 at 10 d rated 7, 3 at 25 d rated 8.
    const one = [1, 2, 3, 4, 5, 6].flatMap((id) => Array.from({ length: 10 }, () => brew({ coffeeId: id, roastLevel: 'Light', restDays: id < 4 ? 10 : 25, rating: id < 4 ? 7 : 8 })));
    expect(brewingTab(one, { ...c0, all: one }).rest).toEqual({ rows: ['Light'], cols: ['0–21 d', '22–30 d'], best: [1],
      cells: [[{ delta: -0.5, solid: true, sample: { bags: 3, brews: 30, small: false }, brews: 30, bags: 3 }, { delta: 0.5, solid: true, sample: { bags: 3, brews: 30, small: false }, brews: 30, bags: 3 }]] });
    const gap = one.map((b) => ({ ...b, restDays: b.restDays === 10 ? 25 : 50 }));
    const g = brewingTab(gap, { ...c0, all: gap }).rest!;
    expect(g.cols).toEqual(['22–30 d', '31–45 d', '46–60 d']); // an interior blank window stays (ui-rules 35)
    expect(g.cells[0].map((c) => c?.delta ?? null)).toEqual([-0.5, null, 0.5]);
  });
  it('rest heatmap: thin cells stay (faded), best only among ≥ 2 solid cells; a roast level needs 3 bags and 2 bands', () => {
    const at = (id: number, roastLevel: string, rest: number, n: number, ratings: number[]) =>
      Array.from({ length: n }, (_, i) => brew({ coffeeId: id, roastLevel, restDays: rest, rating: ratings[i % ratings.length] }));
    // Thin: bags 1-3 have 10 + 10 brews in two bands and 2 at 31–45 d (6 brews < 30). Solo: one solid band, one thin.
    const thin = [1, 2, 3].flatMap((id) => [...at(id, 'Thin', 10, 10, [7, 8]), ...at(id, 'Thin', 25, 10, [8, 9]), ...at(id, 'Thin', 35, 2, [7])]);
    const solo = [4, 5, 6].flatMap((id) => [...at(id, 'Solo', 10, 10, [7, 8]), ...at(id, 'Solo', 25, 2, [8])]);
    const duo = [7, 8].flatMap((id) => [...at(id, 'Duo', 10, 10, [7, 8]), ...at(id, 'Duo', 25, 10, [8])]);
    const r = brewingTab([...thin, ...solo, ...duo], { ...c0, all: [...thin, ...solo, ...duo] }).rest!;
    expect(r.rows).toEqual(['Solo', 'Thin']);
    expect(r.cols).toEqual(['0–21 d', '22–30 d', '31–45 d']);
    expect(r.cells[0].map((c) => c && [c.solid, c.bags, c.brews])).toEqual([[true, 3, 30], [false, 3, 6], null]);
    expect(r.cells[0][1]!.delta).toBeCloseTo(0.42, 2);
    expect(r.cells[1][2]).toMatchObject({ solid: false, bags: 3, brews: 6 });
    expect(r.best).toEqual([null, 1]);
    expect(brewingTab(solo.filter((b) => b.restDays === 10), { ...c0, all: solo.filter((b) => b.restDays === 10) }).rest).toBeNull(); // one band: no row
  });
  it('variable charts drop bands with no paired brews; exact temps keep every °C used', () => {
    const extra = [...rows, ...[7, 8].flatMap((id) => Array.from({ length: 4 }, () => brew({ coffeeId: id, tempC: 88, rating: 7 })))];
    const t = (temp: boolean) => brewingTab(extra, { all: extra, period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: { temp } }).vars[0].bands.map((b) => b.label);
    expect(t(false)).toEqual(['90–92 °C', '93–94 °C']);
    expect(t(true)).toEqual(['88 °C', '91 °C', '94 °C']);
  });
  it('dial-in pairs single brews per brew number', () => {
    const d = tab().dialIn;
    expect(d.map((s) => s.label)).toEqual(['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10+']);
    expect(d[0].delta).not.toBeNull();
  });
  it('brews to your best: brew # of each bag\'s best (earliest on ties), #1–#7', () => {
    const b = tab().bestAt;
    expect(b.map((x) => x.label)).toEqual(['#1', '#2', '#3', '#4', '#5', '#6', '#7']);
    expect(b.reduce((s, x) => s + x.bags, 0)).toBe(6);
  });
  it('grind drift: change vs the bag\'s first setting, negative = finer', () => {
    const d = tab().drift;
    expect(d[0]).toMatchObject({ label: '#1', value: 0, bags: 6 });
    expect(d.at(-1)!.value).toBeLessThan(0);
    expect(tab({ grinder: 'ZP6' }).drift).toEqual([]);
  });
  it('variable charts; exact temps; breakdown rows', () => {
    expect(tab().vars.map((v) => v.key)).toEqual(['temp', 'ratio', 'dose', 'time', 'bloom', 'grind']);
    expect(tab().vars.map((v) => v.bands[0].label)).toEqual(['90–92 °C', '1:15.5–16.5', '< 16 g', '1:30–1:44', '30–44 s', '1.4.0']);
    expect(tab().vars[5].bands[0].range).toBe('1.4.0 – 1.4.9');
    expect(tab({ grinder: 'ZP6' }).vars.map((v) => v.key)).not.toContain('grind');
    expect(tab({ exact: { temp: true } }).vars[0].bands.map((b) => b.label)).toEqual(['91 °C', '94 °C']);
    // Each chart's mode is its own: exact grind leaves temp in bands.
    const x = tab({ exact: { ratio: true, dose: true, time: true, bloom: true, grind: true } }).vars;
    expect(x.map((v) => v.bands[0].label)).toEqual(['90–92 °C', '1:16', '15 g', '1:40', '30 s', '1.4.0']);
    const by = tab({ by: { temp: 'roast' } }).vars[0].by!;
    expect(by.rows).toEqual(['Light', 'Nordic']);
    expect(by.cols).toEqual(['90–92 °C', '93–94 °C']);
    expect(tab().vars[0].by).toBeNull();
  });
  it('grind: a band with brews but no same-bag pair shows as no match (delta null), not dropped', () => {
    const lone = [...rows, ...Array.from({ length: 3 }, () => brew({ coffeeId: 9, rating: 7, grinder: 'A4Z', grind: '1.9.2' }))];
    const g = brewingTab(lone, { all: lone, period: P, ratings: 'all', grinder: 'A4Z', by: {}, exact: {} }).vars.find((v) => v.key === 'grind')!.bands;
    expect(g.find((b) => b.label === '1.9.0')).toMatchObject({ delta: null, plainBrews: 3, plainBags: 1 });
    // Other charts still drop a band with no pair.
    const r2 = [...rows, ...Array.from({ length: 3 }, () => brew({ coffeeId: 9, rating: 7, ratio: 20 }))];
    expect(brewingTab(r2, { ...c0, all: r2 }).vars.find((v) => v.key === 'ratio')!.bands.map((b) => b.label)).not.toContain('1:17.5+');
  });
  it('brewingTab: variables use the scored brews, the dial-in chart every brew', () => {
    const all = [1, 2, 3].flatMap((id) => [8, 8.5, 9, 9].map((r, i) => brew({ coffeeId: id, rating: r, brewIndex: i + 1, tempC: i < 2 ? 88 : 92 })));
    const scored = all.map((b) => (b.brewIndex <= 2 ? { ...b, rating: null } : b));
    const t = brewingTab(scored, { period: P, ratings: 'all', grinder: null, by: {}, exact: {}, all });
    expect(t.dialIn.map((s) => s.label)).toContain('#1');
    expect(t.vars.find((v) => v.key === 'temp')?.bands.some((s) => s.label === '< 90 °C' && s.delta !== null) ?? false).toBe(false);
  });
  it('empty period: nothing, no NaN', () => {
    const e = brewingTab(rows, { all: rows, period: { start: '2000-01-01', end: '2000-01-31' }, ratings: 'all', grinder: 'A4Z', by: {}, exact: {} });
    expect(e).toEqual({ rest: null, dialIn: [], bestAt: [], bestLater: [], drift: [], settle: { roast: [], process: [] }, vars: [] });
  });
  const bag1 = (ratings: number[], ids = [1]) => ids.flatMap((coffeeId) => ratings.map((rating, i) => brew({ coffeeId, rating, brewIndex: i + 1, grinder: 'A4Z', grind: `1.${6 - i}.0` })));
  const c1 = { period: P, ratings: 'all' as const, grinder: 'A4Z', by: {}, exact: {} };
  it('best brew: earliest wins a tie', () => {
    expect(brewingTab(bag1([7, 8, 8, 7, 7]), { ...c1, all: bag1([7, 8, 8, 7, 7]) }).bestAt.find((x) => x.bags)).toEqual({ label: '#2', bags: 1 });
  });
  it('best brew: only each bag\'s first 7 brews count (no bag-length bias)', () => {
    // A late 10 at brew 9 is past the window: the best is the 8 at #2; 5 rated brews are needed inside it.
    const long = bag1([7, 8, 7, 7, 7, 7, 7, 7, 10]);
    expect(brewingTab(long, { ...c1, all: long }).bestAt.find((x) => x.bags)).toEqual({ label: '#2', bags: 1 });
    // The hidden part (the See all tip): that bag's later, better best, by its brew number.
    expect(brewingTab(long, { ...c1, all: long }).bestLater).toEqual([{ label: '#9', bags: 1 }]);
    const tied = bag1([7, 8, 7, 7, 7, 7, 7, 7, 8]); // only a tie after #7: nothing hidden
    expect(brewingTab(tied, { ...c1, all: tied }).bestLater).toEqual([]);
    const late = bag1([7, 8, 7, 7, 7, 7, 7, 7, 10]).filter((b) => b.brewIndex <= 3 || b.brewIndex >= 8); // 3 rated in #1–#7
    expect(brewingTab(late, { ...c1, all: late }).bestAt).toEqual([]);
  });
  it('best brew: a 4-brew bag does not count', () => {
    const b = brewingTab([...bag1([7, 8, 8, 7, 7]), ...bag1([7, 7, 7, 9], [2])], { ...c1, all: [...bag1([7, 8, 8, 7, 7]), ...bag1([7, 7, 7, 9], [2])] }).bestAt;
    expect(b.reduce((s, x) => s + x.bags, 0)).toBe(1);
    expect(b.find((x) => x.label === '#4')!.bags).toBe(0);
  });
  it('drift: a sample under 3 bags or 10 brews is small; a single brew number is no curve', () => {
    expect(brewingTab(bag1([7, 8, 8], [1, 2]), { ...c1, all: bag1([7, 8, 8], [1, 2]) }).drift.map((d) => d.sample.small)).toEqual([true, true, true]);
    expect(brewingTab(bag1([7, 8, 8], [1, 2, 3]), { ...c1, all: bag1([7, 8, 8], [1, 2, 3]) }).drift.map((d) => d.sample.small)).toEqual([true, true, true]);
    expect(brewingTab(bag1([7]), { ...c1, all: bag1([7]) }).drift).toEqual([]);
  });
  it('drift baseline: the first in-period brew on the chosen grinder', () => {
    const rows = [
      brew({ coffeeId: 1, brewIndex: 1, grinder: 'ZP6', grind: '9.0.0' }), // another grinder: not the baseline
      brew({ coffeeId: 1, brewIndex: 2, grinder: 'A4Z', grind: '1.5.0' }),
      brew({ coffeeId: 1, brewIndex: 3, grinder: 'A4Z', grind: '1.4.0' }),
      brew({ coffeeId: 1, brewIndex: 0, grinder: 'A4Z', grind: '2.0.0', localDate: '2026-08-01' }) // before the period: not the baseline
    ];
    expect(brewingTab(rows, { ...c1, all: rows }).drift).toMatchObject([{ label: '#2', value: 0 }, { label: '#3', value: -0.1 }]);
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
  it('mineral map: a row per recipe with an entered profile, ranked as Ratings by recipe; columns Ca … Mg:K', () => {
    expect(w.map!.cols.map((c) => [c.name, c.unit])).toEqual([['Ca', 'mg/L'], ['Mg', 'mg/L'], ['K', 'mg/L'], ['Na', 'mg/L'], ['GH', 'ppm'], ['KH', 'ppm'], ['Mg:Ca', ''], ['Mg:K', '']]);
    expect(w.map!.rows.map((r) => r.label)).toEqual(['A', 'B']);
    expect(w.map!.rows[0]).toMatchObject({ solid: true, brews: 30, bags: 3 });
    expect(w.map!.rows[0].delta).toBeCloseTo(0.25);
    expect(w.map!.rows[0].values).toEqual([10, 15, 5, 0, 87, 6, 1.5, 3]);
  });
  it('mineral map: a recipe with no profile, or one with every mineral 0 or empty, has no row; no match rows last', () => {
    const blank = { calcium: 0, magnesium: null, sodium: 0, potassium: 0, chloride: null, sulfate: 0, gh: 0, kh: 40 };
    const x = waterTab([...rows,
      ...[4, 5, 6].flatMap((id) => many(10, id, 92, 6, { water: 'C', waterProfile: blank, localDate: '2026-09-10' })),
      ...many(4, 7, 92, 7, { water: 'D', localDate: '2026-09-10' }),
      ...many(4, 8, 92, 7, { water: 'E', waterProfile: prof(30, 2), localDate: '2026-09-10' })], bags, { period: P, ratings: 'all' });
    expect(x.map!.rows.map((r) => [r.label, r.delta === null])).toEqual([['A', false], ['B', false], ['E', true]]);
    expect(x.gh.map((s) => [s.label, s.delta === null])).toEqual([['71 ppm', false], ['83 ppm', true], ['87 ppm', false]]); // E's GH: no match
    expect(waterTab(rows.map((r) => ({ ...r, waterProfile: null })), bags, { period: P, ratings: 'all' }).map).toBeNull();
  });
  it('pairs: a repurchase (same roaster and name) carries its roast date', () => {
    const twin = [1, 2, 3].map((id) => bag({ id, name: 'Same', purchaseDate: `2026-0${id + 5}-0${id}` }));
    expect(waterTab(rows, twin, { period: P, ratings: 'all' }).pairs[0].bags.map((p) => p.tag)).toEqual(['roasted Jun 1', 'roasted Jul 2', 'roasted Aug 3']);
    expect(w.pairs[0].bags.every((p) => p.tag === null)).toBe(true);
  });
  it('GH by exact value, heatmaps', () => {
    expect(w.gh.map((s) => s.label)).toEqual(['71 ppm', '87 ppm']);
    expect(w.byRoast!.rows).toEqual(['Light']);
    expect(w.byProcess!.cols).toEqual(['A', 'B']);
  });
  it('pairs: grouped by recipe pair, won/lost/tied and mean delta from A\'s side, bags with both ratings', () => {
    expect(w.pairs).toHaveLength(1);
    const p = w.pairs[0];
    expect(p).toMatchObject({ a: 'A', b: 'B', won: 3, lost: 0, tied: 0 });
    expect(p.delta).toBeCloseTo(0.5);
    expect(p.bags[0]).toMatchObject({ label: 'R · Bag 1', href: '/coffees/s1', tag: null });
    expect(p.bags[0].a).toBeCloseTo(8, 1);
    expect(p.bags[0].b).toBeCloseTo(7.5, 1);
  });
  it('pairs: each bag carries the rated brews behind a and b (the winner side may flip)', () => {
    const r = [...many(2, 1, 92, 7, { water: 'A' }), ...many(5, 1, 92, 8, { water: 'B' })];
    const [p] = waterTab(r, [bag({ id: 1, name: 'Bag 1' })], { period: P, ratings: 'all' }).pairs;
    expect([p.a, p.b]).toEqual(['B', 'A']); // B wins, so it is side a
    expect([p.bags[0].na, p.bags[0].nb]).toEqual([5, 2]);
  });
  it('pairs: A is the side that won more bags; ties counted; a 3-recipe bag joins 3 pairs; most bags first', () => {
    const ids = [1, 2, 3, 4];
    const r = [
      ...many(2, 1, 92, 7, { water: 'A' }), ...many(2, 1, 92, 8, { water: 'B' }), ...many(2, 1, 92, 6, { water: 'C' }),
      ...many(2, 2, 92, 7, { water: 'A' }), ...many(2, 2, 92, 7.5, { water: 'B' }),
      ...many(2, 3, 92, 7, { water: 'A' }), ...many(2, 3, 92, 7, { water: 'B' }),
      ...many(2, 4, 92, 8, { water: 'A' }), ...many(2, 4, 92, 7.9, { water: 'B' })];
    const p = waterTab(r, ids.map((id) => bag({ id, name: `Bag ${id}` })), { period: P, ratings: 'all' }).pairs;
    expect(p.map((x) => [x.a, x.b, x.won, x.lost, x.tied, x.bags.length])).toEqual([['B', 'A', 2, 1, 1, 4], ['A', 'C', 1, 0, 0, 1], ['B', 'C', 1, 0, 0, 1]]);
    expect(p[0].delta).toBeCloseTo((1 + 0.5 + 0 - 0.1) / 4);
    expect(p[0].bags.map((b) => b.label)).toEqual(['R · Bag 1', 'R · Bag 2', 'R · Bag 4', 'R · Bag 3']); // biggest |gap| first
    expect(p.map((x) => x.slug)).toEqual(['a--b', 'a--c', 'b--c']);
    expect([p[0].bags[0].a, p[0].bags[0].b]).toEqual([expect.closeTo(7.95), expect.closeTo(6.95)]);
  });
  it('pairs need ≥ 2 brews per water on the bag', () => {
    const one = waterTab([...many(1, 1, 92, 8, { water: 'A' }), ...many(2, 1, 92, 7, { water: 'B' }), ...many(2, 1, 92, 6, { water: 'C' })], bags, { period: P, ratings: 'all' }).pairs;
    expect(one.map((x) => [x.a, x.b])).toEqual([['B', 'C']]);
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
    expect(e).toEqual({ recipes: [], map: null, gh: [], byRoast: null, byProcess: null, eras: null, pairs: [] });
  });
});

describe('ranked', () => {
  it('delta rows first, solid before thin, then delta desc; no-delta rows by adjusted desc', () => {
    const s = (label: string, delta: number | null, adjusted: number, solid = true) => ({ label, delta, adjusted, solid }) as unknown as BandStat;
    expect(ranked([s('x', null, 9, false), s('a', 0.1, 1), s('t', 0.9, 1, false), s('b', 0.4, 1), s('y', null, 8, false)]).map((r) => r.label))
      .toEqual(['b', 'a', 't', 'x', 'y']);
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
  it('dripper × roast level', () => expect(g.byRoast!.cols).toEqual(['V60', 'Origami', 'Gabi Master A']));
  it('filters within each dripper: same bag, same dripper; rows = drippers with rated brews on ≥ 2 filters', () => {
    expect(g.matrix).toBeNull(); // every dripper here uses one filter
    const r = [1, 2, 3].flatMap((id) => [
      ...many(10, id, 92, 8, { dripper: 'V60', filter: 'Abaca' }), ...many(10, id, 92, 7, { dripper: 'V60', filter: 'T90' }),
      ...many(10, id, 92, 6, { dripper: 'Origami', filter: 'Abaca' }), ...many(10, id, 92, 6.5, { dripper: 'Origami', filter: 'T90' }),
      ...many(10, id, 92, 7, { dripper: 'Kalita', filter: 'Wave' }),
      ...many(2, id, 92, 7, { dripper: 'April', filter: id === 1 ? 'Paper' : 'Abaca' })]); // two filters, never on one bag
    const m = gearTab(r, { period: P, ratings: 'all' }).matrix!;
    expect(m.rows).toEqual(['V60', 'Origami']); // April's two filters never meet on a bag: an all-blank row, dropped
    expect(m.cols).toEqual(['Abaca', 'T90']);
    expect(m.cells.slice(0, 2).map((row) => row.slice(0, 2).map((c) => c!.delta))).toEqual([[0.5, -0.5], [-0.25, 0.25]].map((row) => row.map((x) => expect.closeTo(x))));
    expect(m.cells[0][0]).toMatchObject({ solid: true, brews: 30, bags: 3 });
  });
  it('eras: each month\'s shares sum to 100', () => {
    const months = ['2026-07-10', '2026-08-10', '2026-09-10'];
    const r = months.flatMap((localDate) => ['X', 'Y', 'Z'].flatMap((dripper) => many(7, 1, 92, 8, { dripper, localDate })));
    const e = gearTab(r, { period: { start: null, end: '2026-09-30' }, ratings: 'all' }).eras!;
    expect(e.lines.map((l) => l.label)).toEqual(['X', 'Y', 'Z']);
    for (let i = 0; i < 3; i++) expect(e.lines.reduce((s, l) => s + l.values[i]!, 0)).toBe(100);
    expect(e.lines.map((l) => l.values[0])).toEqual([34, 33, 33]);
  });
  it('eras: "Other" lists what it holds each month, biggest share first', () => {
    const months = ['2026-07-10', '2026-08-10', '2026-09-10'];
    const r = months.flatMap((localDate) => [['A', 40], ['B', 40], ['C', 40], ['D', 40], ['E', 20], ['F', 5]].flatMap(([dripper, n]) =>
      many(n as number, 1, 92, 8, { dripper: dripper as string, localDate })));
    const e = gearTab(r, { period: { start: null, end: '2026-09-30' }, ratings: 'all' }).eras!;
    expect(e.lines.map((l) => l.label)).toEqual(['A', 'B', 'C', 'D', 'Other']);
    expect(e.other).toEqual(months.map(() => [['E', 11], ['F', 3]]));
    const plain = gearTab(months.flatMap((localDate) => ['X', 'Y'].flatMap((dripper) => many(10, 1, 92, 8, { dripper, localDate }))), { period: { start: null, end: '2026-09-30' }, ratings: 'all' }).eras!;
    expect(plain.other).toEqual([[], [], []]); // nothing folded
  });
  it('no filters at all: no matrix', () => {
    const r = [1, 2, 3].flatMap((id) => [...many(4, id, 92, 8, { dripper: 'V60' }), ...many(4, id, 92, 7, { dripper: 'Origami' })]);
    expect(gearTab(r, { period: P, ratings: 'all' }).matrix).toBeNull();
  });
});

describe('sample rule in the lab', () => {
  it('a band is small under 3 bags or 10 paired brews, solid stays the 3/30 strength bar', () => {
    const rows = [1, 2, 3].flatMap((id) => [...many(2, id, 92, 8.4), ...many(2, id, 88, 8)]);
    const st = pairedDeltas(rows, temp);
    expect(st.map((s) => s.sample)).toEqual([{ bags: 3, brews: 6, small: true }, { bags: 3, brews: 6, small: true }]);
    const more = [1, 2, 3].flatMap((id) => [...many(4, id, 92, 8.4), ...many(4, id, 88, 8)]);
    expect(pairedDeltas(more, temp).map((s) => [s.sample.small, s.solid])).toEqual([[false, false], [false, false]]);
  });
  it('a no-match band reports its plain counts', () => {
    const st = pairedDeltas([...many(3, 1, 92, 8), ...many(3, 2, 88, 8)], temp);
    expect(st.every((s) => s.delta === null && s.sample.brews === 3 && s.sample.bags === 1)).toBe(true);
  });
  it('cells carry a sample; empty stats are no data', () => {
    expect(cellOf({ delta: 0.2, solid: false, brews: 12, bags: 3 }).sample.small).toBe(false);
    expect(cellOf({ delta: 0.2, solid: false, brews: 9, bags: 3 }).sample.small).toBe(true);
    expect(emptyStat({ label: 'x', order: 0 }).sample).toEqual({ bags: 0, brews: 0, small: false });
  });
});

describe('topBags like line', () => {
  it('names the like group and the gap', () => {
    const rows = [[1, 9], [2, 8], [3, 8], [4, 7]].flatMap(([id, r]) => Array.from({ length: 4 }, () => brew({ coffeeId: id, rating: r, roastLevel: 'Light' })));
    const bags = [1, 2, 3, 4].map((id) => bag({ id, slug: `s${id}`, name: `Bag ${id}` }));
    const l = sweetSpotsTab(rows, bags, { period: P, ratings: 'all', grinder: null, filters: {}, all: rows }).topBags[0].like!;
    expect(l.label).toBe('Washed Light coffees');
    expect(l.gap).toBeCloseTo(4 / 3);
  });
});
