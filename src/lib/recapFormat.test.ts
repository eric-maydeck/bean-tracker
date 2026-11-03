import { describe, it, expect } from 'vitest';
import { fmtInt, fmtKg, fmtLitres, usd } from './recapFormat';

describe('recapFormat', () => {
  it('ints with commas, kg with a forced decimal, litres, usd', () => {
    expect(fmtInt(1489)).toBe('1,489');
    expect(fmtKg(4000)).toBe('4.0kg');
    expect(fmtKg(26645)).toBe('26.6kg');
    expect(fmtLitres(437046)).toBe('437L');
    expect(fmtLitres(1_234_000)).toBe('1,234L');
    expect(usd(16)).toBe('$16.00');
  });
});
