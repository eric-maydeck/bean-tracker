import { describe, it, expect, vi } from 'vitest';

const stub = vi.hoisted(() => ({ spot: null as any }));
vi.mock('$lib/server/insights/lab', async (orig) => {
  const m = await orig<typeof import('$lib/server/insights/lab')>();
  return { ...m, sweetSpotsTab: (...a: Parameters<typeof m.sweetSpotsTab>) => (stub.spot ? { matching: { bags: 0, brews: 0 }, topBags: [], cards: [{ key: 'rest', name: 'Rest', spot: stub.spot }] } : m.sweetSpotsTab(...a)) };
});
import type { BagFact, BrewFact } from '$lib/server/insights/facts';
import { POOL, fact } from './pool';
import { brew, ctx, days } from './testFixtures';
import type { YearCtx } from './year';


// 1,489 brews Feb 9 to Oct 28, May the peak at 226; hours cycle with 1pm three times in 18.
const MONTHLY = [8, 177, 221, 226, 142, 175, 190, 170, 180];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 13, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const SHARE = [0, 1, 3, 4, 5, 7, 6, 7, 7]; // recipe 1's tenths of each month's brews; recipe 2 takes the last two tenths
const TEMP = [92.3, 92.1, 91.2, 91.5, 90.8, 90.9, 90.8, 90.6, 90.6];
const pourFacts = new Map<number, any>();
const rich = (() => {
  const out: BrewFact[] = [];
  MONTHLY.forEach((n, mi) => {
    const m = mi + 2, first = mi === 0 ? 9 : 1, last = mi === 0 ? 16 : mi === 8 ? 28 : new Date(Date.UTC(2026, m, 0)).getUTCDate();
    for (let i = 0; i < n; i++) {
      const h = HOURS[out.length % HOURS.length];
      const wk = Array.from({ length: last - first + 1 }, (_, d) => first + d).filter((d) => [0, 6].includes(new Date(Date.UTC(2026, m - 1, d)).getUTCDay()));
      // a spike (25 March brews on the 14th) and a weekend lean (every 12th brew from the 7th lands on a weekend)
      const day = mi === 1 && i < 25 ? 14 : i % 12 === 6 && wk.length ? wk[((i - 6) / 12) % wk.length] : first + (i % (last - first + 1));
      const mm = String((out.length * 7) % 60).padStart(2, '0');
      out.push(brew({
        at: `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${mm}`,
        dose: 17.89, waterG: 293.5, decaf: h >= 19 && out.length % 20 !== 0,
        ratio: out.length % 3 ? 17 : 15, tempC: TEMP[mi], restDays: 30 + mi * 8
      }));
      const t = out.length % 10, nb = out.at(-1)!;
      if (t < SHARE[mi] || t >= 8) pourFacts.set(nb.id, { recipeId: t >= 8 ? 2 : 1, reading: null });
    }
  });
  return out.sort((a, b) => a.localTime.localeCompare(b.localTime));
})();

// Coffees for `rich`: 110 bags brewed in time order (each bag a run of brews). Roasters: H&S 24 bags / 226 brews,
// Shoebox 33 / 209, Sey 11 / 117, Big Sur 14 / 93, Scenery 9 / 81, ten others 3 bags each. Origins shift
// from Colombia (early) to Ethiopia (late). Bag 86 is the best: 9.5 mean with 10s, bought from two roasters.
const ROASTERS: [string, number, number][] = [['H&S', 24, 226], ['Shoebox', 33, 209], ['Sey', 11, 117], ['Big Sur', 14, 93], ['Scenery', 9, 81]];
for (let i = 0; i < 10; i++) ROASTERS.push([`Other ${i}`, 3, i < 3 ? 77 : 76]);
const EARLY = ['Colombia', 'Colombia', 'Colombia', 'Colombia', 'Colombia', 'Colombia', 'Peru', 'Ethiopia', 'Kenya', 'Ecuador'];
const MID = ['Colombia', 'Colombia', 'Colombia', 'Colombia', 'Peru', 'Peru', 'Ethiopia', 'Ethiopia', 'Kenya', 'Brazil'];
const LATE = ['Ethiopia', 'Ethiopia', 'Ethiopia', 'Colombia', 'Colombia', 'Peru', 'Peru', 'Kenya', 'Brazil', 'Guatemala'];
const shelf = (() => {
  const slots = ROASTERS.flatMap(([r, bags, brews]) => Array.from({ length: bags }, (_, j) => ({ r, n: Math.floor(brews / bags) + (j < brews % bags ? 1 : 0) })));
  const order = slots.map((_, i) => slots[(i * 37) % slots.length]); // 37 is coprime with 110: roasters interleave
  const bags: BagFact[] = [], brews: BrewFact[] = [];
  let at = 0;
  order.forEach((s, k) => {
    const id = 100 + k, t = at / rich.length, o = (t < 1 / 3 ? EARLY : t < 2 / 3 ? MID : LATE)[k % 10];
    const best = k === 86, producer = best ? 'Yoiner' : k === 87 ? 'Yoiner' : `Producer ${k % 40}`;
    bags.push({ id, roaster: s.r, name: `Bag ${k}`, slug: `bag-${k}`, processing: best ? 'Anaerobic Natural' : 'Washed', origin: o, producer, cost: best ? 200 : 20 + (k % 5) * 5, amountG: 250, status: 'archive' } as unknown as BagFact);
    for (const [j, b] of rich.slice(at, at + s.n).entries()) {
      const i = brews.length;
      const rating = best ? (i % 2 ? 9 : 10) : 7 + ((k * 7) % 15) / 10 + ((i % 3) - 1) * 0.3 - (j === 0 ? 0.8 : 0); // first brews of a bag rate lower
      brews.push({ ...b, brewIndex: j + 1, coffeeId: id, roaster: s.r, origin: o, producer, rating, processGroup: k % 2 && t > 0.6 ? 'Natural' : 'Washed', costPerBrew: (b.dose! * (best ? 200 : 20 + (k % 5) * 5)) / 250 });
    }
    at += s.n;
  });
  for (const bg of bags) {
    const mine = brews.filter((b) => b.coffeeId === bg.id).map((b) => b.localDate).sort();
    Object.assign(bg, { firstBrew: mine[0], lastBrew: mine.at(-1), purchaseDate: mine[0] });
  }
  const bb = bags.find((b) => b.id === 186)!, other = bags.find((b) => b.id === 187)!;
  if (bb.roaster === other.roaster) other.roaster = 'Elsewhere', brews.forEach((b) => b.coffeeId === 187 && (b.roaster = 'Elsewhere'));
  // Yoiner also grew bags at three more small roasters (five in all), so producer-roasters shows.
  const used = new Set([bb.roaster, other.roaster]);
  for (const bg of bags) {
    if (used.size >= 5) break;
    if (!bg.roaster.startsWith('Other') || used.has(bg.roaster)) continue;
    used.add(bg.roaster);
    Object.assign(bg, { producer: 'Yoiner' });
    brews.forEach((b) => b.coffeeId === bg.id && Object.assign(b, { producer: 'Yoiner' }));
  }
  return { brews, bags };
})();
const RECIPES = [{ id: 1, name: 'Standard' }, { id: 2, name: 'Shoebox QC' }];
const DRIPPERS = [['V60', 600, 8.4], ['Kalita', 500, 8.1], ['Origami', 389, 8.2]];
const trophies = DRIPPERS.map(([name, brews, rating]) => ({ kind: 'dripper', name, brews, rating, sample: { small: false } }));
// As loadYear builds it: a bag's first brew rating moves to dialRating (onceDialed); the best bag is left out so the record fact keeps its numbers.
const scoredOf = (bs: BrewFact[]) => bs.map((b) => (b.brewIndex === 1 && b.coffeeId !== 186 ? { ...b, rating: null, dialRating: b.rating } : b)) as BrewFact[];
const full = (o: Partial<YearCtx> = {}) => ctx(shelf.brews, { bags: shelf.bags, scored: scoredOf(shelf.brews), trophies, prevBrews: [], pours: { facts: pourFacts, recipes: RECIPES }, ...o } as Partial<YearCtx>);

describe('total', () => {
  it('counts, kg, litres, peak month', () => {
    const s = fact('total').run(ctx(rich))!;
    expect(s.big).toBe('1,489');
    expect(s.context).toBe('26.6kg of coffee through 437L of water, Feb 9 to Oct 28. May was the peak at 226.');
    expect(s.viz).toMatchObject({ kind: 'bars', hi: 3, hiText: '226' });
    expect(s.perPerson).toBe(true);
    expect(s.lead).toBe('In 2026 you brewed');
  });
  it('preview lead; per person divides amounts', () => {
    expect(fact('total').run(ctx(rich, { preview: true }))!.lead).toBe('So far in 2026 you brewed');
    const s = fact('total').run(ctx(rich, { per: 2 }))!;
    expect(s.big).toBe('745');
    expect(s.context).toMatch(/^13\.3kg of coffee through 219L of water/);
    expect(s.context).toMatch(/peak at 113\.$/);
  });
});

describe('streak', () => {
  it('null under 7 days', () => expect(fact('streak').run(ctx(days('2026-03-01', 6)))).toBeNull());
  it('still going when it reaches the year end', () => {
    const s = fact('streak').run(ctx([...days('2026-03-01', 3), ...days('2026-12-20', 12)]))!;
    expect(s.big).toBe('12');
    expect(s.context).toMatch(/^Running since Dec 20 and still going\./);
    expect(s.viz).toMatchObject({ kind: 'calendar' });
  });
  it('not going, with the missed days since the first 7-day run', () => {
    const s = fact('streak').run(ctx([...days('2026-03-01', 7), ...days('2026-03-10', 10)]))!;
    expect(s.context).toBe('Mar 10 to Mar 19. Since Mar 1 you have missed 2 days.');
    expect(fact('streak').run(ctx([...days('2026-03-01', 7), ...days('2026-03-09', 10)]))!.context)
      .toBe('Mar 9 to Mar 18. Since Mar 1 you have missed exactly 1 day: Mar 8.');
    const v = s.viz as { start: string; days: string[] };
    expect(v.start).toBe('2026-02-23'); // Monday
    expect(v.days.slice(0, 6)).toEqual(['none', 'none', 'none', 'none', 'none', 'none']);
    expect(v.days).toContain('miss');
  });
});

describe('hour', () => {
  it('peak hour and the day span', () => {
    const s = fact('hour').run(ctx(rich))!;
    expect(s.big).toBe('1pm');
    expect(s.context).toMatch(/^\d{3} brews: that's 1 in 6 brews at 1pm\. Your brew day spans anywhere from 7:\d\dam to 10:\d\dpm\.$/);
    expect(s.viz).toMatchObject({ kind: 'bars', hi: 6 });
  });
  it('skips backfilled brews; null under 50', () => {
    const timed = days('2026-03-01', 49, '13');
    const typed = Array.from({ length: 100 }, (_, i) => brew({ at: `2026-04-${String(1 + (i % 28)).padStart(2, '0')}T08:00`, backfilled: true }));
    expect(fact('hour').run(ctx([...timed, ...typed]))).toBeNull();
    expect(fact('hour').run(ctx([...timed, brew({ at: '2026-05-01T13:20' })]))).not.toBeNull();
  });
});

describe('decaf', () => {
  const mix = (eveDecaf: number, dayDecaf: number) => [
    ...Array.from({ length: 20 }, (_, i) => brew({ at: `2026-03-${String(1 + i).padStart(2, '0')}T20:10`, decaf: i < eveDecaf })),
    ...Array.from({ length: 20 }, (_, i) => brew({ at: `2026-04-${String(1 + i).padStart(2, '0')}T09:10`, decaf: i < dayDecaf }))
  ];
  it('evening share vs daytime', () => {
    const s = fact('decaf').run(ctx(mix(19, 1)))!;
    expect(s.big).toBe('95%');
    expect(s.context).toBe('19 of your 20 evening brews skipped the caffeine. Before 7pm, decaf is 5%.');
    expect(s.score).toBeCloseTo(0.9);
  });
  it('null without decaf; steady headline when the gap is under 30 points', () => {
    expect(fact('decaf').run(ctx(mix(0, 0)))).toBeNull();
    // decaf about the same day and night: the calm headline
    expect(fact('decaf').run(ctx(mix(12, 8)))).toMatchObject({ lead: 'Day or night, your brews were', big: '50%', unit: 'decaf', context: '60% after 7pm, 40% before: steady all day.', score: 0.25 });
  });
});

describe('coffees facts', () => {
  it('roaster: share · weight · bags rows; runner-up sentence only when bag leader differs', () => {
    const s = fact('roaster').run(full())!;
    expect(s.big).toBe('H&S');
    expect(s.viz).toMatchObject({ kind: 'hlist' });
    expect((s.viz as any).rows[0].texts).toEqual(['15%', '4.0kg', '24 bags']);
    expect(s.context).toBe('15% of your coffee: 4.0kg over 24 bags. You went through more bags of Shoebox (33), but less coffee (3.7kg).');
    const lone = [...days('2026-03-01', 8).map((b, i) => ({ ...b, roaster: 'A', coffeeId: i % 2 + 1 })), ...days('2026-04-01', 4).map((b, i) => ({ ...b, roaster: 'B', coffeeId: 3 }))];
    expect(fact('roaster').run(ctx(lone))!.context).toBe('67% of your coffee: 0.1kg over 2 bags.');
  });
  it('roaster, origin, producer: null under 2 groups (or 3 bags)', () => {
    const one = days('2026-03-01', 20).map((b, i) => ({ ...b, roaster: 'A', origin: 'Peru', producer: 'P', coffeeId: i % 4 }));
    for (const id of ['roaster', 'origin', 'producer']) expect(fact(id).run(ctx(one))).toBeNull();
    const two = one.map((b, i) => (i < 10 ? { ...b, roaster: 'B', origin: 'Kenya', producer: 'Q', coffeeId: 9 } : b));
    expect(fact('origin').run(ctx(two))).not.toBeNull();
    expect(fact('producer').run(ctx(two))).not.toBeNull();
    expect(fact('roaster').run(ctx(two.map((b) => ({ ...b, coffeeId: b.roaster === 'B' ? 1 : 2 }))))).toBeNull(); // 2 bags
  });
  it('origin and producer name the top group', () => {
    const o = fact('origin').run(full())!;
    expect(o.big).toBe('Colombia');
    expect(o.context).toMatch(/^\d+% of everything you brewed: \d+\.\dkg from \d+ bags, out of 7 origins\.$/);
    expect(o.link.href).toContain('open=origins');
    const p = fact('producer').run(full())!;
    expect(p.lead).toBe('Your top producer was');
    expect((p.viz as any).rows).toHaveLength(5);
  });
  it('unlinked brews never name a roaster or origin', () => {
    const blank = days('2026-03-01', 40).map((b) => ({ ...b, coffeeId: null, roaster: null, origin: 'N/A', producer: null }));
    const mixed = [...shelf.brews, ...blank].sort((a, b) => a.localTime.localeCompare(b.localTime));
    const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
    for (const id of ['roaster', 'origin', 'producer', 'turn']) {
      const x = fact(id).run(ctx(mixed, { bags: shelf.bags }));
      expect(x, id).not.toBeNull();
      expect(strings(x).join('|'), id).not.toMatch(/\bnull\b|N\/A|undefined/);
    }
    expect(fact('roaster').run(ctx(blank))).toBeNull();
  });
  it('producer-roasters: names every roaster, null under 5 roasters', () => {
    const s = fact('producer-roasters').run(full())!;
    expect(s.lead).toMatch(/^At \d different roasters you bought coffee from$/);
    expect(s.context).toMatch(/^You bought .+'s coffee from .+ and .+\.$/);
    expect((s.viz as any).rows.length).toBeGreaterThanOrEqual(2);
    const solo = days('2026-03-01', 12).map((b, i) => ({ ...b, producer: `P${i % 2}`, roaster: `R${i % 2}`, coffeeId: i % 2 }));
    expect(fact('producer-roasters').run(ctx(solo))).toBeNull();
    const four = days('2026-03-01', 12).map((b, i) => ({ ...b, producer: 'Pablo', roaster: ['Zed', 'Amy', 'Moss', 'Ned'][i % 4], coffeeId: i % 4 }));
    expect(fact('producer-roasters').run(ctx(four))).toBeNull();
    const three = days('2026-03-01', 12).map((b, i) => ({ ...b, producer: 'Pablo', roaster: ['Zed', 'Amy', 'Moss', 'Ned', 'Ola'][i % 5], coffeeId: i % 5 }));
    const t = fact('producer-roasters').run(ctx(three))!;
    expect(t.lead).toBe('At 5 different roasters you bought coffee from');
    expect(t.context).toBe("You bought Pablo's coffee from Amy, Moss, Ned, Ola and Zed.");
    expect(t.score).toBeCloseTo(1 / 4);
  });
  it('turn: Colombia to Ethiopia, with the process shift', () => {
    const s = fact('turn').run(full())!;
    expect(s.big).toBe('Ethiopia');
    expect(s.lead).toBe('Since August, your most brewed origin is');
    expect(s.context).toBe('Colombia was 51% of Feb\u2060–\u2060Apr brews. Aug\u2060–\u2060Oct, Ethiopia leads at 32%. Washed fell from 100% to 49%.');
    const v = s.viz as any;
    expect(v.kind).toBe('split');
    expect(v.periods.map((p: any) => p.name)).toEqual(['Feb–Apr', 'Aug–Oct']);
    expect(v.periods[0].segs.reduce((t: number, x: any) => t + x.pct, 0)).toBe(100);
    expect(s.score).toBeGreaterThan(0);
  });
  it('turn: null when the leader did not change or a window is thin', () => {
    const same = (n: number, from: string, o: string) => days(from, n).map((b) => ({ ...b, origin: o }));
    // the same leader at both ends: a calm headline, not a null
    expect(fact('turn').run(ctx([...same(40, '2026-01-01', 'Peru'), ...same(40, '2026-07-01', 'Peru')]))).toMatchObject({ lead: 'Start to finish, your most brewed origin was', big: 'Peru', context: 'Peru led both ways: 100% of Jan\u2060–\u2060Feb brews, 100% of Jul\u2060–\u2060Aug brews.', score: 0.25, viz: { kind: 'split' } });
    expect(fact('turn').run(ctx([...same(40, '2026-01-01', 'Peru'), ...same(40, '2026-07-01', 'Kenya')]))).not.toBeNull();
    expect(fact('turn').run(ctx([...same(40, '2026-01-01', 'Peru'), ...same(29, '2026-07-01', 'Kenya')]))).toBeNull(); // thin late window
    expect(fact('turn').run(ctx([...same(40, '2026-01-01', 'Peru'), ...same(40, '2026-04-10', 'Kenya')]))).toBeNull(); // under 6 months
  });
  it('record: settled ratings only; bag named with its roaster', () => {
    const s = fact('record').run(full())!;
    expect(s.lead).toBe('Your best bag of the year was');
    expect(s.big).toBe('Bag 86');
    expect(s.roaster).toBeTruthy();
    expect(s.sub).toMatch(/^9\.50 average · \d+ brews$/);
    expect(s.card.label).toBe('9.50 best bag');
    expect(s.context).toMatch(/^Anaerobic natural\. \d+ brews all year earned a 10\. Yoiner's coffee also came from .+\.$/);
    expect((s.viz as any).rows).toHaveLength(5);
    expect((s.viz as any).rows[0].label).toMatch(/ · Bag 86$/);
    expect(s.score).toBe(1);
    const pre = shelf.brews.map((b) => ({ ...b, localDate: '2026-03-01', localTime: '2026-03-01T09:00' }));
    expect(fact('record').run(ctx(pre, { bags: shelf.bags }))).toBeNull();
  });
  it('record: the big value is the roaster and bag name', () => {
    const bags = [{ id: 1, roaster: 'Sey Coffees', name: 'Gesha', slug: 'g', processing: 'Washed' }] as unknown as BagFact[];
    const bs = days('2026-07-01', 5).map((b) => ({ ...b, coffeeId: 1, rating: 9 }));
    expect(fact('record').run(ctx(bs, { bags }))!.big).toBe('Gesha');
    expect(fact('record').run(ctx(bs, { bags }))!.roaster).toBe('Sey Coffees');
    expect(fact('record').run(ctx(bs, { bags }))!.context).toBe('Washed.');
    expect(fact('record').run(ctx(bs, { bags }))!.sub).toBe('9.00 average · 5 brews');
  });
  it('price: priciest vs average; null under 10 priced brews', () => {
    const s = fact('price').run(full())!;
    expect(s.big).toMatch(/^\$\d+\.\d\d$/);
    expect(s.context).toMatch(/^17\.89g of .+ on [A-Z][a-z]+ \d+\. You rated it [\d.]+\. Your average cup costs \$\d\.\d\d\.$/);
    expect(s.viz).toMatchObject({ kind: 'hlist' });
    const some = days('2026-03-01', 12).map((b, i) => ({ ...b, coffeeId: 1, costPerBrew: i < 9 ? 2 : null }));
    expect(fact('price').run(ctx(some, { bags: shelf.bags }))).toBeNull();
    expect(fact('price').run(ctx(some.map((b) => ({ ...b, costPerBrew: 2 })), { bags: shelf.bags }))).not.toBeNull();
  });
});

describe('recipe, ratio, rest', () => {
  it('recipe: the biggest riser, with the year-long leader when different', () => {
    const s = fact('recipe').run(full())!;
    expect(s.lead).toBe('You used Standard for');
    expect(s.big).toBe('70%');
    expect(s.context).toMatch(/^of \w+'s brews, from 10% in March\./);
    expect(s.viz).toMatchObject({ kind: 'spark' });
    expect(s.link.href).toMatch(/tab=pours/);
  });
  it('recipe: null without matches, with few months or a small rise', () => {
    expect(fact('recipe').run(ctx(rich, { pours: { facts: new Map(), recipes: [] } } as any))).toBeNull();
    expect(fact('recipe').run(ctx(days('2026-03-01', 25), { pours: { facts: pourFacts, recipes: RECIPES } } as any))).toBeNull();
  });
  it('recipe: no riser, enough months: the recipe you kept using', () => {
    const bs = ['2026-03-01', '2026-04-01', '2026-05-01'].flatMap((d) => days(d, 25));
    const pf = new Map(bs.map((b) => [b.id, { recipeId: 1, reading: null }]));
    const s = fact('recipe').run(ctx(bs, { pours: { facts: pf, recipes: RECIPES } } as any))!;
    expect(s).toMatchObject({ lead: 'You kept coming back to', context: '100% of all brews (75), steady month to month.', score: 0.25, viz: { kind: 'spark' } });
  });
  it('ratio: 1:17 brew ratio; temperature sentence only with a 1.0C drift', () => {
    const s = fact('ratio').run(full())!;
    expect(`${s.big} ${s.unit}`).toBe('1:17 brew ratio');
    expect(s.lead).toBe('2 in 3 brews used a');
    expect(s.context).toMatch(/^1g of coffee to 17g of water, in [\d,]+ of 1,489 brews\. And the kettle cooled off all year: 92\.1°C on average in March, 90\.6°C in October\.$/);
    expect(s.viz).toMatchObject({ kind: 'spark' });
    const flat = rich.map((b) => ({ ...b, tempC: 91 }));
    const f = fact('ratio').run(ctx(flat))!;
    expect(f.context).not.toMatch(/°C/);
    expect(f.viz).toBeUndefined();
    expect(fact('ratio').run(ctx(days('2026-03-01', 29).map((b) => ({ ...b, ratio: 17 }))))).toBeNull();
    expect(fact('ratio').run(ctx(rich.map((b, i) => ({ ...b, ratio: 10 + (i % 4) }))))).toBeNull(); // mode under 40%
  });
  it('rest: without a win, the backup copy; null under a 14 day shift', () => {
    const s = fact('rest').run(ctx(rich))!;
    expect(s.lead).toBe('Your beans now wait');
    expect(s.big).toBe('94d');
    expect(s.context).toBe('on average, up from 38d in March.');
    expect(s.score).toBeCloseTo(56 / 60);
    // no shift: a calm headline about how steady the rest is, not a null
    expect(fact('rest').run(ctx(rich.map((b) => ({ ...b, restDays: 40 }))))).toMatchObject({ lead: 'Your beans typically rest', big: '40d', context: 'on average, steady month to month: 40d every month.', score: 0.25, viz: { kind: 'spark' } });
    expect(fact('rest').run(ctx(rich.map((b, i) => ({ ...b, restDays: i % 2 ? 100 : 20, localDate: b.localDate.slice(0, 5) + (b.localDate.slice(5, 7) < '04' ? '02' : '03') + b.localDate.slice(7) }))))!.big).toBe('60d');
    expect(fact('rest').run(ctx(days('2026-03-01', 5).map((b) => ({ ...b, restDays: 40 }))))).toBeNull(); // thin: under 2 months of 10
  });
});

describe('rest card figures', () => {
  const band = (label: string, value: number, small = false) => ({ label, value, bags: 5, brews: 30, solid: true, sample: { bags: 5, brews: 30, small } });
  const t2 = (o: any = {}) => ({ tier: 2, verdict: 'win', best: { label: '45–59', value: 7.42, strength: 'solid' }, next: { label: '60–89', value: 7.34 }, usual: { label: '30–44', mean: 7.02 },
    bands: [band('30–44', 7.0), band('45–59', 7.42), band('60–89', 7.34)], ...o });
  const run = (spot: any, brews: BrewFact[] = rich) => { stub.spot = spot; try { return fact('rest').run(ctx(brews)); } finally { stub.spot = null; } };
  it('tier 2: the card means, best against the usual band', () => {
    const s = run(t2())!;
    expect(s).toMatchObject({ lead: 'Your beans rest best at', big: '45–59d' });
    expect(s.score).toBeCloseTo(0.8);
    expect(s.context).toBe('7.42 average since June, against 7.02 at 30–44d.');
    expect((s.viz as any).rows.map((r: any) => r.label)).toEqual(['30–44d', '45–59d', '60–89d']);
  });
  it('tier 2: best = usual compares with the runner-up', () => {
    const s = run(t2({ usual: { label: '45–59', mean: 7.4 } }))!;
    expect(s.context).toBe('7.42 average since June, against 7.34 at 60–89d.');
    expect(s.score).toBeCloseTo(0.16);
  });
  it('band labels that already carry a spaced " d" still read "22–30d" (a unit never parts from its number)', () => {
    const sp = (label: string, v: number) => ({ ...band(label, v), label });
    const s = run(t2({ best: { label: '22–30 d', value: 7.42, strength: 'solid' }, usual: { label: '0–21 d', mean: 7.02 }, bands: [sp('0–21 d', 7.0), sp('22–30 d', 7.42), sp('60+ d', 7.1)] }))!;
    expect(s.big).toBe('22–30d');
    expect(s.context).toBe('7.42 average since June, against 7.02 at 0–21d.');
    expect((s.viz as any).rows.map((r: any) => r.label)).toEqual(['0–21d', '22–30d', '60d+']);
  });
  it('tier 1: a signed same-bag gap', () => {
    const s = run({ tier: 1, verdict: 'win', best: { label: '45–59', value: 0.42, strength: 'solid' }, usual: { label: '45–59', mean: 7.4 }, bands: [band('30–44', -0.1), band('45–59', 0.42)] })!;
    expect(s.big).toBe('45–59d');
    expect(s.context).toBe('+0.42 since June, against the same bags at other rests.');
    expect(s.score).toBeCloseTo(0.84);
  });
  it('a small best band is no win: backup copy', () => {
    expect(run(t2({ bands: [band('45–59', 7.42, true)] }))!.lead).toBe('Your beans now wait');
  });
  it('non-win verdicts: backup copy on a big shift, the steady headline on a small one', () => {
    expect(run(t2({ verdict: 'tie' }))!.lead).toBe('Your beans now wait');
    expect(run(t2({ verdict: 'early' }), rich.map((b) => ({ ...b, restDays: 40 })))!.lead).toBe('Your beans typically rest');
  });
});

describe('busiest-day, bags-finished, spend, best-value', () => {
  const noBags = (o: Partial<YearCtx> = {}) => full({ bags: [], ...o });
  it('busiest-day: the spike, its week, and a usual day', () => {
    const s = fact('busiest-day').run(full())!;
    expect(s).toMatchObject({ lead: 'On your busiest day you brewed', unit: 'brews', perPerson: true });
    expect(s.context).toMatch(/^That was Mar 14\. A usual brew day has \d+\.$/);
    expect(Number(s.big)).toBeGreaterThan(25);
    expect((s.viz as any).values).toHaveLength(7);
    expect((s.viz as any).values[(s.viz as any).hi]).toBe(Number(s.big));
    expect(fact('busiest-day').run(full({ per: 2 }))!.big).toBe(String(Math.round(Number(s.big) / 2)));
  });
  it('busiest-day: an ordinary busiest day gets a steady headline when the data is not thin', () => {
    const many = days('2026-03-01', 30).map((b, i) => ({ ...b, coffeeId: 1 + (i % 3) }));
    expect(fact('busiest-day').run(ctx(many))).toMatchObject({ lead: 'Even your busiest day was a steady one: you brewed', big: '1', unit: 'brews', score: 0.25 });
  });
  it('busiest-day: null when the busiest day is ordinary', () => {
    expect(fact('busiest-day').run(ctx(days('2026-03-01', 20)))).toBeNull();
  });
  it('bags-finished: counts bags whose last brew is in the year, names the fastest', () => {
    const s = fact('bags-finished').run(full())!;
    expect(s).toMatchObject({ lead: 'You finished', big: '121', unit: 'bags' });
    expect(s.context).toMatch(/^The fastest went in \d+ days: .+ · Bag \d+\.$/);
    expect((s.viz as any).values.reduce((a: number, b: number) => a + b, 0)).toBe(121);
    expect(fact('bags-finished').run(noBags())).toBeNull();
  });
  it('spend: per person divides dollars, not bags', () => {
    const one = fact('spend').run(full())!, two = fact('spend').run(full({ per: 2 }))!;
    const num = (t: string) => Number(t.replace(/[$,]/g, ''));
    expect(one.lead).toBe('You spent');
    expect(one.context).toMatch(/^on 121 bags, \$[\d.,]+\/100g on average\.$/);
    expect(two.context).toBe(one.context);
    expect(Math.abs(num(two.big) - num(one.big) / 2)).toBeLessThanOrEqual(0.5);
    expect((one.viz as any).rows).toHaveLength(3);
    expect(fact('spend').run(noBags())).toBeNull();
  });
  it('best-value: names the bag and its roaster, null without prices', () => {
    const s = fact('best-value').run(full())!;
    expect(s).toMatchObject({ lead: 'Your best value bag was', big: expect.stringMatching(/^Bag \d+$/) });
    expect(s.roaster).toBeTruthy();
    expect(s.sub).toMatch(/^\$[\d.,]+\/100g · \d+\.\d\d average$/);
    expect((s.viz as any).rows.length).toBeLessThanOrEqual(3);
    expect(fact('best-value').run(full({ bags: shelf.bags.map((b) => ({ ...b, cost: null })) }))).toBeNull();
  });
});

describe('consistent, dial-in, weekend, top-dripper', () => {
  it('consistent: names the steadiest bag with its range', () => {
    const s = fact('consistent').run(full())!;
    expect(s).toMatchObject({ lead: 'Your most consistent bag was', big: expect.stringMatching(/^Bag \d+$/) });
    expect(s.roaster).toBeTruthy();
    expect(s.sub).toMatch(/^±0\.\d\d over \d+ brews$/);
    expect(s.context).toMatch(/^All within [\d.]+–[\d.]+\.$/);
    expect(fact('consistent').run(ctx(days('2026-03-01', 3)))).toBeNull();
    const wild = shelf.brews.map((b) => ({ ...b, rating: b.brewIndex % 2 ? 10 : 5 }));
    expect(fact('consistent').run(full({ brews: wild, scored: wild }))).toBeNull(); // every bag's SD is above 0.5
  });
  it('dial-in: average brews a new bag took to settle, with the first-brew gap when it is 0.1 or more', () => {
    // n bags of `ratings` each (brew 1.. in order), brewed on consecutive July days.
    const bagsOf = (n: number, ratings: number[]) => Array.from({ length: n }, (_, k) =>
      ratings.map((rating, i) => brew({ at: `2026-07-${String(1 + i).padStart(2, '0')}T09:${String(10 + k).padStart(2, '0')}`, coffeeId: k + 1, brewIndex: i + 1, rating }))).flat();
    // 6 bags rating 6, 7, 8, 8, 8, 8: settled at 8 (less 0.25), first reached at brew 3; brew 1 is 1.8 under the rest.
    const s = fact('dial-in').run(ctx(bagsOf(6, [6, 7, 8, 8, 8, 8])))!;
    expect(s).toMatchObject({ lead: 'On average, dialing in a new bag took', big: '3.0', unit: 'brews', context: 'Across 6 bags. First brews rated 1.8 lower than the rest.' });
    expect(s.viz).toMatchObject({ kind: 'bars', values: [0, 0, 6, 0], labels: ['1', '2', '3', '4+'], hi: 2, hiText: '6' });
    expect(s.card).toEqual({ big: '3.0', label: 'brews to dial in' });
    // every brew rates the same: brew 1 already settled, and the gap sentence is left out (|gap| < 0.1)
    expect(fact('dial-in').run(ctx(bagsOf(6, [8, 8, 8, 8, 8, 8])))).toMatchObject({ big: '1.0', context: 'Across 6 bags.' });
    // a higher first brew reads "higher"
    expect(fact('dial-in').run(ctx(bagsOf(5, [9, 8, 8, 8])))!.context).toBe('Across 5 bags. First brews rated 1.0 higher than the rest.');
    expect(fact('dial-in').run(ctx(bagsOf(4, [6, 7, 8, 8, 8, 8])))).toBeNull(); // under 5 bags
    expect(fact('dial-in').run(ctx(bagsOf(6, [6, 7, 8]))) ).toBeNull(); // under 4 rated brews each
    expect(fact('dial-in').run(full())).not.toBeNull();
  });
  it('weekend: an even week gets the steady headline', () => {
    const w = fact('weekend').run(ctx(days('2026-03-02', 140), { prevBrews: [] }))!;
    expect(w).toMatchObject({ lead: 'Weekends or weekdays, you brewed', big: '0.5', unit: 'a day', context: '0.5 on weekends, 0.5 on weekdays: steady all week.', score: 0.25, viz: { kind: 'bars' } });
    expect(fact('weekend').run(ctx(days('2026-03-02', 70), { prevBrews: [] }))).toBeNull(); // thin: under the sample minimum
  });
  it('weekend: the lean', () => {
    const s = fact('weekend').run(full())!;
    expect(s.lead).toBe('On weekends you brew');
    expect(s.big).toMatch(/^\d+% more$/);
    expect(s.context).toMatch(/^[\d.]+ brews a day on weekends, [\d.]+ on weekdays\.$/);
    expect((s.viz as any).values).toHaveLength(7);
  });
  it('top-dripper: the go-to dripper, null under 2 drippers or 25%', () => {
    const s = fact('top-dripper').run(full())!;
    expect(s).toMatchObject({ lead: 'Your go-to dripper was', big: 'V60', context: '40% of brews, out of 3 drippers. It averaged 8.40.' });
    expect((s.viz as any).rows).toHaveLength(3);
    expect(fact('top-dripper').run(full({ trophies: trophies.slice(0, 1) as any }))).toBeNull();
    expect(fact('top-dripper').run(full({ trophies: [...trophies, ...trophies, ...trophies, ...trophies].map((t, i) => ({ ...t, name: `D${i}`, brews: 100 })) as any }))).toBeNull();
  });
  it('pool has 22 facts with unique ids', () => {
    expect(POOL).toHaveLength(22);
    expect(new Set(POOL.map((f) => f.id)).size).toBe(22);
    expect(POOL.every((f) => /^[a-z][a-z0-9-]*$/.test(f.id))).toBe(true);
  });
});

describe('every fact', () => {
  it('links with caffeine=all and the year', () => {
    const got = POOL.map((f) => f.run(full()));
    expect(got.every(Boolean)).toBe(true);
    for (const s of got) expect(s!.link.href).toMatch(/range=2026&caffeine=all/);
  });
  it('copy uses digits and unspaced units, with a card and section', () => {
    for (const f of POOL) {
      const s = f.run(full())!;
      expect(`${s.big} ${s.context}`).not.toMatch(/\d (g|kg|L|s|d|°C|mL)\b/);
      expect(s.card.big && s.card.label && s.link.section).toBeTruthy();
    }
  });
});
