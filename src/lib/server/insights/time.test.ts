import { describe, it, expect, afterEach } from 'vitest';
import { setBrewingZone } from '$lib/localDate';
import {
  bcLocalTime, localToday, addMonths, daysBetween, periodBounds, previousPeriod, inPeriod, yearsSince,
  trackedDays, comparePeriod, compareFits, trackedBounds, weekday, autoBy, BY_FITS, byFits
} from './time';

describe('bcLocalTime in another brewing zone', () => {
  afterEach(() => setBrewingZone('America/Denver'));
  it('reads local walls in UTC', () => {
    setBrewingZone('UTC');
    expect(bcLocalTime('2026-11-01T23:30:00Z')).toBe('2026-11-02T06:30'); // MST
    expect(bcLocalTime('2026-03-08T01:30:00Z')).toBe('2026-03-08T08:30'); // the night DST starts
  });
});

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

describe('trackedDays (from max(start, first brew) to min(end, today))', () => {
  const p = { start: '2026-09-01', end: '2026-09-30' };
  it('a fully tracked past window is its length', () => expect(trackedDays(p, '2026-01-01', T)).toBe(30));
  it('starts at the first brew', () => expect(trackedDays(p, '2026-09-21', T)).toBe(10));
  it('stops at today', () => expect(trackedDays(p, '2026-01-01', '2026-09-10')).toBe(10));
  it('all time counts from the first brew', () => expect(trackedDays({ start: null, end: T }, '2026-10-01', T)).toBe(9));
  it('0 before tracking began or without brews', () => {
    expect(trackedDays(p, '2026-10-01', T)).toBe(0);
    expect(trackedDays({ start: null, end: T }, null, T)).toBe(0);
  });
});

describe('comparePeriod', () => {
  const T2 = '2026-10-10'; // the spec's example: Last week = Oct 4–10
  const wk = periodBounds('1w', T2);
  const DS = '2020-01-01';
  it('a number is n same-length periods back; 0 is off', () => {
    expect(comparePeriod('1w', wk, 2, DS, T2)).toEqual(previousPeriod('1w', wk, 2));
    expect(comparePeriod('1w', wk, 0, DS, T2)).toBeNull();
    expect(comparePeriod('all', periodBounds('all', T2), 1, DS, T2)).toBeNull();
  });
  it.each([
    ['1m', '2026-09-04'],
    ['3m', '2026-07-04'],
    ['6m', '2026-04-04'],
    ['12m', '2025-10-04'],
    ['3y', '2023-10-04'],
    ['before', DS]
  ])('%s ends the day before the period', (c, start) =>
    expect(comparePeriod('1w', wk, c, DS, T2)).toEqual({ start, end: '2026-10-03' }));
  it('clamps at month ends: 3 months before a week starting Jun 1', () =>
    expect(comparePeriod('1w', periodBounds('1w', '2026-06-07'), '3m', DS, '2026-06-07'))
      .toEqual({ start: '2026-03-01', end: '2026-05-31' }));
  it('YTD and calendar years: All before', () => {
    expect(comparePeriod('ytd', periodBounds('ytd', T2), 'before', '2024-03-01', T2))
      .toEqual({ start: '2024-03-01', end: '2025-12-31' });
    expect(comparePeriod('2025', periodBounds('2025', T2), 'before', '2024-03-01', T2))
      .toEqual({ start: '2024-03-01', end: '2024-12-31' });
  });
  it('a longer window that starts before the first brew is not usable', () => {
    expect(comparePeriod('1w', wk, '3m', '2026-07-05', T2)).toBeNull();
    expect(comparePeriod('1w', wk, '3m', '2026-07-04', T2)).toEqual({ start: '2026-07-04', end: '2026-10-03' });
  });
  it('All before needs a tracked day before the period', () => {
    expect(comparePeriod('1w', wk, 'before', '2026-10-03', T2)).toEqual({ start: '2026-10-03', end: '2026-10-03' });
    expect(comparePeriod('1w', wk, 'before', '2026-10-04', T2)).toBeNull();
    expect(comparePeriod('1w', wk, 'before', null, T2)).toBeNull();
    expect(comparePeriod('all', periodBounds('all', T2), 'before', DS, T2)).toBeNull();
  });
  it('custom: start ≤ end ≤ today, on any range, with or without brews', () => {
    expect(comparePeriod('all', periodBounds('all', T2), '2026-09-01..2026-09-15', null, T2))
      .toEqual({ start: '2026-09-01', end: '2026-09-15' });
    expect(comparePeriod('1w', wk, '2026-10-10..2026-10-10', DS, T2)).toEqual({ start: '2026-10-10', end: '2026-10-10' });
    expect(comparePeriod('1w', wk, '2019-01-01..2019-01-31', DS, T2)).toEqual({ start: '2019-01-01', end: '2019-01-31' });
  });
  it.each([
    '2026-09-15..2026-09-01', // mis-ordered
    '2026-10-01..2026-10-11', // ends after today
    '2026-02-30..2026-03-01', // not a date
    '2026-9-1..2026-9-15',
    'soon',
    '1w', // not a longer length
    'toString'
  ])('rejects %s', (bad) => expect(comparePeriod('1w', wk, bad, DS, T2)).toBeNull());
});

describe('compareFits', () => {
  const fits = compareFits('2026-07-04', '2026-10-10');
  it('checks the window for the range as of today', () => {
    expect(fits('1w', '3m')).toBe(true);
    expect(fits('1w', '6m')).toBe(false);
    expect(fits('1w', '2026-09-01..2026-09-02')).toBe(true);
    expect(fits('1w', '2026-09-01..2026-12-01')).toBe(false);
  });
});

describe('consumption granularity', () => {
  it('weekday: Monday is 0', () => {
    expect(weekday('2026-10-12')).toBe(0); // a Monday
    expect(weekday('2026-10-11')).toBe(6); // a Sunday
  });
  it('autoBy at its boundaries', () => {
    expect([31, 32, 186, 187].map(autoBy)).toEqual(['day', 'week', 'week', 'month']);
  });
  it('BY_FITS at its boundaries', () => {
    expect([366, 367].map(BY_FITS.day)).toEqual([true, false]);
    expect([13, 14].map(BY_FITS.week)).toEqual([false, true]);
    expect([59, 60].map(BY_FITS.month)).toEqual([false, true]);
  });
  it('trackedBounds clips to the first brew and today', () => {
    expect(trackedBounds({ start: '2026-01-01', end: '2026-12-31' }, '2026-02-09', '2026-10-11'))
      .toEqual({ start: '2026-02-09', end: '2026-10-11' });
    expect(trackedBounds({ start: null, end: '2026-10-11' }, null, '2026-10-11')).toBeNull();
    expect(trackedBounds({ start: '2025-01-01', end: '2025-12-31' }, '2026-02-09', '2026-10-11')).toBeNull();
  });
  it('no data at all: nothing tracked, even for a bounded period', () => {
    expect(trackedBounds({ start: '2026-09-01', end: '2026-10-11' }, null, '2026-10-11')).toBeNull();
    expect(trackedDays({ start: '2026-09-01', end: '2026-10-11' }, null, '2026-10-11')).toBe(0);
    const f = byFits(null, '2026-10-11');
    expect(['1w', '1m', '12m', 'all'].map((r) => f(r, 'day'))).toEqual([true, true, true, true]);
    expect(f('1m', 'week')).toBe(false);
    expect(f('all', 'month')).toBe(false);
  });
  it('byFits uses the tracked span', () => {
    const f = byFits('2026-02-09', '2026-10-11'); // all = 245 tracked days
    expect(f('all', 'day')).toBe(true);
    expect(f('1w', 'week')).toBe(false);
    expect(f('1m', 'month')).toBe(false);
    expect(byFits('2024-01-01', '2026-10-11')('all', 'day')).toBe(false);
  });
});

describe('custom Period', () => {
  const T = '2026-10-10';
  const R = '2026-03-01..2026-05-31';
  it('is inclusive; a later end clamps to today', () => {
    expect(periodBounds(R, T)).toEqual({ start: '2026-03-01', end: '2026-05-31' });
    expect(periodBounds('2026-10-01..2027-01-01', T)).toEqual({ start: '2026-10-01', end: T });
    expect(periodBounds('2026-10-10..2026-10-10', T)).toEqual({ start: T, end: T });
  });
  it('trackedDays counts from the first brew; entirely before it is empty', () => {
    expect(trackedDays(periodBounds(R, T), '2026-04-01', T)).toBe(61);
    expect(trackedDays(periodBounds(R, T), '2026-06-01', T)).toBe(0);
    expect(trackedDays(periodBounds('2026-10-10..2026-10-10', T), '2026-01-01', T)).toBe(1);
  });
  it('n periods back are same-length windows, back to back', () => {
    const p = periodBounds(R, T); // 92 days
    expect(previousPeriod(R, p)).toEqual({ start: '2025-11-29', end: '2026-02-28' });
    expect(previousPeriod(R, p, 2)).toEqual({ start: '2025-08-29', end: '2025-11-28' });
    expect(previousPeriod('2026-10-10..2026-10-10', periodBounds('2026-10-10..2026-10-10', T))).toEqual({ start: '2026-10-09', end: '2026-10-09' });
  });
  it('drives byFits like any period', () => {
    const f = byFits('2020-01-01', T);
    expect(f(R, 'week')).toBe(true);
    expect(f('2026-10-10..2026-10-10', 'week')).toBe(false);
    expect(f('2026-10-10..2026-10-10', 'day')).toBe(true);
  });
});
