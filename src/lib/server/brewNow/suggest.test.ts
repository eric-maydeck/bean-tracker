import { describe, it, expect } from 'vitest';
import { suggest, thisCoffeeSummary, tierOf, grindStep, similarCoffees, type Gear } from './suggest';
import type { BrewRow, CoffeeDetails, GearClass } from './load';

let id = 0;
const brew = (o: Partial<BrewRow> = {}): BrewRow => ({
  id: ++id, coffeeId: 1, slug: 's1', roaster: 'Sey', coffeeName: 'Kiambu', origin: 'Kenya', processGroup: 'Washed', roastLevel: 'Light',
  localTime: '2026-10-01T08:00', restDays: 10, grinder: 'ZP6', grind: '5.5', grindNum: 5.005, dripper: 'V60', filter: 'Cafec Abaca',
  tempC: 94, dose: 15, waterG: 250, water: 'Third Wave', recipeId: 1, recipeName: 'Rec One', rating: 7, best: false, notes: null,
  decaf: false, grinderArchived: false, methodArchived: false, ...o
});
const target: CoffeeDetails = { id: 1, slug: 's1', roaster: 'Sey', coffeeName: 'Kiambu', roastDate: null, restDays: 10, gramsLeft: 100,
  processing: 'Washed', origin: 'Kenya', roastLevel: 'Light', decaf: false };
const gc: GearClass = {
  dripper: (n) => (n === 'V60' || n === 'CT62' ? 'cone' : (n ?? '')),
  filter: (n) => (n === 'Sibarist Fast' ? n : !n ? '' : 'any')
};
const gear: Gear = { grinder: 'ZP6', dripper: 'V60', filter: 'Cafec Abaca' };
const run = (rows: BrewRow[], g: Gear = gear, t = target, doses = [15, 18, 20]) => suggest(t, rows, g, gc, doses, '2026-10-28');
const get = (s: ReturnType<typeof run>, k: string) => s.rows.find((r) => r.setting === k)!;

describe('tiers', () => {
  it('clone is 1; same roaster + origin/process 2; same roaster otherwise 3; other roaster same pg+roast 4; rest 5', () => {
    expect(tierOf(target, brew({ roaster: ' sey ', coffeeName: 'KIAMBU', coffeeId: 2 }))).toBe(1);
    expect(tierOf(target, brew({ coffeeName: 'Other' }))).toBe(2);
    expect(tierOf(target, brew({ coffeeName: 'Other', origin: 'Peru', processGroup: 'Natural' }))).toBe(3);
    expect(tierOf(target, brew({ roaster: 'Tim', coffeeName: 'X', origin: 'Peru' }))).toBe(4);
    expect(tierOf({ ...target, processing: 'Washed', roastLevel: 'Light/Med' }, brew({ roaster: 'Tim', coffeeName: 'X', roastLevel: 'Light/Medium' }))).toBe(4);
    expect(tierOf(target, brew({ roaster: 'Tim', coffeeName: 'X', roastLevel: 'Dark' }))).toBe(5);
  });
  it('decaf is a similarity key for tier 4', () => {
    expect(tierOf(target, brew({ roaster: 'Tim', coffeeName: 'X', decaf: true }))).toBe(5);
    expect(tierOf({ ...target, decaf: true }, brew({ roaster: 'Tim', coffeeName: 'X', decaf: true }))).toBe(4);
  });
  const clones = (temps: number[]) => temps.map((tempC) => brew({ tempC }));
  it('tier 1 beats tier 2 when it has 3 brews', () => {
    const s = run([brew({ tempC: 92, coffeeId: 2, coffeeName: 'Other' }), ...clones([95, 95, 95])]);
    expect(get(s, 'temp')).toMatchObject({ tier: 1, value: '95 °C', confidence: 'high', reason: 'Median 95 °C of 3 brews, this coffee' });
    expect(s.basis).toBe('This coffee, 3 brews');
    expect(s.basisCoffees).toEqual([{ slug: 's1', name: 'Kiambu', roaster: 'Sey', brews: 3 }]);
  });
  it('a thin tier pools down at half weight; the reason names the mix; confidence follows the winning tier', () => {
    const s = run([brew({ tempC: 95 }), brew({ tempC: 90, coffeeId: 2, coffeeName: 'Other' }), brew({ tempC: 90, coffeeId: 2, coffeeName: 'Other' }),
      brew({ tempC: 80, coffeeId: 3, roaster: 'Tim', coffeeName: 'T' })]);
    const t = get(s, 'temp');
    expect(t).toMatchObject({ tier: 1, confidence: 'moderate', reason: 'Median 90 °C of 3 brews, 1 this coffee + 2 same roaster, alike' });
    expect(t.evidence).toHaveLength(3);
  });
  it('decaf brews weigh double in the same-roaster tiers and half when they differ', () => {
    const rows = [brew({ coffeeName: 'A', coffeeId: 2, tempC: 90, decaf: true }), brew({ coffeeName: 'B', coffeeId: 3, tempC: 96 }), brew({ coffeeName: 'C', coffeeId: 4, tempC: 96 })];
    expect(get(run(rows, gear, { ...target, decaf: true }), 'temp').value).toBe('90 °C');
    expect(get(run(rows), 'temp').value).toBe('96 °C');
  });
  it('confidence labels: low for similar coffees, guess for the rest', () => {
    const sim = [1, 2, 3].map((i) => brew({ roaster: 'Tim', coffeeName: `X${i}`, coffeeId: 10 + i }));
    expect(get(run(sim), 'temp').confidence).toBe('low');
    expect(get(run([brew({ roaster: 'Tim', coffeeName: 'Y', roastLevel: 'Dark' })]), 'temp').confidence).toBe('guess');
  });
  it('temps follow the process group: same process counts double, and the synopsis says how they differ', () => {
    const rows = [brew({ coffeeName: 'A', coffeeId: 2, tempC: 92, processGroup: 'Natural' }), brew({ coffeeName: 'B', coffeeId: 3, tempC: 95 }), brew({ coffeeName: 'C', coffeeId: 4, tempC: 95 })];
    const t = get(run(rows, gear, { ...target, processing: 'Natural' }), 'temp');
    expect(t.value).toBe('92 °C');
    expect(t.synopsis.join(' ')).toMatch(/Your natural coffees ran ~3 °C cooler than washed ones/);
  });
});

describe('grind', () => {
  it('uses only the chosen grinder; no rows → null with reference, other rows filled', () => {
    const s = run([brew({ grinder: 'A4Z', grind: '1.4.5' }), brew({ grinder: 'A4Z', grind: '1.5.0', rating: 9 })]);
    const g = get(s, 'grind');
    expect(g).toMatchObject({ value: null, reason: 'No data on this grinder yet', tier: null });
    expect(g.reference).toEqual([{ grinder: 'A4Z', grind: expect.stringMatching(/^1\.\d\.\d$/) }]);
    expect(get(s, 'temp').value).toBe('94 °C');
  });
  it('a grinder with brews but none on this dripper says so; no brews at all keeps the old copy', () => {
    const rows = [brew(), brew({ grinder: 'A4Z', dripper: 'Graycano' })];
    expect(get(run(rows, { ...gear, dripper: 'Graycano', filter: 'Cafec Abaca' }), 'grind')).toMatchObject({ value: null, reason: 'No Graycano brews on this grinder yet' });
    expect(get(run(rows, { ...gear, grinder: 'Nope' }), 'grind').reason).toBe('No data on this grinder yet');
  });
  it('a missing grind counts as a guess in the footer confidence', () => {
    const rows = [1, 2, 3].map(() => brew());
    expect(run(rows).confidence).toBe('high');
    expect(run(rows, { ...gear, grinder: 'Nope' }).confidence).toBe('guess');
  });
  const series = (ratings: number[], best = -1) => ratings.map((rating, i) =>
    brew({ grind: (6.5 - i * 0.2).toFixed(1), rating, best: i === best, localTime: `2026-10-0${i + 1}T08:00` }));
  it('rising ratings as grind goes lower, best at the lowest → a range down to one step past it', () => {
    const rows = series([5, 6, 7, 8, 9], 4);
    expect(grindStep(rows, 'ZP6')).toBeCloseTo(0.2);
    const g = get(run(rows), 'grind');
    expect(g.value).toBe('5.5–5.7');
    expect(g.reason).toBe('Best at 5.7; down to 5.5 for more sweetness');
    expect(g.reason.length).toBeLessThanOrEqual(60);
    expect(g.synopsis.join(' ')).toMatch(/over-extraction/);
  });
  it('ratings rising with coarser grinds → best up to one step coarser, with the clarity reason', () => {
    const rows = [5, 6, 7, 8, 9].map((rating, i) => brew({ grind: (1.2 + i * 0.1).toFixed(1), rating, best: i === 4, localTime: `2026-10-0${i + 1}T08:00` }));
    const g = get(run(rows), 'grind');
    expect(g.value).toBe('1.6–1.7');
    expect(g.reason).toBe('Best at 1.6; up to 1.7 for more clarity');
    expect(g.synopsis.join(' ')).toMatch(/under-extraction/);
  });
  it('a larger suggested dose than the evidence says so, and brews with a near dose count more', () => {
    const rows = [brew({ dose: 15, grind: '5.0' }), brew({ dose: 15, grind: '5.0' }), brew({ dose: 21, grind: '6.0' }), brew({ dose: 21, grind: '6.0' })];
    const big = run(rows.slice(0, 2), gear, target, [20]);
    expect(get(big, 'dose').value).toBe('20 g');
    expect(get(big, 'grind').synopsis.join(' ')).toMatch(/larger doses usually need a coarser grind/);
    expect(get(run(rows, gear, target, [20]), 'grind').value).toBe('6.0');
  });
  it('flat ratings → the best brew itself', () => {
    expect(get(run(series([7, 7, 7, 7, 7], 2)), 'grind').value).toBe('6.1');
  });
  it('grindStep: 1.0→1.1→1.3 is 0.2 (median of 0.1, 0.2 rounds up); no moves → 0.1', () => {
    const bag = ['1.0', '1.1', '1.3'].map((grind, i) => brew({ grind, localTime: `2026-10-0${i + 1}T08:00` }));
    expect(grindStep(bag, 'ZP6')).toBe(0.2);
    expect(grindStep([brew(), brew()], 'ZP6')).toBe(0.1);
  });
});

describe('thin data (focus 1)', () => {
  it('no tier 1-3 brews → every row has a value, guess', () => {
    const s = run([brew({ roaster: 'X', coffeeName: 'Y', origin: 'Peru', processGroup: 'Natural' })]);
    expect(s.rows.every((r) => r.value !== null && r.tier === 5)).toBe(true);
    expect(s.confidence).toBe('guess');
    expect(s.basis).toMatch(/^Any coffee/);
  });
});

describe('gear (focus 2)', () => {
  const mixed = [brew({ dripper: 'Gabi Master A', filter: 'Cafec Abaca', tempC: 90 }), brew({ tempC: 96 }),
    brew({ dripper: 'Graycano', filter: 'Sibarist Fast', tempC: 88 }), brew({ dripper: 'CT62', tempC: 93 })];
  it('Gabi uses only Gabi brews', () => {
    const s = run(mixed, { ...gear, dripper: 'Gabi Master A' });
    expect(s.rows.flatMap((r) => r.evidence).every((b) => b.dripper === 'Gabi Master A')).toBe(true);
    expect(get(s, 'temp').value).toBe('90 °C');
  });
  it('Graycano + Sibarist Fast: only that pair', () => {
    const s = run(mixed, { ...gear, dripper: 'Graycano', filter: 'Sibarist Fast' });
    expect(s.rows.flatMap((r) => r.evidence).every((b) => b.dripper === 'Graycano' && b.filter === 'Sibarist Fast')).toBe(true);
  });
  it('V60 + Cafec Abaca pools CT62', () => {
    const ev = get(run(mixed), 'temp').evidence;
    expect(ev.map((b) => b.dripper).sort()).toEqual(['CT62', 'V60']);
  });
  it('gear with brews but none with a temp → temp is null, no other-gear evidence', () => {
    const rows = [brew({ dripper: 'Gabi Master A', tempC: null }), brew({ tempC: 96 })];
    const s = run(rows, { ...gear, dripper: 'Gabi Master A' });
    expect(get(s, 'temp')).toMatchObject({ value: null, evidence: [] });
    expect(get(s, 'temp').reason).toMatch(/on this gear/);
  });
  it('integer-notation grinder with no moves → step 1', () => {
    expect(grindStep([brew({ grind: '5' }), brew({ grind: '5' })], 'ZP6')).toBe(1);
  });
  it('no brews on the gear → general suggestion marked guess', () => {
    const t = get(run(mixed, { ...gear, dripper: 'ORB', filter: null }), 'temp');
    expect(t.confidence).toBe('guess');
    expect(t.reason).toMatch(/No brews on this gear/);
    expect(t.value).not.toBeNull();
  });
});

describe('junk grinds (focus 3)', () => {
  it('no NaN', () => {
    const s = run([brew({ grind: '' }), brew({ grind: 'fine', grindNum: null }), brew({ grind: null }), brew({ grind: '6.0' })]);
    expect(JSON.stringify(s)).not.toMatch(/NaN/);
    expect(run([brew({ grind: 'fine' })]).rows[0].value).toBeNull();
  });
});

describe('dose (focus 4)', () => {
  const dose = (gramsLeft: number | null) => get(run([brew({ dose: 17.6 })], gear, { ...target, gramsLeft }), 'dose');
  it('null grams → no grams in the reason', () => expect(dose(null).reason).not.toMatch(/\d+ ?g\b|left/));
  it('zero grams → no negative number', () => expect(dose(0).reason).not.toMatch(/-\d/));
  it('36 g left, 18 g dose → uses the bag exactly', () => {
    const d = dose(36);
    expect(d.value).toBe('18 g');
    expect(d.reason).toBe('18 g leaves 18 g, one more brew');
    expect(dose(18).reason).toBe('18 g uses the bag exactly');
    expect(dose(40).reason).toMatch(/20 g uses the bag exactly/);
  });
  it('a short bag shows what is left, never more; an empty bag keeps the dose', () => {
    expect(dose(12)).toMatchObject({ value: '12 g', reason: 'Use the rest of the bag' });
    expect(dose(12.4).value).toBe('12.4 g');
    expect(dose(0)).toMatchObject({ value: '18 g', reason: 'The bag is empty' });
  });
});

describe('weights', () => {
  it('low ratings stay as evidence; a 9 outweighs a 4 at equal age', () => {
    const lo = brew({ rating: 4, tempC: 90 }), hi = brew({ rating: 9, tempC: 96 });
    const t = get(run([lo, hi]), 'temp');
    expect(t.evidence).toEqual([hi, lo]);
    expect(t.value).toBe('96 °C');
  });
});

describe('similarCoffees', () => {
  it('excludes tier 1, caps at 6, same roaster first', () => {
    const rows = [brew({ coffeeId: 1 }), brew({ coffeeId: 90, roaster: 'Tim', coffeeName: 'T', rating: 10 }),
      ...Array.from({ length: 8 }, (_, i) => brew({ coffeeId: 10 + i, coffeeName: `C${i}`, slug: `c${i}`, rating: 5 }))];
    const out = similarCoffees(target, rows, gear, gc);
    expect(out).toHaveLength(6);
    expect(out.every((c) => c.slug !== 's1')).toBe(true);
    expect(out.every((c) => c.tier === 2)).toBe(true);
    expect(similarCoffees(target, rows.slice(0, 2), gear, gc)[0]).toMatchObject({ tier: 4, roaster: 'Tim', avgRating: 10, brews: 1, tempRange: [94, 94] });
  });
});

describe('thisCoffeeSummary (E7)', () => {
  const rows = [['1.4.5', 6], ['1.5.5', 8], ['1.6.0', 9], ['1.6.5', 8], ['1.7.5', 5]].map(([grind, rating], i) =>
    brew({ grind: grind as string, rating: rating as number, best: i === 2, notes: i === 4 ? 'too sour, try finer' : null, localTime: `2026-10-0${i + 1}T08:00` }));
  it('best brew, trend and the drop-off; notes only on request', () => {
    const s = thisCoffeeSummary(target, rows, gear, false);
    expect(s).toContain('Best brew: ZP6 1.6.0, 94 °C, rated 9');
    expect(s).toContain('Ratings dropped above 1.6.5');
    expect(s.join(' ')).not.toContain('sour');
    expect(s.length).toBeLessThanOrEqual(5);
    expect(thisCoffeeSummary(target, rows, gear, true).join(' ')).toContain('too sour, try finer');
    expect(thisCoffeeSummary(target, [], gear, true)).toEqual([]);
  });
});
