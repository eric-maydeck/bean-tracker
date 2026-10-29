import { describe, it, expect } from 'vitest';
import { suggest, tierOf, grindStep, similarCoffees, type Gear } from './suggest';
import type { BrewRow, CoffeeDetails, GearClass } from './load';

let id = 0;
const brew = (o: Partial<BrewRow> = {}): BrewRow => ({
  id: ++id, coffeeId: 1, slug: 's1', roaster: 'Sey', coffeeName: 'Kiambu', origin: 'Kenya', processGroup: 'Washed', roastLevel: 'Light',
  localTime: '2026-10-01T08:00', restDays: 10, grinder: 'ZP6', grind: '5.5', grindNum: 5.005, dripper: 'V60', filter: 'Cafec Abaca',
  tempC: 94, dose: 15, waterG: 250, water: 'Third Wave', recipeId: 1, recipeName: 'Rec One', rating: 7, best: false, notes: null,
  grinderArchived: false, methodArchived: false, ...o
});
const target: CoffeeDetails = { id: 1, slug: 's1', roaster: 'Sey', coffeeName: 'Kiambu', roastDate: null, restDays: 10, gramsLeft: 100,
  processing: 'Washed', origin: 'Kenya', roastLevel: 'Light' };
const gc: GearClass = {
  dripper: (n) => (n === 'V60' || n === 'CT62' ? 'cone' : (n ?? '')),
  filter: (n) => (n === 'Sibarist Fast' ? n : !n ? '' : 'any')
};
const gear: Gear = { grinder: 'ZP6', dripper: 'V60', filter: 'Cafec Abaca' };
const run = (rows: BrewRow[], g: Gear = gear, t = target, doses = [15, 18, 20]) => suggest(t, rows, g, gc, doses, '2026-10-28');
const get = (s: ReturnType<typeof run>, k: string) => s.rows.find((r) => r.setting === k)!;

describe('tiers', () => {
  it('clone with other case/spacing is tier 1; roaster+origin is 2; other roaster same pg+roast is 3', () => {
    expect(tierOf(target, brew({ roaster: ' sey ', coffeeName: 'KIAMBU', coffeeId: 2 }))).toBe(1);
    expect(tierOf(target, brew({ coffeeName: 'Other' }))).toBe(2);
    expect(tierOf(target, brew({ coffeeName: 'Other', origin: 'Peru', processGroup: 'Natural' }))).toBe(4);
    expect(tierOf(target, brew({ roaster: 'Tim', coffeeName: 'X', origin: 'Peru' }))).toBe(3);
    expect(tierOf({ ...target, processing: 'Washed', roastLevel: 'Light/Med' }, brew({ roaster: 'Tim', coffeeName: 'X', roastLevel: 'Light/Medium' }))).toBe(3);
  });
  it('tier 1 beats tier 2 when both have data', () => {
    const s = run([brew({ tempC: 92, coffeeId: 2, coffeeName: 'Other' }), brew({ tempC: 95, coffeeId: 3, coffeeName: 'kiambu ' })]);
    expect(get(s, 'temp')).toMatchObject({ tier: 1, value: '95 °C' });
    expect(s.basis).toBe('this coffee, 1 brews');
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
  const series = (ratings: number[], best = -1) => ratings.map((rating, i) =>
    brew({ grind: (6.5 - i * 0.2).toFixed(1), rating, best: i === best, localTime: `2026-10-0${i + 1}T08:00` }));
  it('rising ratings as grind goes lower, best at the lowest → one step past it', () => {
    const rows = series([5, 6, 7, 8, 9], 4);
    const step = grindStep(rows, 'ZP6');
    expect(step).toBeCloseTo(0.2);
    expect(get(run(rows), 'grind').value).toBe((5.7 - step).toFixed(1));
    expect(get(run(rows), 'grind').reason).toMatch(/lower settings rated higher/);
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
    expect(s.rows.every((r) => r.value !== null && r.tier === 4)).toBe(true);
    expect(s.confidence).toBe('guess');
    expect(s.basis).toMatch(/^any coffee/);
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
    expect(d.reason).toMatch(/18 g uses the bag exactly/);
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
    expect(similarCoffees(target, rows.slice(0, 2), gear, gc)[0]).toMatchObject({ tier: 3, roaster: 'Tim', avgRating: 10, brews: 1, tempRange: [94, 94] });
  });
});
