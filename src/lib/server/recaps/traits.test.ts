import { describe, it, expect } from 'vitest';
import { addDays } from '$lib/server/insights/time';
import { personality } from './traits';
import { brew, ctx } from './testFixtures';

// 300 brews over 150 days (Jun 1 to Oct 28, 2/day): 62% washed, a third on the CT62 of 11 pour-over drippers,
// 71d rest, 91.3°C. `evening`: every 5th brew is at 8pm and decaf but two. `extra`: ratio and roast on every brew.
const year = (o: { evening?: boolean; ratio?: number | null; roast?: boolean } = {}) => {
  const { evening = true, ratio = null, roast = false } = o;
  const brews = Array.from({ length: 300 }, (_, i) => {
    const night = evening && i % 5 === 0;
    return brew({
      at: `${addDays('2026-06-01', i % 150)}T${night ? '20' : '09'}:15`, processGroup: i % 100 < 62 ? 'Washed' : 'Natural',
      dripper: i % 3 === 0 ? 'CT62' : `D${i % 10}`, restDays: 71, tempC: 91.3, decaf: night && i % 150 !== 0,
      ratio: ratio === null ? null : i % 10 < ratio * 10 ? 17 : 15, roastLevel: roast ? 'Light' : null
    });
  }).sort((a, b) => a.localTime.localeCompare(b.localTime));
  return ctx(brews, { pours: { facts: new Map(), recipes: [] } });
};
const pairs = (y: ReturnType<typeof year>) => personality(y)!.traits!.map((t) => [t.value, t.label]);

describe('personality', () => {
  it('fills 6 tiles from the pool, skipping unsupported traits', () => {
    const s = personality(year({ evening: false, ratio: 0.5, roast: true }))!;
    expect(s.traits).toHaveLength(6);
    expect(s.traits!.map((t) => t.label)).not.toContain('decaf after 7pm');
  });
  it('title from the strongest words', () => expect(personality(year())!.big).toBe('The patient washed purist'));
  it('shows the mockup\'s six tiles', () => {
    expect(pairs(year())).toEqual([
      ['62%', 'washed'], ['33%', 'on the CT62'], ['71d', 'average rest in Oct'], ['97%', 'decaf after 7pm'],
      ['11', 'brewers'], ['91.3°C', 'average brew temp']
    ]);
  });
  it('a steady ratio outranks patient in the title; seventh trait stays off the tiles', () => {
    const s = personality(year({ ratio: 0.7 }))!;
    expect(s.big).toBe('The steady patient purist');
    expect(s.traits!.map((t) => t.label)).not.toContain('brew ratio');
  });
  it('context: three phrases, then the rest with and', () => {
    expect(personality(year())!.context).toBe('Washed coffee, mostly the CT62, 71d of rest in Oct. Decaf after dark, 11 brewers and 91.3°C water.');
  });
  it('slide shape', () => {
    expect(personality(year())).toMatchObject({ id: 'you', tone: 'cream', wide: true, link: { section: 'Highlights · Insights', href: '/insights?tab=insights&range=2026&caffeine=all' } });
  });
  it('no words = Your coffee year', () => {
    const y = year({ roast: true });
    y.brews.forEach((b) => Object.assign(b, { processGroup: null, restDays: null, dripper: null }));
    expect(personality(y)!.big).toBe('Your coffee year');
  });
  it('fewer than 2 supportable traits = no personality slide', () => {
    const thin = Array.from({ length: 10 }, (_, i) => brew({ at: `2026-03-0${1 + (i % 9)}T09:00` }));
    expect(personality(ctx(thin, { pours: { facts: new Map(), recipes: [] } }))).toBeNull();
  });
});
