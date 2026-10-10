import { describe, it, expect } from 'vitest';
import { bcLocalTime, localToday, addMonths, daysBetween, periodBounds, previousPeriod, inPeriod, yearsSince } from './time';

describe('bcLocalTime (stored Bean Conqueror times are already local)', () => {
  it('reads the wall time as-is, no shift', () => expect(bcLocalTime('2026-03-08T01:30:00.000Z')).toBe('2026-03-08T01:30'));
  it('a late-evening brew stays on its day', () => expect(bcLocalTime('2026-06-30T23:30:00.000Z')).toBe('2026-06-30T23:30'));
});

describe('localToday (America/Denver, DST-aware)', () => {
  it.each([
    ['2026-10-10T05:00:00Z', '2026-10-09'], // MDT, UTC-6: still the previous day
    ['2026-03-08T06:59:00Z', '2026-03-07'], // MST, UTC-7: 23:59 the night before spring forward
    ['2026-03-09T06:30:00Z', '2026-03-09'], // MDT: 00:30 (under MST it would be 03-08 23:30)
    ['2026-11-01T06:30:00Z', '2026-11-01'], // MDT: 00:30 on fall-back day
    ['2026-11-02T06:30:00Z', '2026-11-01'] // MST: 23:30 (under MDT it would be 11-02 00:30)
  ])('%s → %s', (instant, day) => expect(localToday(new Date(instant))).toBe(day));
});

describe('date math', () => {
  it('addMonths clamps to the month end', () => expect(addMonths('2026-05-31', -3)).toBe('2026-02-28'));
  it('daysBetween counts calendar days', () => expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30));
});

const T = '2026-10-09';
describe('periodBounds and previousPeriod', () => {
  it.each([
    ['1w', '2026-10-03', '2026-10-09', '2026-09-26', '2026-10-02'],
    ['1m', '2026-09-10', '2026-10-09', '2026-08-11', '2026-09-09'],
    ['3m', '2026-07-10', '2026-10-09', '2026-04-10', '2026-07-09'],
    ['6m', '2026-04-10', '2026-10-09', '2025-10-10', '2026-04-09'],
    ['12m', '2025-10-10', '2026-10-09', '2024-10-10', '2025-10-09'],
    ['3y', '2023-10-10', '2026-10-09', '2020-10-10', '2023-10-09'],
    ['ytd', '2026-01-01', '2026-10-09', '2025-01-01', '2025-10-09'],
    ['2025', '2025-01-01', '2025-12-31', '2024-01-01', '2024-12-31']
  ])('%s', (range, start, end, prevStart, prevEnd) => {
    const p = periodBounds(range, T);
    expect(p).toEqual({ start, end });
    expect(previousPeriod(range, p)).toEqual({ start: prevStart, end: prevEnd });
  });
  it('all has no start and no previous period', () => {
    const p = periodBounds('all', T);
    expect(p).toEqual({ start: null, end: T });
    expect(previousPeriod('all', p)).toBeNull();
  });
  it('ytd on a leap day compares to Feb 28', () =>
    expect(previousPeriod('ytd', periodBounds('ytd', '2028-02-29'))).toEqual({ start: '2027-01-01', end: '2027-02-28' }));
});

describe('previousPeriod n periods back', () => {
  it.each([
    ['1w', 2, '2026-09-19', '2026-09-25'],
    ['1w', 4, '2026-09-05', '2026-09-11'],
    ['1m', 2, '2026-07-12', '2026-08-10'],
    ['3m', 2, '2026-01-10', '2026-04-09'],
    ['12m', 2, '2023-10-10', '2024-10-09'],
    ['ytd', 2, '2024-01-01', '2024-10-09'],
    ['2025', 2, '2023-01-01', '2023-12-31']
  ])('%s n=%i', (range, n, start, end) =>
    expect(previousPeriod(range, periodBounds(range, T), n)).toEqual({ start, end }));
  it('n=1 is the default', () =>
    expect(previousPeriod('3m', periodBounds('3m', T), 1)).toEqual(previousPeriod('3m', periodBounds('3m', T))));
  it('month windows stay back to back across month-end clamping', () => {
    const p = periodBounds('3m', '2026-05-31'); // 2026-03-01..05-31
    expect(previousPeriod('3m', p, 1)).toEqual({ start: '2025-11-29', end: '2026-02-28' });
    expect(previousPeriod('3m', p, 2)).toEqual({ start: '2025-08-29', end: '2025-11-28' });
  });
  it('ytd on a leap day, two years back, ends Feb 28', () =>
    expect(previousPeriod('ytd', periodBounds('ytd', '2028-02-29'), 2)).toEqual({ start: '2026-01-01', end: '2026-02-28' }));
  it('all has none at any depth', () => expect(previousPeriod('all', periodBounds('all', T), 2)).toBeNull());
});

describe('inPeriod', () => {
  const p = { start: '2026-09-01', end: '2026-09-30' };
  it('is inclusive at both ends', () => {
    expect(inPeriod('2026-09-01', p)).toBe(true);
    expect(inPeriod('2026-09-30', p)).toBe(true);
    expect(inPeriod('2026-08-31', p)).toBe(false);
    expect(inPeriod('2026-10-01', p)).toBe(false);
  });
  it('a null start is open-ended', () => expect(inPeriod('2001-01-01', { start: null, end: T })).toBe(true));
});

describe('yearsSince', () => {
  it('first brew year through this year', () => expect(yearsSince('2025-11-03', T)).toEqual([2025, 2026]));
  it('just this year with no brews', () => expect(yearsSince(null, T)).toEqual([2026]));
});
