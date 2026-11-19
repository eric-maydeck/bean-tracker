import { describe, expect, it } from 'vitest';
import { sliceAt, wheelSlices } from './wheel';
import type { PickCoffee } from './types';

const coffee = (id: number): PickCoffee => ({ id, slug: `c${id}`, name: `C${id}`, roaster: 'r', image: null, fill: null, category: 'open', decaf: false, urgency: null });
const pool = (n: number) => Array.from({ length: n }, (_, i) => coffee(i));
const TAU = Math.PI * 2;

describe('wheelSlices', () => {
  it('1 coffee + 1 crit: crit is 0.3 of a coffee', () => {
    const s = wheelSlices(pool(1), false, true);
    expect(s[0].a1 - s[0].a0).toBeCloseTo(TAU / 1.3);
    expect(s[1].kind).toBe('fail');
    expect(s[1].a1 - s[1].a0).toBeCloseTo((0.3 * TAU) / 1.3);
  });
  it('4 coffees + 2 crits: success mid, fail last, covers the circle', () => {
    const s = wheelSlices(pool(4), true, true);
    expect(s.map((x) => x.kind)).toEqual(['coffee', 'coffee', 'success', 'coffee', 'coffee', 'fail']);
    expect(s[0].a0).toBe(0);
    expect(s[5].a1).toBeCloseTo(TAU);
    expect(s.reduce((t, x) => t + x.a1 - x.a0, 0)).toBeCloseTo(TAU);
  });
  it('no coffees: crits share the wheel by weight', () => {
    const s = wheelSlices([], true, true);
    expect(s.map((x) => x.kind)).toEqual(['success', 'fail']);
    expect(s[0].a1 - s[0].a0).toBeCloseTo(TAU / 2);
  });
  it('empty without crits', () => expect(wheelSlices([], false, false)).toEqual([]));
});

describe('sliceAt', () => {
  const s = wheelSlices(pool(2), false, false);
  it('boundaries belong to the next slice', () => {
    expect(sliceAt(s, 0).coffeeId).toBe(0);
    expect(sliceAt(s, Math.PI).coffeeId).toBe(1);
    expect(sliceAt(s, Math.PI - 0.001).coffeeId).toBe(0);
  });
  it('wraps at 2pi and negatives', () => {
    expect(sliceAt(s, TAU).coffeeId).toBe(0);
    expect(sliceAt(s, -0.001).coffeeId).toBe(1);
  });
});
