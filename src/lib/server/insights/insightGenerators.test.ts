import { describe, it, expect } from 'vitest';
import { GENERATORS, insightsTab, type GenCtx } from './insightGenerators';
import { MIXED_FILTER, type BagFact, type BrewFact } from './facts';
import { addDays } from './time';

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
  it('brews per brew day, versus', () => {
    const f = gen('weekendVsWeekday', mk(28, 5))!;
    expect(f).toMatchObject({ theme: 'habits', kind: 'versus', headline: "Weekends aren't binges", sample: '28 brew days', z: null });
    expect(f.sides).toEqual([{ label: 'Weekends', value: '5.00' }, { label: 'Weekdays', value: '6.00' }]);
    expect(gen('weekendVsWeekday', mk(28, 8))!.headline).toBe('You brew more on weekends');
  });
  it('null under 30 weekend brews', () => expect(gen('weekendVsWeekday', mk(7, 5))).toBeNull());
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
  // 2026-09-07 is a Monday; each bag brewed once a day for a week, Mondays 1 point up.
  const mk = (bags: number, monday: number) => Array.from({ length: bags }, (_, i) =>
    days('2026-09-07', 7).map((d, j) => at(d, '09:15', { coffeeId: i + 1, rating: j === 0 ? 7.5 + monday : 7.5 + alt(-0.2, 0.2)(i + j) }))).flat();
  it('the standout weekday', () => {
    const f = gen('weekday', mk(35, 1))!;
    expect(f).toMatchObject({ theme: 'habits', strength: 'solid', sample: '35 brews' });
    expect(f.headline).toMatch(/^Mondays rate 1\.\d\d higher$/);
  });
  it('a weak standout is too early, with the multiple-comparison caveat', () => {
    // ±0.5 day-to-day noise that cancels per weekday over 36 bags; Mondays only +0.05
    const weak = Array.from({ length: 36 }, (_, i) =>
      days('2026-09-07', 7).map((d, j) => at(d, '09:15', { coffeeId: i + 1, rating: 7.5 + alt(-0.5, 0.5)(i + j) + (j === 0 ? 0.05 : 0) }))).flat();
    expect(gen('weekday', weak)).toMatchObject({ strength: 'early', caveat: 'With 7 weekdays compared, one usually stands out by chance.' });
    expect(gen('weekday', weak)!.headline).toMatch(/^Mondays rate 0\.\d\d higher$/);
  });
  it('null under 30 brews a weekday', () => expect(gen('weekday', mk(20, 1))).toBeNull());
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
    expect(f.series!.map((s) => s.value)).toEqual([90, 100, 85]);
    expect(gen('gearEras:water', brews)).toBeNull(); // no water logged
  });
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
      theme: 'money', headline: 'Your top 3 roasters are 75% of your bags', value: '75%', sample: '12 bags, 5 roasters',
      body: 'A, B and C. Rising: D, 2 of your last 2 bags (0 of 10 before).'
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
  const mk = (n: number, ratio = [15, 15, 17, 17]) => Array.from({ length: n }, (_, i) =>
    seq(i + 1, [7.9, 8.1, 8.1, 7.9], '2026-07-01', (j) => ({ ratio: ratio[j], dose: [15, 15, 16, 16][j], grind: ['1.5', '1.5', '1.10', '1.10'][j], grinder: 'ZP6' }))).flat();
  it('all |r| ≤ 0.1: one myth card', () => {
    const f = gen('variablesMyth', mk(10))!;
    expect(f).toMatchObject({ theme: 'dialin', kind: 'myth', value: '|r| ≤ 0.00', sample: '40 brews' });
    expect(f.body).toBe('Ratio, dose and ZP6 grind all stay within |r| ≤ 0.00 of your rating, within a bag.');
  });
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
  });
});

describe('insightsTab', () => {
  // 30 bags × 6 brews: dial-in curve (theme dialin) and a pricey/cheap bag set (money).
  const brews = Array.from({ length: 30 }, (_, i) => seq(i + 1, [6, 7, 7.5, 8, 8, 8], '2026-09-10', { dose: 20 })).flat();
  const bs = bags(30, (i) => ({ purchaseDate: '2026-08-01', cost: 20 + i, amountG: 250, status: 'archive' as const }));
  it('theme filters the grid only; stories unchanged', () => {
    const c = ctx(brews, bs, { onHandG: 1000 });
    const a = insightsTab(c, undefined, {}), d = insightsTab(c, 'dialin', {});
    expect(a.grid.length).toBeGreaterThan(0);
    expect(d.grid.length).toBeGreaterThan(0);
    expect(d.grid.every((x) => x.theme === 'dialin')).toBe(true);
    expect(d.myths).toEqual(a.myths);
    expect(d.tooEarly).toEqual(a.tooEarly);
    expect(d.stories).toEqual(a.stories);
    expect(a.stories.every((x) => x.kind === 'story')).toBe(true);
    expect(a.grid.every((x, i, g) => i === 0 || Math.abs(g[i - 1].z ?? -1) >= Math.abs(x.z ?? -1))).toBe(true);
  });
  it('defaults come from the data: drinkers = household size, gpp = measured g/day ÷ size', () => {
    // 180 brews × 20 g over Sep 1-30 (30 tracked days): 120 g/day, 2 drinkers → 60 g each; 6 brews/day.
    const t = insightsTab(ctx(brews, bs, { onHandG: 3600 }), undefined, {});
    expect(t.whatIf.defaults).toEqual({ drinkers: 2, gpp: 60, inflow: 0, bpd: 6, dose: 20 });
    expect(t.whatIf.runway).toEqual({ days: 30, emptyOn: '2026-11-10' });
    expect(t.whatIf.avgPricePerG).toBeCloseTo((30 * 20 + (29 * 30) / 2) / 7500, 6);
    expect(t.whatIf.spend.perMonth).toBeCloseTo(6 * 20 * 30.44 * t.whatIf.avgPricePerG!, 6);
    expect(insightsTab(ctx(brews, bs, { onHandG: 3600 }), undefined, { drinkers: 1 }).whatIf.runway.days).toBe(60);
  });
  it('no divide-by-zero: empty data, household 0, unpriced bags', () => {
    const t = insightsTab(ctx([], [bag({ purchaseDate: '2026-08-01', cost: 0, amountG: 250 })], { householdSize: 0 }), undefined, {});
    expect(t.whatIf.defaults).toEqual({ drinkers: 0, gpp: 0, inflow: 0, bpd: 0, dose: 0 });
    expect(t.whatIf.avgPricePerG).toBeNull();
    expect(t.whatIf.spend.perMonth).toBeNull();
    expect(t.whatIf.runway).toEqual({ days: null, emptyOn: null });
    expect(finite(t)).toBe(true);
  });
});
