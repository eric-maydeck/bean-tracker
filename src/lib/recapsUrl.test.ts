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
  it('parseRecapUrl: slide, people, preview; bad values dropped', () => {
    expect(parseRecapUrl(q('slide=Streak'), 2)).toEqual({ slide: 'streak' });
    expect(parseRecapUrl(q('slide=a b'), 2)).toEqual({});
    expect(parseRecapUrl(q('slide=' + 'x'.repeat(41)), 2)).toEqual({});
    expect(parseRecapUrl(q('people=PERSON'), 2)).toEqual({ people: 'person' });
    expect(parseRecapUrl(q('people=person'), 1)).toEqual({});
    expect(parseRecapUrl(q('preview=1'), 2)).toEqual({ preview: true });
    expect(parseRecapUrl(q('preview=yes'), 2)).toEqual({});
    expect(parseRecapUrl(q(''), 2)).toEqual({});
  });
  it('seeMoreHref: tab, the year, decaf included, extras, people', () => {
    const u = new URL(seeMoreHref(2026, 'leaderboards', { rank: 'grams' }), 'http://x');
    expect(u.pathname).toBe('/insights');
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'leaderboards', range: '2026', caffeine: 'all', rank: 'grams' });
    expect(seeMoreHref(2026, 'overview', {}, 'person')).toContain('people=person');
    expect(new URL(seeMoreHref(2026, 'overview'), 'http://x').searchParams.has('tab')).toBe(false);
  });
  it('recapHref: canonical order, defaults omitted', () => {
    expect(recapHref(2026, {})).toBe('/recaps/2026');
    expect(recapHref(2026, { preview: true, people: 'person', slide: 'hour' })).toBe('/recaps/2026?slide=hour&people=person&preview=1');
  });
});
