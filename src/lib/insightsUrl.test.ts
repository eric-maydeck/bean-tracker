import { describe, it, expect } from 'vitest';
import { parseInsightsUrl, insightsParams, withDefaults, DEFAULTS, compareOptions } from './insightsUrl';

const YEARS = [2026];
const parse = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS);

describe('parseInsightsUrl', () => {
  it('nothing explicit by default', () => expect(parse('')).toEqual({}));
  it('reads every param', () =>
    expect(parse('range=12m&compare=1&ratings=all&avg=raw')).toEqual({
      range: '12m',
      compare: 1,
      ratings: 'all',
      avg: 'raw'
    }));
  it('is case-insensitive', () =>
    expect(parse('range=YTD&ratings=All&avg=RAW')).toEqual({
      range: 'ytd',
      ratings: 'all',
      avg: 'raw'
    }));
  it('reads an offered calendar year', () => expect(parse('range=2026').range).toBe('2026'));
  it('ignores a year outside the offered ones', () =>
    expect(parse('range=2019').range).toBeUndefined());
  it('ignores bad values', () =>
    expect(parse('range=5y&compare=yes&ratings=none&avg=median')).toEqual({
      range: undefined,
      compare: undefined,
      ratings: undefined,
      avg: undefined
    }));
  it('compare=0 is an explicit off', () => expect(parse('compare=0').compare).toBe(0));
  it('compare=N reads N periods back within the range limit', () => {
    expect(parse('compare=2').compare).toBe(2); // 12m: up to 2
    expect(parse('compare=3').compare).toBeUndefined();
    expect(parse('range=1w&compare=4').compare).toBe(4);
    expect(parse('range=1w&compare=5').compare).toBeUndefined();
    expect(parse('range=1m&compare=6').compare).toBe(6);
    expect(parse('range=3y&compare=2').compare).toBeUndefined();
  });
  it('compare is ignored when not a whole number', () => {
    expect(parse('compare=-1').compare).toBeUndefined();
    expect(parse('compare=1.5').compare).toBeUndefined();
    expect(parse('compare=').compare).toBeUndefined();
  });
  it('all time has nothing to compare to (compare=0 still reads)', () => {
    expect(parse('range=all&compare=1').compare).toBeUndefined();
    expect(parse('range=all&compare=0').compare).toBe(0);
  });
  it('ytd and calendar years reach back to the first brew year', () => {
    const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), [2024, 2025, 2026]);
    expect(p('range=ytd&compare=2').compare).toBe(2);
    expect(p('range=ytd&compare=3').compare).toBeUndefined();
    expect(p('range=2025&compare=1').compare).toBe(1);
    expect(p('range=2025&compare=2').compare).toBeUndefined();
    expect(p('range=2024&compare=1').compare).toBeUndefined();
  });
});

describe('compare skips years without brews', () => {
  const Y = [2023, 2024, 2025, 2026];
  const BREW_YEARS = [2023, 2025, 2026]; // no brews in 2024
  it('lists only years with brews; n is still years back', () => {
    expect(compareOptions('ytd', Y, BREW_YEARS)).toEqual([{ n: 1, label: '2025 YTD' }, { n: 3, label: '2023 YTD' }]);
    expect(compareOptions('2026', Y, BREW_YEARS)).toEqual([{ n: 1, label: '2025' }, { n: 3, label: '2023' }]);
  });
  it('the parser drops a gap year', () => {
    const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), Y, BREW_YEARS).compare;
    expect(p('range=ytd&compare=2')).toBeUndefined();
    expect(p('range=ytd&compare=3')).toBe(3);
    expect(p('range=2026&compare=2')).toBeUndefined();
  });
});

describe('compareOptions', () => {
  const Y = [2024, 2025, 2026];
  const labels = (r: string) => compareOptions(r, Y).map((o) => `${o.n}:${o.label}`);
  it('weeks', () => expect(labels('1w')).toEqual(['1:Previous week', '2:2 weeks ago', '3:3 weeks ago', '4:4 weeks ago']));
  it('months', () => expect(labels('1m')).toHaveLength(6));
  it('3 months', () =>
    expect(labels('3m')).toEqual(['1:Previous 3 months', '2:6–9 months ago', '3:9–12 months ago', '4:12–15 months ago']));
  it('6 months', () => expect(labels('6m')).toEqual(['1:Previous 6 months', '2:12–18 months ago']));
  it('12 months', () => expect(labels('12m')).toEqual(['1:Previous 12 months', '2:2 years ago']));
  it('3 years', () => expect(labels('3y')).toEqual(['1:Previous 3 years']));
  it('ytd', () => expect(labels('ytd')).toEqual(['1:2025 YTD', '2:2024 YTD']));
  it('calendar year', () => expect(labels('2026')).toEqual(['1:2025', '2:2024']));
  it('all', () => expect(labels('all')).toEqual([]));
});

describe('insightsParams', () => {
  it('writes nothing for nothing explicit', () =>
    expect(insightsParams({}).toString()).toBe(''));
  it('round-trips in a fixed order', () => {
    const q = 'range=1w&compare=1&ratings=all&avg=raw';
    expect(insightsParams(parse('avg=raw&ratings=all&compare=1&range=1w')).toString()).toBe(q);
  });
  it('writes compare=0 when explicitly off', () =>
    expect(insightsParams({ compare: 0 }).toString()).toBe('compare=0'));
  it('writes compare=N', () => expect(insightsParams({ compare: 2 }).toString()).toBe('compare=2'));
});

describe('withDefaults', () => {
  it('fills the defaults', () =>
    expect(withDefaults({})).toEqual({
      range: '12m',
      compare: 0,
      ratings: 'settled',
      avg: 'adjusted'
    }));
  it('keeps explicit values', () => expect(withDefaults({ range: 'all' }).range).toBe('all'));
  it('DEFAULTS match the spec', () =>
    expect(DEFAULTS).toEqual({ range: '12m', compare: 0, ratings: 'settled', avg: 'adjusted' }));
});
