import { describe, expect, it } from 'vitest';
import { deltaColor, deltaInk, deltaTone } from './deltaColor';

describe('deltaColor (fixed scale, T3)', () => {
  it('under 0.05 is plain gray, either sign', () => {
    expect(deltaColor(-0.04)).toBe('var(--div-mid)');
    expect(deltaColor(0.049)).toBe('var(--div-mid)');
    expect(deltaColor(0)).toBe('var(--div-mid)');
  });
  it('from 0.05 a visible floor, full color from 0.4; linear between; sign picks the pole', () => {
    expect(deltaTone(0.05)).toBeCloseTo(0.33);
    expect(deltaTone(-0.05)).toBeCloseTo(0.33);
    expect(deltaTone(0.4)).toBe(1);
    expect(deltaTone(-1.2)).toBe(1);
    expect(deltaTone(0.225)).toBeCloseTo(0.665);
    expect(deltaColor(-0.08)).toBe('color-mix(in oklab, var(--div-low) 39%, var(--div-mid))'); // a small delta still reads red
    expect(deltaColor(0.6)).toBe('color-mix(in oklab, var(--div-high) 100%, var(--div-mid))');
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
