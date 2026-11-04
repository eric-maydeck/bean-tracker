import { describe, expect, it } from 'vitest';
import { parseRecapUrl, parseYear, recapHref, recapYears, seeMoreHref } from './recapsUrl';

const q = (s: string) => new URLSearchParams(s);

describe('recapsUrl', () => {
  it('parseYear: four digits only', () => {
    expect(parseYear('2026')).toBe(2026);
    for (const s of ['26', '2026a', '-2026', '20266', '']) expect(parseYear(s)).toBeNull();
  });
  it('recapYears: opens Jan 1 of the next year, only years with brews', () => {
    expect(recapYears([2026], '2026-12-31')).toEqual([]);
    expect(recapYears([2026], '2027-01-01')).toEqual([2026]);
    expect(recapYears([2025, 2026, 2027], '2027-06-01')).toEqual([2026, 2025]);
    expect(recapYears([2024, 2026], '2027-01-01')).toEqual([2026, 2024]);
  });
  it('parseRecapUrl: slide, preview; bad values dropped (a stale people=person is ignored)', () => {
    expect(parseRecapUrl(q('slide=Streak'))).toEqual({ slide: 'streak' });
    expect(parseRecapUrl(q('slide=cover'))).toEqual({ slide: 'cover' }); // the title slide
    expect(parseRecapUrl(q('slide=a b'))).toEqual({});
    expect(parseRecapUrl(q('slide=' + 'x'.repeat(41)))).toEqual({});
    expect(parseRecapUrl(q('people=person'))).toEqual({});
    expect(parseRecapUrl(q('preview=1'))).toEqual({ preview: true });
    expect(parseRecapUrl(q('preview=yes'))).toEqual({});
    expect(parseRecapUrl(q(''))).toEqual({});
  });
  it('seeMoreHref: tab, the year, decaf included, extras', () => {
    const u = new URL(seeMoreHref(2026, 'leaderboards', { rank: 'grams' }), 'http://x');
    expect(u.pathname).toBe('/insights');
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'leaderboards', range: '2026', caffeine: 'all', rank: 'grams' });
    expect(new URL(seeMoreHref(2026, 'overview'), 'http://x').searchParams.has('tab')).toBe(false);
  });
  it('recapHref: canonical order, defaults omitted', () => {
    expect(recapHref(2026, {})).toBe('/recaps/2026');
    expect(recapHref(2026, { preview: true, slide: 'hour' })).toBe('/recaps/2026?slide=hour&preview=1');
  });
});
