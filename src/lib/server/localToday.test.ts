import { describe, it, expect } from 'vitest';
import { localToday, localTodayDate } from './localToday';

describe('localToday / localTodayDate (America/Denver)', () => {
  it("is the local date when UTC is already the next day", () => {
    const evening = new Date('2026-10-14T03:00:00Z'); // 2026-10-13 21:00 MDT
    expect(localToday(evening)).toBe('2026-10-13');
    expect(localTodayDate(evening).toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });

  it.each([
    ['2026-12-15T06:30:00Z', '2026-12-14'], // MST: 23:30 on the 14th
    ['2026-10-14T06:00:00Z', '2026-10-14'] // MDT: exactly midnight
  ])('%s → %s', (instant, day) => expect(localToday(new Date(instant))).toBe(day));
});
