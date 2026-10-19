import { describe, it, expect } from 'vitest';
import { inkOf, spotAxis } from './spotAxis';

describe('spotAxis', () => {
  it('no band past the edge: no headroom, nothing clipped', () => {
    const a = spotAxis([0.2, -0.1], [0.2, -0.1]);
    expect(a).toMatchObject({ hi: 0.2, lo: -0.1, clip: [false, false], sh: [0, 0] });
  });
  it('a thin band past the top: its shoulder at the solid edge, the point beyond it', () => {
    const a = spotAxis([0.04, -0.1, 0.5], [0.04, -0.1]); // 61–90 d tallest solid, 91+ d thin and higher
    expect(a.clip).toEqual([false, false, true]);
    expect(a.shown[2]).toBeGreaterThan(a.shown[0]); // the arrow's tip is above the tallest solid bar
    expect(a.hi).toBeCloseTo(0.04 + 0.2 * 0.14);
    expect(a.sh[2]).toBeCloseTo(((0.2 * 0.14) / a.hi) * 100); // the shoulder sits at 0.04
  });
  it('all solid bands below zero: a thin band above it is still an arrow with height', () => {
    const a = spotAxis([-0.1, -0.2, 0.3], [-0.1, -0.2]);
    expect(a.hi).toBeGreaterThan(0);
    expect(a.clip[2]).toBe(true);
    expect(a.sh[2]).toBeCloseTo(100); // shoulder at the zero line
  });
  it('a thin band past the bottom clips downward', () => {
    const a = spotAxis([0.2, -0.9], [0.2]);
    expect(a.lo).toBeLessThan(0);
    expect(a.clip).toEqual([false, true]);
  });
});

describe('inkOf', () => {
  it('by the shown sign', () => expect([inkOf('+0.3'), inkOf('−0.1'), inkOf('0.0')]).toEqual(['ink-better', 'ink-worse', 'zero']));
});
