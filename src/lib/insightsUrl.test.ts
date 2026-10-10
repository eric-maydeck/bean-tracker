import { describe, it, expect } from 'vitest';
import { parseInsightsUrl, insightsParams, withDefaults, DEFAULTS } from './insightsUrl';

const YEARS = [2026];
const parse = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS);

describe('parseInsightsUrl', () => {
  it('nothing explicit by default', () => expect(parse('')).toEqual({}));
  it('reads every param', () =>
    expect(parse('range=12m&compare=1&ratings=all&avg=raw')).toEqual({
      range: '12m',
      compare: true,
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
  it('compare=0 is an explicit off', () => expect(parse('compare=0').compare).toBe(false));
});

describe('insightsParams', () => {
  it('writes nothing for nothing explicit', () =>
    expect(insightsParams({}).toString()).toBe(''));
  it('round-trips in a fixed order', () => {
    const q = 'range=1w&compare=1&ratings=all&avg=raw';
    expect(insightsParams(parse('avg=raw&ratings=all&compare=1&range=1w')).toString()).toBe(q);
  });
  it('writes compare=0 when explicitly off', () =>
    expect(insightsParams({ compare: false }).toString()).toBe('compare=0'));
});

describe('withDefaults', () => {
  it('fills the defaults', () =>
    expect(withDefaults({})).toEqual({
      range: '12m',
      compare: false,
      ratings: 'settled',
      avg: 'adjusted'
    }));
  it('keeps explicit values', () => expect(withDefaults({ range: 'all' }).range).toBe('all'));
  it('DEFAULTS match the spec', () =>
    expect(DEFAULTS).toEqual({ range: '12m', compare: false, ratings: 'settled', avg: 'adjusted' }));
});
