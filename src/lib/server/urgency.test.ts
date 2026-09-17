import { describe, it, expect } from 'vitest';
import {
  computeCostPerGram,
  computeDaysSinceRoast,
  computeDrinkAfter,
  computeDrinkBefore,
  computeUrgencyRating,
  type UrgencyInput
} from './urgency';

function input(overrides: Partial<UrgencyInput>): UrgencyInput {
  return {
    roast_date: '2026-01-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 10,
    drank: 0,
    ...overrides
  };
}

describe('computeCostPerGram', () => {
  it('divides cost by amount', () => {
    expect(computeCostPerGram(20, 200)).toBeCloseTo(0.1, 5);
  });

  it('returns null when amount is missing or zero', () => {
    expect(computeCostPerGram(20, null)).toBeNull();
    expect(computeCostPerGram(20, 0)).toBeNull();
  });
});

describe('computeDaysSinceRoast', () => {
  it('returns null when roast date is missing', () => {
    expect(computeDaysSinceRoast(input({ roast_date: null }), new Date('2026-01-10')))
      .toBeNull();
  });

  it('counts from roast date to today when never frozen', () => {
    expect(computeDaysSinceRoast(input({}), new Date('2026-01-10T00:00:00Z')))
      .toBe(9);
  });

  it('freezes the count at the freeze date while still frozen', () => {
    const result = computeDaysSinceRoast(
      input({ frozen_start_date: '2026-01-05', frozen_end_date: null }),
      new Date('2026-02-01T00:00:00Z')
    );
    expect(result).toBe(4);
  });

  it('subtracts the frozen period once thawed', () => {
    const result = computeDaysSinceRoast(
      input({ frozen_start_date: '2026-01-05', frozen_end_date: '2026-01-15' }),
      new Date('2026-02-01T00:00:00Z')
    );
    expect(result).toBe(21);
  });
});

describe('computeDrinkAfter / computeDrinkBefore', () => {
  it('return null when the required inputs are missing', () => {
    expect(computeDrinkAfter(input({ roast_date: null }), new Date('2026-01-10'))).toBeNull();
    expect(computeDrinkAfter(input({ rest_days_low: null }), new Date('2026-01-10'))).toBeNull();
    expect(computeDrinkBefore(input({ rest_days_high: null }), new Date('2026-01-10'))).toBeNull();
  });

  it('use roast date plus rest days when never frozen', () => {
    expect(computeDrinkAfter(input({}), new Date('2026-01-05'))).toBe('2026-01-11');
    expect(computeDrinkBefore(input({}), new Date('2026-01-05'))).toBe('2026-01-18');
  });

  it('push out from today while still frozen', () => {
    const frozen = input({ frozen_start_date: '2026-01-05', frozen_end_date: null });
    expect(computeDrinkAfter(frozen, new Date('2026-02-01T00:00:00Z'))).toBe('2026-02-07');
    expect(computeDrinkBefore(frozen, new Date('2026-02-01T00:00:00Z'))).toBe('2026-02-14');
  });

  it('shift by the frozen duration once thawed', () => {
    const thawed = input({ frozen_start_date: '2026-01-05', frozen_end_date: '2026-01-15' });
    expect(computeDrinkAfter(thawed, new Date('2026-02-01T00:00:00Z'))).toBe('2026-01-21');
    expect(computeDrinkBefore(thawed, new Date('2026-02-01T00:00:00Z'))).toBe('2026-01-28');
  });

  it('drink_before unclamped when window closed before freeze (unlike drink_after)', () => {
    // orig_drink_before = 2026-01-01 + 0 + 7 = 2026-01-08 (deadline passed before freeze)
    // frozenDays = 2 (2026-01-10 to 2026-01-12)
    // result = 2026-01-08 + 2 = 2026-01-10 (NOT clamped to frozen_end 2026-01-12)
    const thawed = input({
      roast_date: '2026-01-01',
      rest_days_high: 0,
      frozen_start_date: '2026-01-10',
      frozen_end_date: '2026-01-12'
    });
    expect(computeDrinkBefore(thawed, new Date('2026-01-15T00:00:00Z'))).toBe('2026-01-10');
  });
});

describe('computeUrgencyRating', () => {
  it('returns "Done" when drank', () => {
    expect(computeUrgencyRating(input({ drank: 1 }), new Date('2026-01-10'))).toBe('Done');
  });

  it('returns -100 when roast date or rest days are missing', () => {
    expect(computeUrgencyRating(input({ roast_date: null }), new Date('2026-01-10'))).toBe(-100);
    expect(computeUrgencyRating(input({ rest_days_low: null }), new Date('2026-01-10'))).toBe(-100);
    expect(computeUrgencyRating(input({ rest_days_high: null }), new Date('2026-01-10'))).toBe(-100);
  });

  it('is -100 the moment it is roasted (never frozen)', () => {
    expect(computeUrgencyRating(input({}), new Date('2026-01-01T00:00:00Z'))).toBe(-100);
  });

  it('is exactly 0 at the drink-after boundary', () => {
    expect(computeUrgencyRating(input({}), new Date('2026-01-11T00:00:00Z'))).toBe(0);
  });

  it('is exactly 100 at the drink-before boundary', () => {
    expect(computeUrgencyRating(input({}), new Date('2026-01-18T00:00:00Z'))).toBe(100);
  });

  it('pauses progression while still frozen, regardless of wall-clock today', () => {
    const frozen = input({ frozen_start_date: '2026-01-05', frozen_end_date: null });
    expect(computeUrgencyRating(frozen, new Date('2026-02-01T00:00:00Z'))).toBe(-60);
  });

  it('saturates at 100 for a thawed coffee well past its window', () => {
    const thawed = input({ frozen_start_date: '2026-01-05', frozen_end_date: '2026-01-15' });
    expect(computeUrgencyRating(thawed, new Date('2026-02-01T00:00:00Z'))).toBe(100);
  });

  it('applies the 130-day cap on the ramp-down side', () => {
    const longRest = input({ roast_date: '2026-01-01', rest_days_low: 200 });
    // 130 days after roast: 70 days short of the 200-day rest window
    const result = computeUrgencyRating(longRest, new Date('2026-05-11T00:00:00Z'));
    expect(result).toBeCloseTo(-53.846, 2);
  });

  it('applies the 130-day cap on the ramp-up side', () => {
    const longWindow = input({ roast_date: '2026-01-01', rest_days_low: 10, rest_days_high: 300 });
    // 70 days after the drink-after date (2026-01-11)
    const result = computeUrgencyRating(longWindow, new Date('2026-03-22T00:00:00Z'));
    expect(result).toBeCloseTo(53.846, 2);
  });
});
