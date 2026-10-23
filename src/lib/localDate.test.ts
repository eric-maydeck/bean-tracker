import { describe, it, expect } from 'vitest';
import { formatStamp, localDate, localStamp } from './localDate';

describe('localDate (a stored date as a local calendar date)', () => {
  it.each([
    ['2026-10-05T05:07:00Z', '2026-10-04'], // 23:07 MDT on the 4th
    ['2026-10-05T18:00:00.000Z', '2026-10-05'],
    ['2026-12-15T06:30:00.000Z', '2026-12-14'], // MST
    ['2026-10-05', '2026-10-05'], // already a calendar date (imported): unchanged
    ['not a date', 'not a date']
  ])('%s → %s', (value, day) => expect(localDate(value)).toBe(day));
});

describe('localStamp and formatStamp', () => {
  it('converts a UTC instant to local wall time', () => {
    expect(localStamp('2026-10-23T02:05:23.000Z')).toBe('2026-10-22T20:05:23'); // MDT
    expect(localStamp('2026-12-15T06:30:00.000Z')).toBe('2026-12-14T23:30:00'); // MST
  });
  it.each([
    ['2026-10-22T20:05:23', '2026-10-22 8:05:23 PM'],
    ['2026-10-22T00:09:01', '2026-10-22 12:09:01 AM'],
    ['2026-10-22T12:00', '2026-10-22 12:00:00 PM'],
    ['2026-10-22T09:30:00.000Z', '2026-10-22 9:30:00 AM']
  ])('%s → %s', (w, out) => expect(formatStamp(w)).toBe(out));
});
