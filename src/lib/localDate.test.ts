import { describe, it, expect } from 'vitest';
import { localDate } from './localDate';

describe('localDate (a stored date as a local calendar date)', () => {
  it.each([
    ['2026-10-05T05:07:00Z', '2026-10-04'], // 23:07 MDT on the 4th
    ['2026-10-05T18:00:00.000Z', '2026-10-05'],
    ['2026-12-15T06:30:00.000Z', '2026-12-14'], // MST
    ['2026-10-05', '2026-10-05'], // already a calendar date (imported): unchanged
    ['not a date', 'not a date']
  ])('%s → %s', (value, day) => expect(localDate(value)).toBe(day));
});
