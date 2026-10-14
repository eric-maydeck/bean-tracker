import { describe, it, expect } from 'vitest';
import { localToday, localTodayDate } from './localToday';

describe('localToday / localTodayDate (America/Denver)', () => {
  it("is the local date when UTC is already the next day", () => {
    const evening = new Date('2026-10-14T03:00:00Z'); // 2026-10-13 21:00 MDT
    expect(localToday(evening)).toBe('2026-10-13');
    expect(localTodayDate(evening).toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });
});
