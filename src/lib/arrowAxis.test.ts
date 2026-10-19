import { describe, it, expect } from 'vitest';
import { inkOf, spotAxis, symAxis } from './arrowAxis';

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

describe('symAxis', () => {
  it('nothing past the axis: the longest bar fills its half', () => {
    expect(symAxis([0.2, -0.1], [0.2, -0.1])).toEqual({ w: [50, 25], clip: [false, false], sh: [0, 0] });
  });
  it('a muted row past the axis: the solid rows shrink to leave the point room, the shoulder at the old edge', () => {
    const a = symAxis([0.2, -0.1, 0.9], [0.2, -0.1]);
    expect(a.clip).toEqual([false, false, true]);
    expect(a.w[2]).toBe(50);
    expect(a.w[0]).toBeCloseTo((0.2 / 0.24) * 50); // the solid max sits at the shoulder, short of the tip
    expect(a.sh[2]).toBeCloseTo((0.04 / 0.24) * 100);
  });
  it('the floor keeps tiny deltas visible', () => expect(symAxis([0.01], [0.01]).w[0]).toBeCloseTo(10));
});

describe('inkOf', () => {
  it('by the shown sign', () => expect([inkOf('+0.3'), inkOf('−0.1'), inkOf('0.0')]).toEqual(['ink-better', 'ink-worse', 'zero']));
});
