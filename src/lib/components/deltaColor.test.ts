import { describe, expect, it } from 'vitest';
import { deltaColor, deltaTone } from './deltaColor';

describe('deltaColor (fixed scale, C1)', () => {
  it('under 0.05 is plain gray, either sign', () => {
    expect(deltaColor(-0.04)).toBe('var(--div-mid)');
    expect(deltaColor(0.049)).toBe('var(--div-mid)');
    expect(deltaColor(0)).toBe('var(--div-mid)');
  });
  it('full color from 0.5; linear between; sign picks the pole', () => {
    expect(deltaTone(0.5)).toBe(1);
    expect(deltaTone(-1.2)).toBe(1);
    expect(deltaTone(0.275)).toBeCloseTo(0.5);
    expect(deltaColor(-0.15)).toBe('color-mix(in oklab, var(--div-low) 22%, var(--div-mid))'); // a light tint
    expect(deltaColor(0.6)).toBe('color-mix(in oklab, var(--div-high) 100%, var(--div-mid))');
  });
  it('null (no data) is transparent', () => expect(deltaColor(null)).toBe('transparent'));
});
