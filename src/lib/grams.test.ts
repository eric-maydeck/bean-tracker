import { describe, it, expect } from 'vitest';
import { formatGrams, formatBag } from './grams';

describe('formatGrams', () => {
  it.each([
    [0, '0g'],
    [999, '999g'],
    [999.4, '999g'],
    [999.6, '1kg'],
    [1000, '1kg'],
    [1234, '1.2kg'],
    [1500, '1.5kg'],
    [2000, '2kg']
  ])('%s → %s', (g, out) => expect(formatGrams(g)).toBe(out));
});

describe('formatBag', () => {
  it.each([
    [100, null, '100g'],
    [100, 80, '100g (80g left)'],
    [1500, 1200, '1.5kg (1.2kg left)'],
    [2000, 2000, '2kg (2kg left)'],
    [999, 999, '999g (999g left)'],
    [100, 0, '100g (0g left)']
  ])('%s, %s → %s', (amount, left, out) => expect(formatBag(amount, left)).toBe(out));
});
