import { describe, it, expect } from 'vitest';
import { GENERATORS, type GenCtx } from './insightGenerators';
import type { BagFact, BrewFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, ...o
});
const ctx = (brews: BrewFact[], bags: BagFact[] = [], o: Partial<GenCtx> = {}): GenCtx => ({
  brews, bags, prevBrews: null, ratings: 'all', today: '2026-10-11', householdSize: 2, onHandG: 0,
  period: { from: '2026-09-01', to: '2026-09-30' }, dataStart: '2026-01-01', ...o
});
const all = (c: GenCtx) => GENERATORS.flatMap((g) => [g(c)].flat().filter((f) => f !== null));
const gen = (key: string, brews: BrewFact[], bags: BagFact[] = [], o: Partial<GenCtx> = {}) =>
  all(ctx(brews, bags, o)).find((f) => f!.key === key) ?? null;
const finite = (v: unknown) => !/NaN|Infinity|undefined/.test(JSON.stringify(v));

// One bag's rated brews, 10 minutes apart on `date`, brewIndex 1.. in order.
let nextId = 1;
const seq = (coffeeId: number, ratings: number[], date = '2026-07-01', o: Partial<BrewFact> | ((i: number) => Partial<BrewFact>) = {}): BrewFact[] =>
  ratings.map((rating, i) => brew({
    id: nextId++, coffeeId, rating, brewIndex: i + 1, localDate: date,
    localTime: `${date}T${String(9 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`,
    ...(typeof o === 'function' ? o(i) : o)
  }));
const bags = (n: number, o: (i: number) => Partial<BagFact> = () => ({})) =>
  Array.from({ length: n }, (_, i) => bag({ id: i + 1, name: `Bag ${i + 1}`, ...o(i) }));

describe('dial-in curve', () => {
  const brews = Array.from({ length: 30 }, (_, i) => seq(i + 1, [6, 7, 7.5, 8, 8, 8])).flat();
  it('brew #1 below later brews', () => {
    const f = gen('dialinCurve', brews)!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'pattern', strength: 'solid', headline: 'Your first brew of a bag is your worst', sample: '30 bags' });
    expect(f.series).toHaveLength(6);
    expect(f.series![0].value).toBeCloseTo(6 - 44.5 / 6, 10); // demeaned: -1.4167
    expect(f.z).toBeLessThan(-2);
  });
  it('story variant: raw means and share of bags', () => {
    const f = gen('dialinStory', brews)!;
    expect(f.kind).toBe('story');
    expect(f.body).toBe("Brew #1 averages 6.00; by brew #6 you're at 8.00. The first brew was the worst in 100% of 30 bags.");
  });
  it('under 30 first brews is hidden, not a finding', () =>
    expect(gen('dialinCurve', Array.from({ length: 12 }, (_, i) => seq(i + 1, [6, 7, 7.5, 8, 8, 8])).flat())).toBeNull());
  it('null under MIN_BAGS', () => expect(gen('dialinCurve', seq(1, [6, 8, 8]))).toBeNull());
  it('null when every rating is equal (SD 0)', () => expect(gen('dialinCurve', Array.from({ length: 30 }, (_, i) => seq(i + 1, [8, 8, 8, 8])).flat())).toBeNull());
  it('first brew best -> the other headline', () => {
    const f = gen('dialinCurve', Array.from({ length: 30 }, (_, i) => seq(i + 1, [9, 8, 7.5, 8, 7.5, 8])).flat())!;
    expect(f.headline).toBe('You nail a bag from the first brew');
  });
});

describe('dial-in speed', () => {
  const b = [...seq(1, [5, 6, 7, 8, 8, 8]), ...seq(2, [8, 8, 8, 8, 8]), ...seq(3, [6, 8, 8, 8, 8])];
  it('slowest and fastest bag by brews to settle', () => {
    const f = gen('dialinSpeed', b, bags(3))!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'versus', z: null, strength: null, headline: 'Dial-in takes 1 to 4 brews' });
    expect(f.sides).toEqual([{ label: 'Slowest: R Bag 1', value: '4 brews' }, { label: 'Fastest: R Bag 2', value: '1 brew' }]);
  });
  it('skips bags that began before the period (brewIndex > 1)', () => {
    const late = seq(4, [9, 9, 9, 9, 9], '2026-07-01', (i) => ({ brewIndex: i + 4 }));
    const f = gen('dialinSpeed', [...b, ...late], bags(4))!;
    expect(f.sides![1].label).toBe('Fastest: R Bag 2'); // Bag 4 would have won with 1 brew
    expect(f.sample).toBe('3 bags');
    expect(gen('dialinSpeed', [...b.slice(0, 11), ...late], bags(4))).toBeNull();
  });
  it('null below MIN_BAGS bags with 5+ rated brews', () => expect(gen('dialinSpeed', b.slice(0, 11), bags(3))).toBeNull());
});

describe('second cup', () => {
  // 40 bag-days, second brew +0.2 or +0.4 (mean +0.3)
  const pair = (i: number) => seq(1, [7, 7 + (i % 2 ? 0.2 : 0.4)], `2026-07-${String(i + 1).padStart(2, '0')}`);
  const mk = (n: number) => Array.from({ length: n }, (_, i) => pair(i)).flat();
  it('solid on 40 pairs', () => {
    const f = gen('secondCup', mk(28).concat(Array.from({ length: 12 }, (_, i) => pair(i).map((x) => ({ ...x, localDate: `2026-08-${String(i + 1).padStart(2, '0')}` }))).flat()))!;
    expect(f).toMatchObject({ theme: 'dialin', strength: 'solid', value: '+0.30', headline: 'Your second cup is better', sample: '40 pairs' });
  });
  it('null on 5 pairs', () => expect(gen('secondCup', mk(5))).toBeNull());
});

describe('remembered fondly', () => {
  const mk = (n: number) => {
    const bs = bags(n, (i) => ({ bagRating: 8 + (i % 2 ? 0.3 : 0.5) }));
    return { bs, brews: bs.flatMap((x) => seq(x.id, [7, 8, 9])) };
  };
  it('30 bags rated 0.4 above their brew mean', () => {
    const { bs, brews } = mk(30);
    expect(gen('fondMemory', brews, bs)).toMatchObject({ theme: 'taste', strength: 'solid', value: '+0.40', sample: '30 bags' });
  });
  it('null under 30 bags', () => { const { bs, brews } = mk(10); expect(gen('fondMemory', brews, bs)).toBeNull(); });
});

describe('repeat buys', () => {
  // 5 coffees bought twice: second bag mean higher by 0.5..1.5
  const bs = Array.from({ length: 10 }, (_, i) => bag({ id: i + 1, name: `Cof ${i >> 1}`, roaster: 'Same', purchaseDate: `2026-0${1 + (i & 1)}-01` }));
  const brews = bs.flatMap((x, i) => seq(x.id, [i & 1 ? 8 + (i >> 1) * 0.25 + 0.5 : 7, 7, 7]));
  it('carries the caveat', () => {
    const f = gen('repeatBuys', brews, bs)!;
    expect(f).toMatchObject({ theme: 'taste', caveat: 'Ratings settled over time and you re-buy winners.', sample: '5 repeat pairs' });
    expect(f.body).toBe('5 of 5 second bags rated higher.');
    expect(f.headline).toBe('Repeat buys rate higher');
    expect(finite(f)).toBe(true);
  });
  it('null when every pair differs by the same amount (z not finite)', () => {
    const b2 = bs.map((x) => bag({ ...x }));
    const br = b2.flatMap((x, i) => seq(x.id, i & 1 ? [8, 8, 8] : [7, 7, 7]));
    expect(gen('repeatBuys', br, b2)).toBeNull();
  });
  it('bags with under 3 rated brews are ignored', () => expect(gen('repeatBuys', bs.flatMap((x, i) => seq(x.id, i & 1 ? [9, 9] : [7, 7])), bs)).toBeNull());
  it('null under 3 pairs', () => expect(gen('repeatBuys', brews.slice(0, 12), bs.slice(0, 4))).toBeNull());
});

describe('group effects', () => {
  const bs = bags(12, (i) => ({ roastLevel: i < 4 ? 'Light' : 'Medium', roaster: `Rst ${i % 4}`, origin: 'Kenya', processGroup: 'Washed' }));
  const rate = (i: number) => (i < 4 ? 6 : 8 + (i % 2 ? 0.2 : -0.2));
  const brews = bs.flatMap((x, i) => seq(x.id, [rate(i), rate(i), rate(i)]));
  it('Light roasts rate lower (delta vs all bag means)', () => {
    const f = gen('groupDelta:roastLevel:Light', brews, bs)!;
    const allMean = (4 * 6 + 8 * 8) / 12;
    expect(f).toMatchObject({ theme: 'taste', kind: 'number', strength: 'solid', value: `-${(allMean - 6).toFixed(2)}`, headline: 'Light roasts rate 1.33 lower', sample: '4 bags' });
    expect(f.href).toBe('/insights?tab=leaderboards&open=roast');
  });
  it('a group under 3 bags is skipped', () => expect(gen('groupDelta:roastLevel:Light', brews.slice(0, 18), bs.slice(0, 6).map((x, i) => ({ ...x, roastLevel: i < 2 ? 'Light' : 'Medium' })))).toBeNull());
  it('a weak effect is too early and carries the multiple-comparisons caveat', () => {
    const b2 = bags(12, (i) => ({ roaster: `Rst ${i % 3}` }));
    const br = b2.flatMap((x, i) => seq(x.id, [7 + ((i * 7) % 5) * 0.4, 7, 7]));
    const fs = all(ctx(br, b2)).filter((f) => f!.key.startsWith('groupDelta:roaster'));
    for (const f of fs) if (f!.strength === 'early') expect(f!.caveat).toContain('groups compared');
    expect(finite(fs)).toBe(true);
  });
  it('bags with under 3 rated brews are ignored', () =>
    expect(gen('groupDelta:roastLevel:Light', bs.flatMap((x, i) => seq(x.id, [rate(i), rate(i)])), bs)).toBeNull());
  it('null with too few bags', () => expect(all(ctx(brews.slice(0, 6), bs.slice(0, 2))).filter((f) => f!.key.startsWith('groupDelta'))).toEqual([]));
});

describe('co-ferments', () => {
  const mk = (origins: string[]) => origins.map((origin, i) => bag({ id: i + 1, processGroup: 'Co-ferment / Infused', origin }));
  it('all from one origin', () =>
    expect(gen('coFerments', [], mk(Array(5).fill('Colombia')))).toMatchObject({ headline: 'All 5 of your co-ferments are Colombia', z: null, strength: null }));
  it('a co-ferment with no origin breaks "all one origin"', () =>
    expect(gen('coFerments', [], [...mk(Array(5).fill('Colombia')), bag({ id: 9, processGroup: 'Co-ferment / Infused', origin: null })])).toBeNull());
  it('null when mixed or under 5', () => {
    expect(gen('coFerments', [], mk(['Colombia', 'Colombia', 'Colombia', 'Colombia', 'Kenya']))).toBeNull();
    expect(gen('coFerments', [], mk(Array(4).fill('Colombia')))).toBeNull();
  });
});

describe('notes mean trouble', () => {
  const mk = (bagsN: number) => Array.from({ length: bagsN }, (_, i) => seq(i + 1, [7.5, 7.9, 7.7, 7.5, 7.9, 8.1, 8.5, 8.3, 8.1, 8.5], '2026-07-01', (j) => ({ hasNote: j < 5 }))).flat();
  it('60 noted at -0.3 vs 60 plain at +0.3', () =>
    expect(gen('notesTrouble', mk(12))).toMatchObject({ theme: 'taste', strength: 'solid', value: '-0.60', headline: 'Brews you write notes on rate lower' }));
  it('null under 30 per side', () => expect(gen('notesTrouble', mk(5))).toBeNull());
});

describe('backlog runway', () => {
  const brews = Array.from({ length: 30 }, (_, i) => brew({ id: i + 1, coffeeId: 1, dose: 100, localDate: `2026-09-${String(i + 1).padStart(2, '0')}` }));
  const bs = [bag({ id: 1, purchaseDate: '2026-09-05', amountG: 3800 }), bag({ id: 2, purchaseDate: '2026-06-01', amountG: 9999 })];
  // Period runs past today (Oct 11) and starts at dataStart: 41 tracked days, 3000 g -> 73 g/day.
  const o = { onHandG: 10400, dataStart: '2026-09-01', period: { from: '2026-09-01', to: '2026-10-31' } };
  it('days of cover over tracked days, bought vs brewed', () =>
    expect(gen('backlogRunway', brews, bs, o)).toMatchObject({
      theme: 'money', z: null, strength: null, headline: '10.4kg on hand, about 143 days', sample: '41 days',
      body: 'At 73 g/day. Bought 3.8kg vs brewed 3kg in this period.'
    }));
  it('a period starting before dataStart counts only tracked days', () =>
    expect(gen('backlogRunway', brews, bs, { ...o, period: { from: '2026-01-01', to: '2026-09-30' } })!.sample).toBe('30 days'));
  it('null with nothing on hand, no brews or a tiny period', () => {
    expect(gen('backlogRunway', brews, bs, { ...o, onHandG: 0 })).toBeNull();
    expect(gen('backlogRunway', [], bs, o)).toBeNull();
    expect(gen('backlogRunway', brews, bs, { ...o, period: { from: '2026-09-01', to: '2026-09-05' } })).toBeNull();
  });
});

describe('registry', () => {
  it('empty: no findings', () => expect(all(ctx([]))).toEqual([]));
  it('no NaN / Infinity / undefined text from degenerate data', () => {
    const flat = bags(12).flatMap((x) => seq(x.id, [8, 8, 8, 8, 8, 8]));
    expect(finite(all(ctx(flat, bags(12))))).toBe(true);
  });
});
