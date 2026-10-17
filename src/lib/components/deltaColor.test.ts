import { describe, expect, it } from 'vitest';
import { deltaColor, deltaInk, deltaRamp, labDelta } from './deltaColor';

describe('deltaColor (fixed scale, T3)', () => {
  it('under 0.05 is plain gray, either sign', () => {
    expect(deltaColor(-0.04)).toBe('var(--div-mid)');
    expect(deltaColor(0.049)).toBe('var(--div-mid)');
    expect(deltaColor(0)).toBe('var(--div-mid)');
  });
  it('from 0.05 the theme floor, full color from 0.4; linear between; sign picks the pole', () => {
    expect(deltaRamp(0.05)).toBe(0);
    expect(deltaRamp(-0.4)).toBe(1);
    expect(deltaRamp(-1.2)).toBe(1);
    expect(deltaRamp(0.225)).toBeCloseTo(0.5);
    expect(deltaColor(-0.05)).toBe('color-mix(in oklab, var(--div-low) calc((var(--div-floor) + (1 - var(--div-floor)) * 0) * 100%), var(--div-mid))');
    expect(deltaColor(0.6)).toContain('var(--div-high) calc((var(--div-floor) + (1 - var(--div-floor)) * 1) * 100%)');
  });
  it('null (no data) is transparent', () => expect(deltaColor(null)).toBe('transparent'));
});

describe('deltaInk (T4)', () => {
  it('green from +0.05, red from −0.05, ink between and for no data', () => {
    expect(deltaInk(0.05)).toBe('ink-better');
    expect(deltaInk(-0.05)).toBe('ink-worse');
    expect(deltaInk(0.049)).toBe('');
    expect(deltaInk(-0.01)).toBe('');
    expect(deltaInk(null)).toBe('');
  });
});

describe('labDelta (stats re-review D)', () => {
  it('1 decimal unless the bag-level SE is under 0.05', () => {
    expect(labDelta(0.234)).toBe('+0.2');
    expect(labDelta(-0.234, 0.08)).toBe('−0.2');
    expect(labDelta(0.234, 0.04)).toBe('+0.23');
    expect(labDelta(0.04, 0.2)).toBe('0.0');
  });
});
