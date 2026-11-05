import { describe, it, expect } from 'vitest';
import { DATE_FORMATS, asDateFormat, formatInstant, formatStamp, localDate, localDateTime, localStamp, wallToInstant } from './localDate';

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

describe('wallToInstant and formatInstant', () => {
  it.each([
    ['2026-10-22T20:05:23.000Z', '2026-10-23T02:05:23.000Z'], // MDT, fake trailing Z ignored
    ['2026-12-14T23:30', '2026-12-15T06:30:00.000Z'], // MST, minutes only
    ['2026-03-08T12:00:00', '2026-03-08T18:00:00.000Z'] // just after spring-forward
  ])('%s → %s', (w, iso) => expect(wallToInstant(w)).toBe(iso));
  it('round-trips through localStamp', () => expect(localStamp(wallToInstant('2026-06-01T07:08:09'))).toBe('2026-06-01T07:08:09'));
  it('formats an instant in a zone (default local)', () => {
    expect(formatInstant('2026-10-23T02:05:23.000Z')).toBe('2026-10-22 8:05:23 PM');
    expect(formatInstant('2026-10-23T02:05:23.000Z', 'UTC')).toBe('2026-10-23 2:05:23 AM');
    expect(formatInstant('2026-10-23T02:05:23.000Z', 'Asia/Tokyo')).toBe('2026-10-23 11:05:23 AM');
  });
});

describe('localDateTime', () => {
  it('agrees with localDate on the date part across midnight UTC', () => {
    for (const iso of ['2026-10-28T05:30:00.000Z', '2026-10-28T06:30:00.000Z', '2026-03-08T09:59:00.000Z', '2026-11-01T07:30:00.000Z']) {
      expect(localDateTime(iso).slice(0, 10)).toBe(localDate(iso));
      expect(localDateTime(iso)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
    }
    expect(localDateTime('2026-10-28T06:30:00.000Z')).toBe('2026-10-28T00:30');
  });
});

describe('date formats', () => {
  const table = {
    iso12: ['2026-10-22 8:05:23 PM', '2026-10-22 8:05 PM'],
    iso24: ['2026-10-22 20:05:23', '2026-10-22 20:05'],
    us: ['10/22/2026, 8:05:23 PM', '10/22/2026, 8:05 PM'],
    eu: ['22/10/2026 20:05:23', '22/10/2026 20:05']
  } as const;
  it.each(DATE_FORMATS)('%s, with and without seconds', (f) => {
    expect(formatStamp('2026-10-22T20:05:23', f)).toBe(table[f][0]);
    expect(formatStamp('2026-10-22T20:05:23', f, false)).toBe(table[f][1]);
  });
  it('iso12 is the default; morning and midnight read right', () => {
    expect(formatStamp('2026-10-22T20:05:23')).toBe(table.iso12[0]);
    expect(formatStamp('2026-03-04T00:09:01', 'us')).toBe('03/04/2026, 12:09:01 AM');
    expect(formatStamp('2026-03-04T07:09:01', 'iso24', false)).toBe('2026-03-04 07:09');
  });
  it('formats an instant in a zone (the UTC suffix is Stamp\'s)', () => {
    expect(formatInstant('2026-10-23T02:05:23.000Z', 'UTC', 'eu')).toBe('23/10/2026 02:05:23');
    expect(formatInstant('2026-10-23T02:05:23.000Z', 'Asia/Tokyo', 'us', false)).toBe('10/23/2026, 11:05 AM');
  });
  it('junk is the default', () => {
    expect(asDateFormat('nope')).toBe('iso12');
    expect(asDateFormat(undefined)).toBe('iso12');
    expect(asDateFormat('eu')).toBe('eu');
  });
});
