import { signed } from '$lib/components/deltaColor';
import { describe, it, expect } from 'vitest';
import { leaderboard } from './leaderboards';
import { GENERATORS, insightsTab, type Finding, type GenCtx, type Generator } from './insightGenerators';
import { MIXED_FILTER, type BagFact, type BrewFact } from './facts';
import { addDays } from './time';
import { loggedGrams } from './overview';
import { formatGrams } from '$lib/grams';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'R', name: 'C', slug: null, processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, ...o
});
const ctx = (brews: BrewFact[], bags: BagFact[] = [], o: Partial<GenCtx> = {}): GenCtx => ({
  brews, bags, prevBrews: null, ratings: 'all', today: '2026-10-11', householdSize: 2, onHandG: 0, logged: loggedGrams(brews),
  period: { from: '2026-09-01', to: '2026-09-30' }, dataStart: '2026-01-01', allBrews: brews, dialIn: new Set<number>(), ...o
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
    expect(f).toMatchObject({ theme: 'dialin', kind: 'pattern', strength: 'solid', headline: 'Your first brew of a bag rates below the rest', sample: '30 bags' });
    expect(f.series).toHaveLength(6);
    expect(f.series![0].value).toBeCloseTo(6 - 44.5 / 6, 10); // demeaned: -1.4167
    expect(f.z).toBeLessThan(-2);
  });
  it('story variant: raw means and share of bags', () => {
    const f = gen('dialinStory', brews)!;
    expect(f.kind).toBe('story');
    expect(f.body).toBe("Brew #1 averages 6.00; by brew #6 you're at 8.00. The first brew rated below the bag's later brews in 100% of 30 bags.");
  });
  it("story share: first brew below the bag's later brews, not only its single lowest", () => {
    // Brew #2 is each bag's low point, yet brew #1 still rates below the later brews' average.
    const f = gen('dialinStory', Array.from({ length: 30 }, (_, i) => seq(i + 1, [7, 6, 8, 8, 8, 8])).flat())!;
    expect(f.body).toMatch(/rated below the bag's later brews in 100% of 30 bags\.$/);
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
    expect(f).toMatchObject({ theme: 'dialin', kind: 'versus', z: null, strength: null, headline: 'Dial-in takes up to 4 brews' });
    // "Fastest: 1 brew" is no contest: the other side counts the bags right on brew 1.
    expect(f.sides).toEqual([{ label: 'Slowest: R Bag 1', value: '4 brews' }, { label: 'Right on brew 1', value: '1 of 3 bags' }]);
  });
  it('skips bags that began before the period (brewIndex > 1)', () => {
    const late = seq(4, [9, 9, 9, 9, 9], '2026-07-01', (i) => ({ brewIndex: i + 4 }));
    const f = gen('dialinSpeed', [...b, ...late], bags(4))!;
    expect(f.sides![1]).toEqual({ label: 'Right on brew 1', value: '1 of 3 bags' }); // Bag 4 would make it 2
    expect(f.sample).toBe('3 bags');
    expect(gen('dialinSpeed', [...b.slice(0, 11), ...late], bags(4))).toBeNull();
  });
  it('a fastest bag past brew 1 keeps the fastest side', () => {
    const f = gen('dialinSpeed', [...seq(1, [5, 6, 7, 8, 8, 8]), ...seq(2, [6, 8, 8, 8, 8]), ...seq(3, [6, 7, 8, 8, 8])], bags(3))!;
    expect(f.headline).toBe('Dial-in takes 2 to 4 brews');
    expect(f.sides![1]).toEqual({ label: 'Fastest: R Bag 2', value: '2 brews' });
  });
  it('details: the next slowest bags and the most common brews-to-settle', () => {
    const more = [...b, ...seq(4, [6, 7, 8, 8, 8]), ...seq(5, [8, 8, 8, 8, 8])];
    expect(gen('dialinSpeed', more, bags(5, (i) => ({ slug: `b${i + 1}` })))!.details).toEqual([
      { label: 'Next slowest', items: [{ name: 'R Bag 4', value: '3 brews', href: '/coffees/b4' }, { name: 'R Bag 3', value: '2 brews', href: '/coffees/b3' }] },
      { label: 'Most bags settle by', items: [{ name: 'brew 1', value: '2 bags' }, { name: 'brew 2', value: '1 bag' }] }
    ]);
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
  it('skips a day with a backfilled brew (its time is a guess)', () => {
    const f = gen('secondCup', mk(40).map((b) => (b.localDate < '2026-07-11' ? { ...b, backfilled: true } : b)))!;
    expect(f.sample).toBe('30 pairs');
  });
  // 30 pairs with second-cup deltas ±1 around `m` (sample SD √(30/29)): weak effects land in Too early.
  const around = (m: number) => Array.from({ length: 30 }, (_, i) => seq(1, [7, 7 + m + (i % 2 ? 1 : -1)], addDays('2026-07-01', i))).flat();
  it('a delta that rounds to 0.00 is no finding', () => expect(gen('secondCup', around(0.002))).toBeNull());
  it('too early: how many more would settle it', () =>
    expect(gen('secondCup', around(0.2))).toMatchObject({ strength: 'early', settle: expect.stringMatching(/^About 74 more pairs would settle it\.$/) }));
  it('too early carries progress = n / (n + more)', () => {
    const f = gen('secondCup', around(0.2))!;
    const more = +f.settle!.match(/\d+/)![0];
    expect(f.progress).toBeCloseTo(30 / (30 + more), 10);
    expect(gen('secondCup', around(0.04))!.progress).toBeLessThan(0.1);
    expect(gen('secondCup', mk(28).concat(Array.from({ length: 12 }, (_, i) => pair(i).map((x) => ({ ...x, localDate: `2026-08-${String(i + 1).padStart(2, '0')}` }))).flat()))!.progress).toBeUndefined();
  });
  it('too early and far off: no giant number', () =>
    expect(gen('secondCup', around(0.04))).toMatchObject({ strength: 'early', settle: 'Too small a difference to settle with your data.' }));
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
  it('paired z uses the sample SD (n − 1)', () => {
    // Differences 0.5, 1, 1.5: mean 1, sample SD 0.5 -> z = 1 / (0.5 / √3) = 2√3 (population SD would give 3√2).
    const b3 = bs.slice(0, 6);
    const f = gen('repeatBuys', b3.flatMap((x, i) => seq(x.id, Array(3).fill(i & 1 ? 7 + 0.5 * ((i >> 1) + 1) : 7))), b3)!;
    expect(f.z).toBeCloseTo(2 * Math.sqrt(3), 6);
    // 3 pairs: a t test on 2 df (one-sided p .037), so Possible, not the normal curve's Likely (p .0003).
    expect(f.strength).toBe('hint');
  });
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
    expect(fs.some((f) => f!.strength === 'early')).toBe(true);
    for (const f of fs) if (f!.strength === 'early') expect(f!.caveat).toContain('groups compared');
    expect(finite(fs)).toBe(true);
  });
  it('a group standing out among many is held to a Bonferroni bar', () => {
    // 8 roasters × 3 bags; Rst 0 sits about 2.05 SE above: solid alone, not with 8 groups compared.
    const b8 = bags(24, (i) => ({ roaster: `Rst ${i % 8}` }));
    const mean8 = (i: number) => (i % 8 === 0 ? 8.2 : 7.5 + ((i * 5) % 7) * 0.12);
    const f = gen('groupDelta:roaster:Rst 0', b8.flatMap((x, i) => seq(x.id, [mean8(i), mean8(i), mean8(i)])), b8)!;
    expect(f.z).toBeGreaterThan(2);
    expect(f.strength).toBe('early');
    expect(f.caveat).toBe('With 8 roaster groups compared, one usually stands out by chance.');
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

describe('details (supporting lists)', () => {
  it('co-ferments: what was added (from the process text) and the most brewed coffees', () => {
    const proc = ['Red fruits co-ferment', 'Red Fruits Co-Ferment Decaf', 'Thermal Shock Washed', 'Pink Champagne Natural', 'Double Anaerobic Thermal Shock Washed'];
    const names = ['Red Fruits', 'Red Fruits', 'Shock', 'Pink', 'Shock 2'];
    const bs = proc.map((processing, i) => bag({ id: i + 1, name: names[i], slug: `s${i + 1}`, processing, processGroup: 'Co-ferment / Infused', origin: 'Colombia' }));
    const brews = [...seq(1, [7, 7]), ...seq(2, [7, 7]), ...seq(3, [8, 8, 8]), ...seq(4, [6])];
    expect(gen('coFerments', brews, bs)!.details).toEqual([
      { label: 'Process', items: [{ name: 'Red fruits', value: '2 bags' }, { name: 'Thermal shock', value: '2 bags' }] },
      { label: 'Most brewed', items: [{ name: 'Red Fruits', value: '4 brews', href: '/coffees/s1' }, { name: 'Shock', value: '3 brews', href: '/coffees/s3' }] }
    ]);
  });
  it('no real data: no details', () =>
    expect(gen('coFerments', [], Array.from({ length: 5 }, (_, i) => bag({ id: i + 1, processGroup: 'Co-ferment / Infused', origin: 'Colombia' })))!.details).toBeUndefined());
  it('remembered fondly: the biggest gaps', () => {
    const bs = bags(30, (i) => ({ bagRating: 8 + (i % 2 ? 0.3 : 0.5) }));
    expect(gen('fondMemory', bs.flatMap((x) => seq(x.id, [7, 8, 9])), bs)!.details).toEqual([{ label: 'Remembered most fondly', items: [
      { name: 'Bag 1', value: '+0.50' }, { name: 'Bag 11', value: '+0.50' }] }]);
  });
  it('repeat buys: the biggest second-bag gains', () => {
    const bs = Array.from({ length: 10 }, (_, i) => bag({ id: i + 1, name: `Cof ${i >> 1}`, roaster: 'Same', purchaseDate: `2026-0${1 + (i & 1)}-01` }));
    const f = gen('repeatBuys', bs.flatMap((x, i) => seq(x.id, [i & 1 ? 8 + (i >> 1) * 0.25 + 0.5 : 7, 7, 7])), bs)!;
    expect(f.details).toEqual([{ label: 'Biggest second-bag gains', items: [{ name: 'Cof 4', value: '+0.83' }, { name: 'Cof 3', value: '+0.75' }] }]);
  });
  it('group effects: the group\'s lowest-rated bags when it rates lower', () => {
    const bs = bags(12, (i) => ({ roastLevel: i < 4 ? 'Light' : 'Medium', slug: `b${i + 1}` }));
    const rate = (i: number) => (i < 4 ? 6 + i * 0.1 : 8 + (i % 2 ? 0.2 : -0.2));
    expect(gen('groupDelta:roastLevel:Light', bs.flatMap((x, i) => seq(x.id, [rate(i), rate(i), rate(i)])), bs)!.details).toEqual([{ label: 'Lowest rated', items: [
      { name: 'Bag 1', value: '6.00', href: '/coffees/b1' }, { name: 'Bag 2', value: '6.10', href: '/coffees/b2' }] }]);
  });
  it('runway: most on hand among open and backlog bags', () => {
    const bs = [bag({ id: 1, name: 'Big', amountG: 1000, purchaseDate: '2026-09-01' }), bag({ id: 2, name: 'Half', amountG: 1000, purchaseDate: '2026-08-01', frozenStart: '2026-08-02', frozenEnd: '2026-08-31' }),
      bag({ id: 3, name: 'Gone', amountG: 1000, status: 'archive', purchaseDate: '2026-01-01' }), bag({ id: 4, name: 'Undated', amountG: 100 })];
    const brews = Array.from({ length: 20 }, (_, i) => brew({ id: nextId++, coffeeId: 2, dose: 25, localDate: addDays('2026-09-01', i) }));
    expect(gen('backlogRunway', brews, bs, { onHandG: 1500, dataStart: '2026-09-01', period: { from: '2026-09-01', to: '2026-09-30' } })!.details)
      .toEqual([{ label: 'Most on hand', items: [{ name: 'Big', value: formatGrams(1000) }, { name: 'Half', value: formatGrams(500) }] },
        // today 2026-10-11: Big 40 days; Half 71 days minus 29 frozen = 42; archived and undated bags left out
        { label: 'Oldest on hand', items: [{ name: 'Half', value: '42 days off roast' }, { name: 'Big', value: '40 days off roast' }] }]);
  });
  it('runway: on-hand amounts net of all-history brews, not just the period (short range)', () => {
    const bs = [bag({ id: 1, name: 'Drunk before', amountG: 250, purchaseDate: '2026-08-01' }), bag({ id: 2, name: 'Fresh', amountG: 200, purchaseDate: '2026-09-25' })];
    const before = Array.from({ length: 10 }, (_, i) => brew({ id: nextId++, coffeeId: 1, dose: 20, localDate: addDays('2026-08-02', i) }));
    const inside = Array.from({ length: 20 }, (_, i) => brew({ id: nextId++, coffeeId: 2, dose: 5, localDate: addDays('2026-09-20', i) }));
    const f = gen('backlogRunway', inside, bs, { logged: loggedGrams([...before, ...inside]), onHandG: 150, dataStart: '2026-08-01', period: { from: '2026-09-20', to: '2026-10-11' } })!;
    // Bag 1: 250 g - 200 g brewed in August = 50 g, not its full 250 g.
    expect(f.details![0]).toEqual({ label: 'Most on hand', items: [{ name: 'Fresh', value: formatGrams(100) }, { name: 'Drunk before', value: formatGrams(50) }] });
  });
  it('cost per cup: priciest and cheapest coffees (6+ costed bags)', () => {
    const bs = bags(6);
    const brews = bs.flatMap((b) => Array.from({ length: 6 }, () => brew({ id: nextId++, coffeeId: b.id, costPerBrew: b.id })));
    expect(gen('costPerCup', brews, bs)!.details).toEqual([
      { label: 'Priciest cups', items: [{ name: 'Bag 6', value: '$6.00' }, { name: 'Bag 5', value: '$5.00' }] },
      { label: 'Cheapest cups', items: [{ name: 'Bag 1', value: '$1.00' }, { name: 'Bag 2', value: '$2.00' }] }
    ]);
    expect(gen('costPerCup', brews.slice(0, 30), bs)!.details).toBeUndefined(); // 5 costed bags
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

// A brew on `date` at `hh:mm`.
const at = (date: string, time: string, o: Partial<BrewFact> = {}) => brew({ id: nextId++, localDate: date, localTime: `${date}T${time}`, ...o });
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
const alt = (a: number, b: number) => (i: number) => (i % 2 ? b : a);

describe('morning drift', () => {
  const month = (m: string, time: string) => days(`2026-${m}-01`, 10).flatMap((d) => [at(d, time), at(d, '15:00')]);
  const brews = [...month('04', '11:42'), ...month('05', '10:00'), ...month('06', '08:52')];
  it('median first brew per month moves earlier', () => {
    const f = gen('morningDrift', brews)!;
    expect(f).toMatchObject({ theme: 'habits', kind: 'pattern', z: null, strength: null, headline: 'Your first brew moved earlier', value: '11:42 → 8:52', sample: '3 months' });
    expect(f.series).toEqual([{ label: 'Apr 26', value: 702 }, { label: 'May 26', value: 600 }, { label: 'Jun 26', value: 532 }]);
  });
  it('a day with a back-filled brew is skipped (June drops under 10 days)', () =>
    expect(gen('morningDrift', brews.map((b) => (b.localDate === '2026-06-03' && b.localTime.endsWith('15:00') ? { ...b, backfilled: true } : b)))).toBeNull());
  it('null with 2 months', () => expect(gen('morningDrift', brews.filter((b) => !b.localDate.startsWith('2026-06')))).toBeNull());
});

describe('weekends vs weekdays', () => {
  const mk = (n: number, weekend: number) => days('2026-09-07', n).flatMap((d, i) => Array.from({ length: i % 7 >= 5 ? weekend : 6 }, () => at(d, '09:15')));
  const sep = { period: { from: '2026-09-07', to: '2026-10-04' } };
  it('brews per day, versus', () => {
    const f = gen('weekendVsWeekday', mk(28, 5), [], sep)!;
    expect(f).toMatchObject({ theme: 'habits', kind: 'versus', headline: "Weekends aren't binges", sample: '28 days', z: null });
    expect(f.sides).toEqual([{ label: 'Weekdays', value: '6.00' }, { label: 'Weekends', value: '5.00' }]); // weekends right, over Sat/Sun
    expect(gen('weekendVsWeekday', mk(28, 8), [], sep)!.headline).toBe('You brew more on weekends');
  });
  it('a Mon..Sun bar series of brews per day', () => {
    const f = gen('weekendVsWeekday', mk(28, 5).filter((b) => b.localDate !== '2026-09-08'), [], sep)!; // one Tuesday off
    expect(f.chart).toBe('bars');
    expect(f.series).toEqual([['Mon', 6], ['Tue', 4.5], ['Wed', 6], ['Thu', 6], ['Fri', 6], ['Sat', 5], ['Sun', 5]].map(([label, value]) => ({ label, value })));
  });
  it('a tracked day without brews counts as 0, not skipped', () => {
    // Every other Saturday and Sunday off: weekends average 4 a day, not 8.
    const off = new Set(['2026-09-12', '2026-09-13', '2026-09-26', '2026-09-27']);
    const f = gen('weekendVsWeekday', mk(28, 8).filter((b) => !off.has(b.localDate)), [], sep)!;
    expect(f.sides).toEqual([{ label: 'Weekdays', value: '6.00' }, { label: 'Weekends', value: '4.00' }]);
  });
  it('null under 30 weekend brews', () => expect(gen('weekendVsWeekday', mk(7, 5), [], sep)).toBeNull());
});

describe('before 9 am', () => {
  const r = [7.5, 7.9, 7.7, 7.5, 7.9, 8.1, 8.5, 8.3, 8.1, 8.5];
  const mk = (n: number, o: (j: number) => Partial<BrewFact> = () => ({})) => Array.from({ length: n }, (_, i) =>
    seq(i + 1, r, `2026-07-${String(i + 1).padStart(2, '0')}`, (j) => ({ localTime: `2026-07-${String(i + 1).padStart(2, '0')}T${j < 5 ? '08' : '10'}:1${j}`, ...o(j) }))).flat();
  it('early brews rate lower (demeaned)', () =>
    expect(gen('earlyBrews', mk(12))).toMatchObject({ theme: 'habits', strength: 'solid', value: '-0.60', headline: 'Brews before 9 am rate 0.60 lower', sample: '60 early vs 60 later brews' }));
  it('back-filled brews are skipped', () => expect(gen('earlyBrews', mk(12, (j) => ({ backfilled: j < 5 })))).toBeNull());
  it('null under 30 per side', () => expect(gen('earlyBrews', mk(5))).toBeNull());
});

describe('weekday ratings', () => {
  // 2026-09-07 is a Monday; each bag brewed once a day for `weeks` weeks, Mondays 1 point up.
  const mk = (bags: number, monday: number, weeks = 5) => Array.from({ length: bags }, (_, i) =>
    days('2026-09-07', 7 * weeks).map((d, j) => at(d, '09:15', { coffeeId: i + 1, rating: j % 7 === 0 ? 7.5 + monday : 7.5 + alt(-0.2, 0.2)(i + j) }))).flat();
  it('the standout weekday', () => {
    const f = gen('weekday', mk(7, 1))!;
    expect(f).toMatchObject({ theme: 'habits', strength: 'solid', sample: '35 brews on 5 Mondays' });
    expect(f.headline).toMatch(/^Mondays rate 1\.\d\d higher$/);
  });
  it('a weak standout is too early, with the multiple-comparison caveat', () => {
    // ±0.5 week-to-week noise that cancels per weekday over 6 weeks; Mondays only +0.05
    const weak = Array.from({ length: 7 }, (_, i) =>
      days('2026-09-07', 42).map((d, j) => at(d, '09:15', { coffeeId: i + 1, rating: 7.5 + alt(-0.5, 0.5)(Math.floor(j / 7)) + (j % 7 === 0 ? 0.05 : 0) }))).flat();
    expect(gen('weekday', weak)).toMatchObject({ strength: 'early', caveat: 'With 7 weekdays compared, one usually stands out by chance.' });
    expect(gen('weekday', weak)!.headline).toMatch(/^Mondays rate 0\.\d\d higher$/);
  });
  it('null under 30 brews a weekday', () => expect(gen('weekday', mk(5, 1))).toBeNull());
  it('brews of one day move together: the day is the unit, not the brew', () => {
    // 4 weeks × 12 bags a day. Each day shifts every brew alike (±0.4); Mondays +0.3 on average,
    // but over 4 Mondays only. Counted per brew this looked solid (z ≈ 4).
    const shift = (w: number, j: number) => (j === 0 ? [0.7, -0.1, 0.6, 0][w] : alt(0.4, -0.4)(w + j));
    const b = Array.from({ length: 12 }, (_, i) => days('2026-09-07', 28).map((d, k) =>
      at(d, '09:15', { coffeeId: i + 1, rating: 7.5 + shift(Math.floor(k / 7), k % 7) + alt(-0.05, 0.05)(i) }))).flat();
    const f = gen('weekday', b)!;
    expect(f.headline).toBe('Mondays rate 0.30 higher');
    expect(f.strength).toBe('early');
    expect(f.sample).toBe('48 brews on 4 Mondays');
  });
});

describe('this period vs previous', () => {
  const side = (perBag: number, rating: number, origin: string, dripper: string, date: string) =>
    [1, 2, 3, 4].flatMap((id) => Array.from({ length: perBag }, (_, i) => at(date, '09:15', { coffeeId: id, rating: rating + alt(-0.1, 0.1)(i), origin, dripper })));
  const cur = side(16, 8, 'Kenya', 'V60', '2026-09-10'), prev = side(10, 7, 'Ethiopia', 'Origami', '2026-08-10');
  it('brews, bags, top origin, gear share and same-bag rating', () => {
    const f = gen('periodVsPrevious', cur, [], { prevBrews: prev })!;
    expect(f).toMatchObject({ theme: 'habits', kind: 'versus', z: null, headline: '60% more brews than the comparison period', href: '/insights?tab=overview' });
    expect(f.sides).toEqual([{ label: 'This period', value: '64 brews' }, { label: 'Comparison', value: '40 brews' }]);
    expect(f.body).toBe('4 bags brewed vs 4. Top origin Kenya (was Ethiopia). V60 on 100% of brews (was Origami 100%). The same bags rate +1.00 vs then.');
  });
  it('no rating line under 30 rated brews a side', () =>
    expect(gen('periodVsPrevious', cur, [], { prevBrews: prev.slice(0, 20) })!.body).not.toContain('same bags'));
  it('null when the comparison window has no brews (e.g. range=all)', () => {
    expect(gen('periodVsPrevious', cur, [], { prevBrews: null })).toBeNull();
    expect(gen('periodVsPrevious', cur, [], { prevBrews: [] })).toBeNull();
  });
});

describe('gear eras', () => {
  const month = (m: string, a: number, b: number, total = 20) =>
    days(`2026-${m}-01`, total).map((d, i) => at(d, '09:15', { dripper: i < a ? 'Alpha Switch' : i < a + b ? 'CT62' : 'V60' }));
  const brews = [...month('04', 18, 2), ...month('05', 20, 0), ...month('06', 3, 17)];
  it('80%+ months merge into eras', () => {
    const f = gen('gearEras:dripper', brews)!;
    expect(f).toMatchObject({ theme: 'gear', kind: 'pattern', headline: 'Dripper eras: Alpha Switch → CT62', body: 'Alpha Switch 95% of Apr 26–May 26, CT62 85% of Jun 26.', sample: '3 months' });
    expect(f.multi).toEqual({ x: ['Apr 26', 'May 26', 'Jun 26'], unit: '%', lines: [
      { label: 'Alpha Switch', values: [90, 100, 15] }, { label: 'CT62', values: [10, 0, 85] }
    ] });
    expect(gen('gearEras:water', brews)).toBeNull(); // no water logged
  });
  it('items under 20% in every month fold into Other', () => {
    const f = gen('gearEras:dripper', [...month('04', 15, 2), ...month('05', 20, 0), ...month('06', 3, 17)])!;
    expect(f.multi!.lines.map((l) => l.label)).toEqual(['Alpha Switch', 'CT62', 'Other']);
    expect(f.multi!.lines[2].values).toEqual([15, 0, 0]);
  });
  it('no two eras but a moving mix: a share card', () => {
    const f = gen('gearShare:dripper', [...month('04', 15, 5), ...month('05', 12, 8), ...month('06', 8, 12)])!;
    expect(f).toMatchObject({ theme: 'gear', kind: 'pattern', z: null, headline: 'Dripper: Alpha Switch → CT62', body: 'Alpha Switch had 75% of Apr 26; CT62 60% of Jun 26.' });
    expect(f.multi!.lines.map((l) => l.values)).toEqual([[75, 60, 40], [25, 40, 60]]);
    expect(gen('gearEras:dripper', [...month('04', 15, 5), ...month('05', 12, 8), ...month('06', 8, 12)])).toBeNull();
  });
  it('a flat mix is no card', () => expect(gen('gearShare:dripper', [...month('04', 15, 5), ...month('05', 14, 6), ...month('06', 15, 5)])).toBeNull());
  it('one gear only, or months under 20 brews: null', () => {
    expect(gen('gearEras:dripper', [...month('04', 18, 2), ...month('05', 20, 0)])).toBeNull();
    expect(gen('gearEras:dripper', [...month('04', 18, 2), ...month('06', 3, 16, 19)])).toBeNull();
  });
});

describe('same-bag versus', () => {
  const mk = (n: number, a: [number, number], b: [number, number], o: Partial<BrewFact> = {}) => Array.from({ length: n }, (_, i) => [
    ...seq(i + 1, Array.from({ length: 10 }, (_, j) => alt(...a)(j)), '2026-07-01', { dripper: 'V60', ...o }),
    ...seq(i + 1, Array.from({ length: 10 }, (_, j) => alt(...b)(j)), '2026-07-02', { dripper: 'Origami', ...o })
  ]).flat();
  const solo = seq(99, Array(20).fill(9), '2026-07-03', { dripper: 'V60' }); // only V60: left out
  it('top 2 drippers on the bags brewed with both', () => {
    const f = gen('sameBagVersus:dripper', [...mk(6, [8.2, 8.4], [7.6, 7.8]), ...solo, ...seq(98, [8, 8, 8], '2026-07-04', { dripper: 'Kalita' })])!;
    expect(f).toMatchObject({ theme: 'gear', kind: 'versus', strength: 'solid', value: '+0.60', headline: 'V60 beats Origami by 0.60 on the same bags', sample: '6 bags, 120 brews', href: '/insights?tab=leaderboards&open=dripper' });
    expect(f.sides).toEqual([{ label: 'V60', value: '+0.30' }, { label: 'Origami', value: '-0.30' }]);
  });
  it('a confident dead heat is a finding', () =>
    expect(gen('sameBagVersus:dripper', mk(6, [7.9, 8.1], [7.9, 8.1]))).toMatchObject({ headline: 'Origami and V60 tie on the same bags', z: null, strength: null }));
  it('a small gap on noisy data is too early, not a tie', () =>
    expect(gen('sameBagVersus:dripper', mk(6, [7, 9], [7.05, 9.05]))).toMatchObject({ headline: 'Origami and V60 look even on the same bags', strength: 'early' }));
  it('the mixed 155 filter is left out', () =>
    expect(gen('sameBagVersus:filter', mk(6, [8.2, 8.4], [7.6, 7.8]).map((b) => ({ ...b, filter: b.dripper === 'V60' ? 'Abaca' : MIXED_FILTER })))).toBeNull());
  it('null under 30 brews a side', () => expect(gen('sameBagVersus:dripper', mk(2, [8.2, 8.4], [7.6, 7.8]))).toBeNull());
});

describe('wildcard brewer', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => [
    ...seq(i + 1, Array.from({ length: 10 }, (_, j) => alt(7, 9)(j)), '2026-07-01', { dripper: 'Graycano' }),
    ...seq(i + 1, Array.from({ length: 10 }, (_, j) => alt(7.8, 8.2)(j)), '2026-07-02', { dripper: 'Alpha Switch' })
  ]).flat();
  it('widest vs narrowest demeaned spread', () => {
    const f = gen('wildcardBrewer', mk(4))!;
    expect(f).toMatchObject({ theme: 'gear', kind: 'versus', strength: 'solid', headline: 'The Graycano is your wildcard', sample: '80 brews' });
    expect(f.sides).toEqual([{ label: 'Graycano', value: '±1.00' }, { label: 'Alpha Switch', value: '±0.20' }]);
  });
  it('null under 30 brews a dripper', () => expect(gen('wildcardBrewer', mk(2))).toBeNull());
  it('the pick of k drippers is held to a Bonferroni bar over k', () => {
    // SDs 0.3 / 0.25 / 0.2, 30 brews each: z = ln 1.5 / √(2/58) ≈ 2.18, solid alone but a hint over 3 drippers.
    const k3 = Array.from({ length: 3 }, (_, i) => [['Wide', 0.3], ['Mid', 0.25], ['Tight', 0.2]].flatMap(([d, a], j) =>
      seq(i + 1, Array.from({ length: 10 }, (_, m) => 8 + (m % 2 ? +a : -a)), `2026-07-0${j + 1}`, { dripper: d as string }))).flat();
    const f = gen('wildcardBrewer', k3)!;
    expect(f.z).toBeGreaterThan(2);
    expect(f.strength).toBe('hint');
  });
});

describe('price vs rating', () => {
  const mk = (rate: (i: number) => number, n = 30) => {
    const bs = bags(n, (i) => ({ cost: i + 1, amountG: 100 }));
    return { bs, brews: bs.flatMap((b, i) => seq(b.id, [rate(i), rate(i), rate(i)])) };
  };
  it('no link: a myth', () => {
    const { bs, brews } = mk((i) => 7 + Math.abs(i - 14.5) / 10); // V shape: r = 0
    expect(gen('priceVsRating', brews, bs)).toMatchObject({ theme: 'money', kind: 'myth', z: null, headline: "Price doesn't buy rating", value: 'r = 0.00', sample: '30 bags', body: 'Across 30 bags, $/100 g and your bag rating barely move together.' });
  });
  it('a real link says so', () => {
    const { bs, brews } = mk((i) => 7 + i / 20);
    expect(gen('priceVsRating', brews, bs)).toMatchObject({ headline: 'Pricier bags rate higher', value: 'r = 1.00' });
  });
  it('cost 0 is not a price; null under 30 bags', () => {
    const { bs, brews } = mk((i) => 7 + i / 20);
    expect(gen('priceVsRating', brews, bs.map((b, i) => (i ? b : { ...b, cost: 0 })))).toBeNull();
  });
});

describe('cost per cup', () => {
  const brews = [...Array.from({ length: 30 }, () => brew({ id: nextId++, costPerBrew: 2, rating: 7 })), ...Array.from({ length: 10 }, () => brew({ id: nextId++, costPerBrew: 4, rating: 9 }))];
  it('average and 9+ cups', () =>
    expect(gen('costPerCup', brews)).toMatchObject({ theme: 'money', z: null, strength: null, headline: '$2.50 a cup', body: 'A 9+ cup costs $4.00 on average.', sample: '40 brews' }));
  it('no 9+ line under 10 such cups; null under 30 costed brews', () => {
    expect(gen('costPerCup', brews.slice(0, 35))!.body).toBeUndefined();
    expect(gen('costPerCup', brews.slice(0, 29))).toBeNull();
  });
});

describe('$/100 g by quarter', () => {
  const bs = bags(6, (i) => ({ cost: i < 3 ? 10 : 20, amountG: 100, purchaseDate: i < 3 ? '2026-02-01' : '2026-05-01' }));
  const o = { period: { from: '2026-01-01', to: '2026-09-30' } };
  it('per quarter series', () => {
    const f = gen('pricePerMonth', [], bs, o)!;
    expect(f).toMatchObject({ theme: 'money', kind: 'pattern', headline: '$/100 g went from $10.00 to $20.00', sample: '6 bags' });
    expect(f.series).toEqual([{ label: '2026 Q1', value: 10 }, { label: '2026 Q2', value: 20 }]);
  });
  it('null when a quarter has under 3 bags', () => expect(gen('pricePerMonth', [], bs.slice(0, 5), o)).toBeNull());
});

describe('roaster loyalty', () => {
  const rs = ['A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'D', 'E'];
  const bs = rs.map((roaster, i) => bag({ id: i + 1, roaster, purchaseDate: roaster === 'D' ? '2026-09-01' : `2026-0${1 + (i % 5)}-01` }));
  const o = { period: { from: '2026-01-01', to: '2026-10-31' } };
  it('top 3 share and the rising roaster', () =>
    expect(gen('loyalty', [], bs, o)).toMatchObject({
      theme: 'money', headline: 'Top 3 roasters: 75% of bags', value: '75%', sample: '12 bags, 5 roasters',
      body: 'A, B and C. Rising: D, 2 of your last 2 bags (0 of 10 before).',
      details: [{ label: 'Top roasters', items: [
        { name: 'A', value: '4 bags', href: '/coffees?status=all&roaster=A' }, { name: 'B', value: '3 bags', href: '/coffees?status=all&roaster=B' }] }]
    }));
  it('null under 10 bags', () => expect(gen('loyalty', [], bs.slice(0, 9), o)).toBeNull());
});

describe('rest myth', () => {
  // Rating climbs with brew number; rest grows with brew number plus a bag offset.
  const mk = (n: number) => Array.from({ length: n }, (_, i) => seq(i + 1, [6, 7, 7.5, 8, 8, 8], '2026-07-01', (j) => ({ restDays: 10 + 2 * (j + 1) + (i % 2) * 3 }))).flat();
  it('raw r falls once brew number is held fixed', () => {
    const f = gen('restMyth', mk(10))!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'myth', headline: "Longer rest doesn't make a better cup", value: 'r = 0.00' });
    expect(f.body).toMatch(/^Rest days and rating line up at r = 0\.\d\d; with brew number held fixed, r = 0\.00\. Later brews/);
  });
  it('null under 30 brews', () => expect(gen('restMyth', mk(4))).toBeNull());
});

describe('rest window myth', () => {
  const bs = bags(11, (i) => (i < 10 ? { restLow: 7, restHigh: 21 } : {}));
  const mk = (n: number, inside = 0) => bs.slice(0, n).flatMap((b) =>
    [3, 14, 30].flatMap((rest) => seq(b.id, [7.9, 8.1, 8].map((r) => r + (rest === 14 ? inside : 0)), '2026-07-01', { restDays: rest })));
  it('before, inside and after rate the same', () => {
    const f = gen('restWindowMyth', [...mk(10), ...seq(11, [9, 9, 9], '2026-07-01', { restDays: 14 })], bs)!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'myth', value: '0.00 apart', sample: '90 brews' });
    expect(f.series!.map((s) => s.label)).toEqual(['Before', 'Inside', 'After']);
  });
  it('a real window effect is not a myth', () => expect(gen('restWindowMyth', mk(10, 0.5), bs)).toBeNull());
  it('null under 30 brews a side', () => expect(gen('restWindowMyth', mk(5), bs)).toBeNull());
});

describe('origin myth', () => {
  const mk = (rates: number[], origins = ['Kenya', 'Ethiopia', 'Colombia']) => {
    const bs = bags(9, (i) => ({ origin: origins[Math.floor(i / 3)] }));
    return { bs, brews: bs.flatMap((b, i) => seq(b.id, Array(3).fill(rates[Math.floor(i / 3)]))) };
  };
  it('every origin within 0.5: myth', () => {
    const { bs, brews } = mk([8, 8.3, 7.7]);
    expect(gen('originMyth', brews, bs)).toMatchObject({ theme: 'taste', kind: 'myth', headline: 'Origin barely matters', value: '±0.30', sample: '9 bags', body: 'All 3 origins with 3+ bags rate within ±0.30 of your average.' });
  });
  it('a 0.6 gap or under 3 origins: null', () => {
    let m = mk([8, 8.6, 7.4]); expect(gen('originMyth', m.brews, m.bs)).toBeNull();
    m = mk([8, 8.3, 7.7], ['Kenya', 'Kenya', 'Colombia']); expect(gen('originMyth', m.brews, m.bs)).toBeNull();
  });
});

describe('backlog wait myth', () => {
  const mk = (rate: (i: number) => number, n = 30) => {
    const bs = bags(n, (i) => ({ purchaseDate: '2026-06-01', firstBrew: addDays('2026-06-01', i) }));
    return { bs, brews: bs.flatMap((b, i) => seq(b.id, Array(3).fill(rate(i)))) };
  };
  it('no link: a myth', () => {
    const { bs, brews } = mk((i) => 7 + Math.abs(i - 14.5) / 10);
    expect(gen('backlogWaitMyth', brews, bs)).toMatchObject({ kind: 'myth', headline: "Waiting in the backlog doesn't hurt", value: 'r = 0.00', sample: '30 bags' });
  });
  it('a link shows; freezer time is left out of the wait', () => {
    const { bs, brews } = mk((i) => 9 - i / 20);
    expect(gen('backlogWaitMyth', brews, bs)!.headline).toBe('Bags that wait rate lower');
    // every bag first brewed 29 days after roast (no spread: null), but frozen for i of them: net wait 29 - i
    const same = bs.map((b) => ({ ...b, firstBrew: '2026-06-30' }));
    expect(gen('backlogWaitMyth', brews, same)).toBeNull();
    const frozen = same.map((b, i) => ({ ...b, frozenStart: '2026-06-01', frozenEnd: addDays('2026-06-01', i) }));
    expect(gen('backlogWaitMyth', brews, frozen)).toMatchObject({ headline: 'Bags that wait rate higher', value: 'r = 1.00' });
  });
  it('null under 30 bags', () => { const { bs, brews } = mk((i) => 9 - i / 20, 29); expect(gen('backlogWaitMyth', brews, bs)).toBeNull(); });
});

describe('brew variables myth', () => {
  const mk = (n: number, ratio = [15, 15, 17, 17], ratings = [7.9, 8.1, 8.12, 7.9]) => Array.from({ length: n }, (_, i) =>
    seq(i + 1, ratings, '2026-07-01', (j) => ({ ratio: ratio[j], dose: [15, 15, 16, 16][j], grind: ['1.5', '1.5', '1.10', '1.10'][j], grinder: 'ZP6' }))).flat();
  it('all |r| ≤ 0.1: one myth card', () => {
    const f = gen('variablesMyth', mk(10))!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'myth', value: '|r| ≤ 0.05', sample: '40 brews' });
    expect(f.body).toBe('Ratio, dose and ZP6 grind all stay within |r| ≤ 0.05 of your rating, within a bag.');
  });
  it('no card when every |r| rounds to 0.00', () => expect(gen('variablesMyth', mk(10, undefined, [7.9, 8.1, 8.1, 7.9]))).toBeNull());
  it('a variable that matters: no myth', () => expect(gen('variablesMyth', mk(10, [15, 17, 17, 15]))).toBeNull());
  it('null under 30 brews', () => expect(gen('variablesMyth', mk(7))).toBeNull());
});

describe('calibration', () => {
  const jul = seq(1, Array.from({ length: 30 }, (_, i) => alt(6, 10)(i)), '2026-07-01');
  const sep = seq(2, Array.from({ length: 30 }, (_, i) => alt(7.5, 8.5)(i)), '2026-09-01');
  const unrated = brew({ id: nextId++, coffeeId: 2, rating: 0, localDate: '2026-08-15' });
  it('monthly spread first vs last month, brews rated in a row', () =>
    expect(gen('calibration', [...jul, unrated, ...sep])).toMatchObject({
      theme: 'taste', kind: 'myth', headline: 'Your ratings have settled', value: '2.00 → 0.50', sample: '2 months',
      body: 'Monthly rating spread (SD) went from 2.00 in Jul 26 to 0.50 in Sep 26. 30 brews in a row rated.'
    }));
  it('the current (partial) month is left out', () => {
    const oct = seq(3, Array.from({ length: 30 }, (_, i) => alt(2, 10)(i)), '2026-10-05'); // today is 2026-10-11
    expect(gen('calibration', [...jul, ...sep, ...oct])).toMatchObject({ value: '2.00 → 0.50', sample: '2 months' });
  });
  it('ignores the Current/All ratings switch: a pre-June month still counts', () => {
    const mar = seq(1, Array.from({ length: 30 }, (_, i) => alt(6, 10)(i)), '2026-03-01');
    expect(gen('calibration', [...mar, ...sep], [], { ratings: 'current' })).toMatchObject({ value: '2.00 → 0.50' });
    expect(gen('calibration', [...mar, ...sep], [], { ratings: 'current' })!.body).toContain('in Mar 26 to 0.50 in Sep 26');
  });
  it('null with one month of 30 rated brews', () => expect(gen('calibration', [...jul, ...sep.slice(0, 29)])).toBeNull());
});

describe('trend charts', () => {
  // 3 months x 12 bags of 4 rated brews: roast level A climbs 7 -> 8 -> 9, B stays 7.5 / 8.5.
  const level = (m: string, i: number) => (i < 6 ? 'A' : 'B');
  const rate = (m: string, i: number, j: number) => (i < 6 ? { '04': 7, '05': 8, '06': 9 }[m]! : 7.5) + (j % 2 ? 0.5 : -0.5) * (i < 6 ? 0 : 1) + (i >= 6 ? 0.5 : 0);
  const brews = ['04', '05', '06'].flatMap((m, k) => Array.from({ length: 12 }, (_, i) =>
    seq(100 * k + i + 1, [0, 1, 2, 3].map((j) => rate(m, i, j)), `2026-${m}-${String(i + 1).padStart(2, '0')}`, { roastLevel: level(m, i) })).flat());
  it('rating by roast level per month', () => {
    const f = gen('roastRating', brews)!;
    expect(f).toMatchObject({ theme: 'taste', kind: 'pattern', z: null, strength: null, headline: 'A roasts: 7.00 → 9.00', value: '+2.00', sample: '3 months' });
    expect(f.multi).toEqual({ x: ['Apr 26', 'May 26', 'Jun 26'], unit: 'rating', lines: [{ label: 'A', values: [7, 8, 9] }, { label: 'B', values: [8, 8, 8] }] });
  });
  it('roast share of brews per month', () => {
    const shifted = brews.map((b) => (b.localDate.startsWith('2026-06') && b.roastLevel === 'B' ? { ...b, roastLevel: 'A' } : b));
    const f = gen('roastShare', shifted)!;
    expect(f).toMatchObject({ theme: 'taste', headline: 'A: 50% → 100% of brews', value: '100%' });
    expect(gen('roastShare', brews)).toBeNull(); // 50/50 every month: flat
  });
  it('rating trend: flat or under 3 months is no card', () => {
    expect(gen('roastRating', brews.map((b) => ({ ...b, rating: 8 })))).toBeNull();
    expect(gen('roastRating', brews.filter((b) => !b.localDate.startsWith('2026-06')))).toBeNull();
  });
  it('brew #1 vs later brews by month', () => {
    const bs = ['04', '05', '06'].flatMap((m, k) => Array.from({ length: 4 }, (_, i) =>
      seq(10 * k + i + 1, [6 + k * 0.5, 8, 8, 8], `2026-${m}-${String(i + 1).padStart(2, '0')}`)).flat());
    const f = gen('firstVsLater', bs)!;
    expect(f).toMatchObject({ theme: 'dialin', headline: 'Brew #1 gap: -2.00 → -1.00', value: '-1.00' });
    expect(f.multi!.lines).toEqual([{ label: 'Brew #1', values: [6, 6.5, 7] }, { label: 'Later brews', values: [8, 8, 8] }]);
    // first brews under 20% of a month still get their own line (no folding into Other)
    const long = ['04', '05', '06'].flatMap((m, k) => Array.from({ length: 4 }, (_, i) =>
      seq(10 * k + i + 1, [6 + k * 0.5, 8, 8, 8, 8, 8], `2026-${m}-${String(i + 1).padStart(2, '0')}`)).flat());
    expect(gen('firstVsLater', long)!.multi!.lines.map((l) => l.label)).toEqual(['Brew #1', 'Later brews']);
    expect(gen('firstVsLater', bs.filter((b) => b.coffeeId! > 2 && b.coffeeId! < 10 || b.coffeeId! > 10))).toBeNull(); // April under 3 first brews
  });
  it('brews to settle by month', () => {
    const settle = (k: number) => [[8, 8, 8, 8, 8], [6, 8, 8, 8, 8], [5, 6, 7, 8, 8]][k];
    const bs = ['04', '05', '06'].flatMap((m, k) => Array.from({ length: 3 }, (_, i) =>
      seq(10 * k + i + 1, settle(k), `2026-${m}-${String(i + 1).padStart(2, '0')}`)).flat());
    const f = gen('settleTrend', bs)!;
    expect(f).toMatchObject({ theme: 'dialin', headline: 'Dial-in: 1 → 4 brews to settle', value: '4 brews', sample: '9 bags' });
    expect(f.multi).toEqual({ x: ['Apr 26', 'May 26', 'Jun 26'], lines: [{ label: 'Brews to settle', values: [1, 2, 4] }], unit: 'brews' });
    expect(gen('settleTrend', bs.filter((b) => b.coffeeId !== 23))).toBeNull(); // June under 3 bags
  });
});

describe('registry', () => {
  it('empty: no findings', () => expect(all(ctx([]))).toEqual([]));
  it('empty with an empty comparison window', () => expect(all(ctx([], [], { prevBrews: [] }))).toEqual([]));
  it('no NaN / Infinity / undefined text from degenerate data', () => {
    const bs = bags(12, (i) => ({ cost: 20, amountG: 250, purchaseDate: '2026-07-01', firstBrew: '2026-07-01', origin: `O${i % 3}`, restLow: 7, restHigh: 21 }));
    const flat = bs.flatMap((x) => seq(x.id, [8, 8, 8, 8, 8, 8], '2026-07-01', (j) => ({
      dripper: j % 2 ? 'V60' : 'Origami', grinder: 'ZP6', grind: '1.5', filter: 'Abaca', water: 'W', ratio: 16, dose: 15, restDays: 14, costPerBrew: 1.2, bloomSeconds: 30, brewTimeSeconds: 180
    })));
    const c = ctx(flat, bs, { prevBrews: flat, period: { from: '2026-01-01', to: '2026-09-30' } });
    expect(finite(all(c))).toBe(true);
    expect(finite(all({ ...c, brews: flat.map((b) => ({ ...b, rating: 0 })) }))).toBe(true);
    // the same brews over 3 months with a roast level: every trend chart runs
    const spread = flat.map((b, i) => ({ ...b, roastLevel: 'Light', localDate: `2026-0${4 + (i % 3)}-01` }));
    expect(finite(all({ ...c, brews: spread }))).toBe(true);
    expect(finite(all({ ...c, brews: spread.map((b) => ({ ...b, rating: 0 })) }))).toBe(true);
  });
});

describe('insightsTab', () => {
  // 30 bags × 6 brews: dial-in curve (theme dialin) and a pricey/cheap bag set (money).
  const brews = Array.from({ length: 30 }, (_, i) => seq(i + 1, [6, 7, 7.5, 8, 8, 8], '2026-09-10', { dose: 20 })).flat();
  const bs = bags(30, (i) => ({ purchaseDate: '2026-08-01', cost: 20 + i, amountG: 250, status: 'archive' as const }));
  it('theme filters the grid only; stories unchanged', () => {
    const c = ctx(brews, bs, { onHandG: 1000 });
    const a = insightsTab(c, undefined), th = a.grid[0].theme, d = insightsTab(c, th);
    expect(d.grid.length).toBeGreaterThan(0);
    expect(d.grid.every((x) => x.theme === th)).toBe(true);
    expect(d.myths).toEqual(a.myths);
    expect(d.tooEarly).toEqual(a.tooEarly);
    expect(d.stories).toEqual(a.stories);
    expect(a.stories[0].kind).toBe('story');
    // The story retells the dial-in curve: that card leaves the grid.
    expect(a.grid.some((x) => x.key === 'dialinCurve')).toBe(false);
    expect(a.grid.every((x, i, g) => i === 0 || Math.abs(g[i - 1].z ?? -1) >= Math.abs(x.z ?? -1))).toBe(true);
  });
  it('the deck tops up with graded findings that have a body, the same under any theme, out of the grid by key', () => {
    const f = (key: string, o: Partial<Finding>): Finding => ({ key, theme: 'taste', kind: 'number', headline: 'Same words', sample: 's', z: 3, strength: 'solid', ...o });
    const fake: Generator[] = [() => [
      f('story', { kind: 'story', of: 'curve', body: 'b', z: 5 }), f('curve', { kind: 'pattern', z: 5 }),
      f('wordy', { body: 'b', theme: 'gear', z: 4 }), f('hint', { body: 'b', strength: 'hint', z: 1.7 }),
      f('plain', { z: 3.5 }), f('descr', { body: 'b', z: null, strength: null }),
      f('early', { body: 'b', strength: 'early', z: 1 }), ...['a', 'b', 'c'].map((k) => f(`more-${k}`, { body: 'b', z: 2.5 }))
    ]];
    const saved = GENERATORS.splice(0, GENERATORS.length, ...fake);
    try {
      const a = insightsTab(ctx([]), undefined), g = insightsTab(ctx([]), 'gear');
      expect(a.stories.map((x) => x.key)).toEqual(['story', 'wordy', 'more-a', 'more-b', 'more-c']);
      expect(g.stories).toEqual(a.stories);
      // Out by key: 'plain' shares the headline but stays; the story's twin 'curve' goes.
      expect(a.grid.map((x) => x.key)).toEqual(['plain', 'hint', 'descr']);
      expect(g.grid).toEqual([]);
    } finally {
      GENERATORS.splice(0, GENERATORS.length, ...saved);
    }
  });
  it('too early to tell: no negligible deltas (|Δ| < 0.10), the strongest 12 only', () => {
    const f = (key: string, value: string | undefined, z: number): Finding =>
      ({ key, theme: 'taste', kind: 'number', headline: key, value, sample: 's', z, strength: 'early' });
    const fake: Generator[] = [() => [
      f('tiny', '+0.01', 1.4), f('tinyNeg', '-0.09', 1.3), f('noValue', undefined, 0.2),
      ...Array.from({ length: 14 }, (_, i) => f(`real-${i}`, '-0.25', 1.2 - i / 20))
    ]];
    const saved = GENERATORS.splice(0, GENERATORS.length, ...fake);
    try {
      expect(insightsTab(ctx([]), undefined).tooEarly.map((x) => x.key)).toEqual(Array.from({ length: 12 }, (_, i) => `real-${i}`));
    } finally {
      GENERATORS.splice(0, GENERATORS.length, ...saved);
    }
  });
  it('too early to tell: the dialinBy findings always list, outside the cap (gate P4)', () => {
    const f = (key: string, z: number): Finding => ({ key, theme: 'dialin', kind: 'pattern', headline: key, value: '-0.25', sample: 's', z, strength: 'early' });
    const fake: Generator[] = [() => [...Array.from({ length: 14 }, (_, i) => f(`real-${i}`, 1.2 - i / 20)), f('dialinBy:processGroup', 0.1)]];
    const saved = GENERATORS.splice(0, GENERATORS.length, ...fake);
    try {
      expect(insightsTab(ctx([]), undefined).tooEarly.map((x) => x.key)).toEqual([...Array.from({ length: 12 }, (_, i) => `real-${i}`), 'dialinBy:processGroup']);
    } finally {
      GENERATORS.splice(0, GENERATORS.length, ...saved);
    }
  });
  it('defaults come from the data: drinkers = household size, gpp = measured g/day ÷ size', () => {
    // 180 brews × 20 g over Sep 1-30 (30 tracked days): 120 g/day, 2 drinkers → 60 g each; 6 brews/day.
    const t = insightsTab(ctx(brews, bs, { onHandG: 3600 }), undefined);
    expect(t.whatIf).toEqual({ defaults: { drinkers: 2, gpp: 60, inflow: 0, bpd: 6, dose: 20 }, onHandG: 3600, avgPricePerG: expect.any(Number) });
    expect(t.whatIf.avgPricePerG).toBeCloseTo((30 * 20 + (29 * 30) / 2) / 7500, 6);
  });
  it('no divide-by-zero: empty data, household 0, unpriced bags', () => {
    const t = insightsTab(ctx([], [bag({ purchaseDate: '2026-08-01', cost: 0, amountG: 250 })], { householdSize: 0 }), undefined);
    expect(t.whatIf.defaults).toEqual({ drinkers: 0, gpp: 0, inflow: 0, bpd: 0, dose: 0 });
    expect(t.whatIf.avgPricePerG).toBeNull();
    expect(finite(t)).toBe(true);
  });
  it('dial-in findings read every brew; the others the scored ones', () => {
    // Bags 1–3 settle at brew 3, bag 4 at brew 1: Dial-in speed has a spread on every brew. Scored, each bag
    // keeps 4 rated brews, under settlePositions' 5, so the finding exists only if it reads allBrews.
    const raw = [1, 2, 3, 4].flatMap((id) => (id < 4 ? [5, 5, 9, 9, 9, 9] : [9, 9, 9, 9, 9, 9])
      .map((r, i) => brew({ id: id * 10 + i, coffeeId: id, rating: r, brewIndex: i + 1 })));
    const scored = raw.map((b) => (b.brewIndex <= 2 ? { ...b, rating: null } : b));
    const keys = (c: GenCtx) => { const t = insightsTab(c, undefined); return [...t.grid, ...t.stories, ...t.myths, ...t.tooEarly].map((f) => f.key); };
    expect(keys(ctx(scored, [], { allBrews: raw }))).toContain('dialinSpeed');
    expect(keys(ctx(scored, [], { allBrews: scored }))).not.toContain('dialinSpeed');
  });
});

describe('like-with-like findings', () => {
  const LW = { roastLevel: 'Light', processGroup: 'Washed' as const };
  // 12 Light/Washed bags × 5 brews: bag 1 far above its peers, the rest spread 7.8–8.2.
  const peers = Array.from({ length: 12 }, (_, k) => k + 1).flatMap((id) =>
    [0, 1, 2, 3, 4].map((i) => brew({ id: id * 10 + i, coffeeId: id, roaster: id <= 6 ? 'Sey' : 'Other', ...LW,
      rating: id === 1 ? 9.6 : 7.8 + ((id + i) % 5) * 0.1, brewIndex: i + 1 })));
  const bags = Array.from({ length: 12 }, (_, k) => bag({ id: k + 1, name: `Bag ${k + 1}`, roaster: k < 6 ? 'Sey' : 'Other', ...LW }));
  it('standout: the coffee furthest from its like-group', () => {
    const f = gen('likeStandout', peers, bags);
    expect(f?.headline).toMatch(/Bag 1 beats Washed Light coffees by/);
    expect(f?.value).toMatch(/^\+1\.\d\d$/);
  });
  it('dial-in speed by roast level: median settle position per group', () => {
    const slow = [1, 2, 3].flatMap((id) => [5, 6, 7, 9, 9].map((r, i) => brew({ id: 500 + id * 10 + i, coffeeId: 100 + id, rating: r, brewIndex: i + 1, roastLevel: 'Ultralight' })));
    const fast = [1, 2, 3].flatMap((id) => [9, 9, 9, 9, 9].map((r, i) => brew({ id: 700 + id * 10 + i, coffeeId: 200 + id, rating: r, brewIndex: i + 1, roastLevel: 'Medium' })));
    const all = [...slow, ...fast];
    const gb = [...[1, 2, 3].map((id) => bag({ id: 100 + id, roastLevel: 'Ultralight' })), ...[1, 2, 3].map((id) => bag({ id: 200 + id, roastLevel: 'Medium' }))];
    const f = gen('dialinBy:roastLevel', all, gb, { allBrews: all });
    expect(f?.series).toEqual([{ label: 'Medium', value: 1 }, { label: 'Ultralight', value: 4 }]);
  });
  it('rescued bags: a low first two, high once dialed', () => {
    const raw = [1, 2, 3].flatMap((id) => [5, 5.5, 8.5, 9, 9].map((r, i) => brew({ id: id * 10 + i, coffeeId: id, rating: r, brewIndex: i + 1 })));
    const dialIn = new Set(raw.filter((b) => b.brewIndex <= 2).map((b) => b.id));
    const f = gen('rescuedBags', raw, [1, 2, 3].map((id) => bag({ id, name: `Bag ${id}` })), { allBrews: raw, dialIn });
    expect(f?.headline).toBe('3 bags rescued after a rough start');
  });
  it('likeRoaster: the same figure as the Leaderboards roaster row', () => {
    const rs = (roaster: string, ids: number[], r: number) => ids.flatMap((id) => [0, 1, 2, 3, 4].map((i) => brew({ id: id * 10 + i, coffeeId: id, roaster, ...LW, rating: r + (i % 2) * 0.2, brewIndex: i + 1 })));
    const all = [...rs('Sey', [1, 2, 3, 4, 5, 6], 9), ...rs('Other', [7, 8, 9, 10, 11, 12], 6)];
    const gb = all.filter((b) => b.brewIndex === 1).map((b) => bag({ id: b.coffeeId!, roaster: b.roaster!, ...LW }));
    const f = gen('likeRoaster', all, gb)!;
    const row = leaderboard(all, gb, { start: '2026-09-01', end: '2026-09-30' }, 'roasters', 'like', 'all', 'raw').find((r) => r.key === 'Sey')!;
    expect(f.headline).toMatch(/^Sey rates/);
    expect(f.value).toBe(signed(row.value)); // the board's format ("−", not "-")
    expect(f.sample).toBe(`${row.bags} bags`);
  });
  const dialRows = (ids: number[], ratings: number[], o: Partial<BrewFact>) =>
    ids.flatMap((id) => ratings.map((r, i) => brew({ id: id * 100 + i, coffeeId: id, rating: r, brewIndex: i + 1, ...o })));
  it('dial-in by group: medians print as whole brews and ties go to the bigger group', () => {
    const light = [[9, 9, 9, 9, 9], [5, 9, 9, 9, 9], [5, 5, 9, 9, 9], [5, 5, 5, 9, 9]].flatMap((r, k) => dialRows([10 + k], r, { roastLevel: 'Light' }));
    const dark = [20, 21, 22].flatMap((id) => dialRows([id], [5, 5, 9, 9, 9], { roastLevel: 'Dark' }));
    const medium = dialRows([30, 31, 32], [9, 9, 9, 9, 9], { roastLevel: 'Medium' });
    const all = [...light, ...dark, ...medium];
    const gb = [10, 11, 12, 13, 20, 21, 22, 30, 31, 32].map((id) => bag({ id, roastLevel: id < 14 ? 'Light' : id < 30 ? 'Dark' : 'Medium' }));
    const f = gen('dialinBy:roastLevel', all, gb, { allBrews: all });
    expect(f?.series?.map((x) => x.value)).toEqual([1, 3, 3]);
    expect(f?.series?.map((x) => x.label)).toEqual(['Medium', 'Light', 'Dark']);
    expect(f?.headline).toBe('Medium is right on brew 1; Light settles by brew 3');
  });
  it('dial-in by process: groups under 3 bags are left out', () => {
    const w = dialRows([1, 2, 3], [9, 9, 9, 9, 9], { processGroup: 'Washed' });
    const n = [4, 5, 6].flatMap((id) => dialRows([id], [5, 5, 5, 9, 9], { processGroup: 'Natural' }));
    const h = dialRows([7, 8], [5, 5, 5, 5, 9], { processGroup: 'Honey' });
    const all = [...w, ...n, ...h];
    const gb = all.filter((b) => b.brewIndex === 1).map((b) => bag({ id: b.coffeeId!, processGroup: b.processGroup }));
    const f = gen('dialinBy:processGroup', all, gb, { allBrews: all });
    expect(f?.series?.map((x) => x.label)).toEqual(['Washed', 'Natural']);
  });
  it('rescued bags: needs a start below your mean, an end at or above it, and a 1 point lift', () => {
    const mk = (id: number, rs: number[]) => rs.map((r, i) => brew({ id: id * 10 + i, coffeeId: id, rating: r, brewIndex: i + 1 }));
    const good = [1, 2, 3].flatMap((id) => mk(id, [5, 5.5, 8.5, 9, 9]));
    const raw = [...good, ...mk(4, [8, 8, 9.5, 9.5, 9.5]), ...mk(5, [2, 2, 3.5, 4, 4])]; // 4 starts high; 5 ends low
    const dialIn = new Set(raw.filter((b) => b.brewIndex <= 2).map((b) => b.id));
    const f = gen('rescuedBags', raw, [1, 2, 3, 4, 5].map((id) => bag({ id })), { allBrews: raw, dialIn });
    expect(f?.headline).toBe('3 bags rescued after a rough start');
    expect(f?.value).toBe('3 of 5');
  });
  it('likeRoaster: a roaster of 3 one-brew bags does not render, whatever the gap', () => {
    const rs = (roaster: string, ids: number[], r: number, n: number) => ids.flatMap((id) => Array.from({ length: n }, (_, i) => brew({ id: id * 10 + i, coffeeId: id, roaster, ...LW, rating: r, brewIndex: i + 1 })));
    const all = [...rs('Tiny', [1, 2, 3], 2, 1), ...rs('Big', [4, 5, 6, 7, 8, 9], 8, 5), ...rs('Mid', [10, 11, 12, 13, 14, 15], 7, 5)];
    const gb = all.filter((b) => b.brewIndex === 1).map((b) => bag({ id: b.coffeeId!, roaster: b.roaster!, ...LW }));
    const f = gen('likeRoaster', all, gb);
    expect(f!.headline).toMatch(/^Big /); // the widest gap among roasters past the small-sample rule
  });
  it('rescued bags: a one-brew skip (bag with one dial-in brew) and fewer than 3 bags give nothing', () => {
    const mk = (id: number, rs: number[]) => rs.map((r, i) => brew({ id: id * 10 + i, coffeeId: id, rating: r, brewIndex: i + 1 }));
    const raw = [...[1, 2, 3].flatMap((id) => mk(id, [5, 9, 9, 9, 9])), ...mk(4, [9, 9, 9, 9, 9])]; // only brew 1 is dial-in
    const dialIn = new Set(raw.filter((b) => b.brewIndex <= 1).map((b) => b.id));
    expect(gen('rescuedBags', raw, [1, 2, 3, 4].map((id) => bag({ id })), { allBrews: raw, dialIn })).toBeNull();
    const two = [1, 2].flatMap((id) => mk(id, [5, 5.5, 8.5, 9, 9]));
    const d2 = new Set(two.filter((b) => b.brewIndex <= 2).map((b) => b.id));
    expect(gen('rescuedBags', two, [1, 2].map((id) => bag({ id })), { allBrews: two, dialIn: d2 })).toBeNull();
  });
  it('standout: a repurchase of the headline coffee is told apart in the list', () => {
    const twinBags = bags.map((b) => ({ ...b }));
    twinBags[1] = { ...twinBags[1], name: 'Bag 1', purchaseDate: '2026-05-05' };
    twinBags[0] = { ...twinBags[0], purchaseDate: '2026-04-01' };
    const peers2 = peers.map((b) => (b.coffeeId === 2 ? { ...b, rating: 9.0 } : b));
    const f = gen('likeStandout', peers2, twinBags);
    expect(f!.headline).toMatch(/\(roasted /);
    const names = [f!.headline, ...(f!.details?.flatMap((d) => d.items.map((i) => i.name)) ?? [])];
    expect(new Set(names.map((n) => n.replace(/ (beats|trails) .*/, ''))).size).toBe(names.length);
  });
});
