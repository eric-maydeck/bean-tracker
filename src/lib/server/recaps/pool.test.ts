import { describe, it, expect } from 'vitest';
import type { BrewFact } from '$lib/server/insights/facts';
import { addDays } from '$lib/server/insights/time';
import { POOL, fact } from './pool';
import type { YearCtx } from './year';

let id = 0;
const brew = (o: Partial<BrewFact> & { at: string }): BrewFact => {
  const { at, ...rest } = o;
  return {
    id: ++id, coffeeId: 1, localTime: at, localDate: at.slice(0, 10), backfilled: false, dose: 18, rating: 8,
    roaster: 'R', origin: null, processGroup: null, roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover',
    waterG: 290, ratio: null, grind: null, dripper: null, filter: null, grinder: null, water: null, waterProfile: null,
    restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, hasNote: false, tempC: null, brewIndex: 0, ...rest
  } as unknown as BrewFact;
};
const ctx = (brews: BrewFact[], o: Partial<YearCtx> = {}) =>
  ({ year: 2026, period: { start: '2026-01-01', end: '2026-12-31' }, today: '2027-02-01', preview: false, everyBrew: brews, bags: [], brews, scored: brews, per: 1, size: 2, ...o }) as unknown as YearCtx;
const days = (from: string, n: number, hh = '09') => Array.from({ length: n }, (_, i) => brew({ at: `${addDays(from, i)}T${hh}:15` }));

// 1,489 brews Feb 9 to Oct 28, May the peak at 226; hours cycle with 1pm three times in 18.
const MONTHLY = [8, 177, 221, 226, 142, 175, 190, 170, 180];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 13, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const rich = (() => {
  const out: BrewFact[] = [];
  MONTHLY.forEach((n, mi) => {
    const m = mi + 2, first = mi === 0 ? 9 : 1, last = mi === 0 ? 16 : mi === 8 ? 28 : new Date(Date.UTC(2026, m, 0)).getUTCDate();
    for (let i = 0; i < n; i++) {
      const h = HOURS[out.length % HOURS.length], day = first + (i % (last - first + 1));
      const mm = String((out.length * 7) % 60).padStart(2, '0');
      out.push(brew({
        at: `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${mm}`,
        dose: 17.89, waterG: 293.5, decaf: h >= 19 && out.length % 20 !== 0
      }));
    }
  });
  return out.sort((a, b) => a.localTime.localeCompare(b.localTime));
})();

describe('total', () => {
  it('counts, kg, litres, peak month', () => {
    const s = fact('total').run(ctx(rich))!;
    expect(s.big).toBe('1,489');
    expect(s.context).toBe('26.6kg of coffee through 437L of water, Feb 9 to Oct 28. May was the peak at 226.');
    expect(s.viz).toMatchObject({ kind: 'bars', hi: 3, hiText: '226' });
    expect(s.perPerson).toBe(true);
    expect(s.lead).toBe('Your 2026');
  });
  it('preview lead; per person divides amounts', () => {
    expect(fact('total').run(ctx(rich, { preview: true }))!.lead).toBe('Your 2026 so far');
    const s = fact('total').run(ctx(rich, { per: 2 }))!;
    expect(s.big).toBe('745');
    expect(s.context).toMatch(/^13\.3kg of coffee through 219L of water/);
    expect(s.context).toMatch(/peak at 113\.$/);
  });
});

describe('streak', () => {
  it('null under 7 days', () => expect(fact('streak').run(ctx(days('2026-03-01', 6)))).toBeNull());
  it('still going when it reaches the year end', () => {
    const s = fact('streak').run(ctx([...days('2026-03-01', 3), ...days('2026-12-20', 12)]))!;
    expect(s.big).toBe('12');
    expect(s.context).toMatch(/^Unbroken since Dec 20 and still going\./);
    expect(s.viz).toMatchObject({ kind: 'calendar' });
  });
  it('not going, with the missed days since the first 7-day run', () => {
    const s = fact('streak').run(ctx([...days('2026-03-01', 7), ...days('2026-03-10', 10)]))!;
    expect(s.context).toBe('Unbroken from Mar 10 to Mar 19. Since Mar 1 you have missed 2 days.');
    expect(fact('streak').run(ctx([...days('2026-03-01', 7), ...days('2026-03-09', 10)]))!.context)
      .toBe('Unbroken from Mar 9 to Mar 18. Since Mar 1 you have missed exactly 1 day: Mar 8.');
    const v = s.viz as { start: string; days: string[] };
    expect(v.start).toBe('2026-02-23'); // Monday
    expect(v.days.slice(0, 6)).toEqual(['none', 'none', 'none', 'none', 'none', 'none']);
    expect(v.days).toContain('miss');
  });
});

describe('hour', () => {
  it('peak hour and the day span', () => {
    const s = fact('hour').run(ctx(rich))!;
    expect(s.big).toBe('1pm');
    expect(s.context).toMatch(/^\d{3} brews: that's 1 in 6 brews at 1pm\. Your brew day spans anywhere from 7:\d\dam to 10:\d\dpm\.$/);
    expect(s.viz).toMatchObject({ kind: 'bars', hi: 6 });
  });
  it('skips backfilled brews; null under 50', () => {
    const timed = days('2026-03-01', 49, '13');
    const typed = Array.from({ length: 100 }, (_, i) => brew({ at: `2026-04-${String(1 + (i % 28)).padStart(2, '0')}T08:00`, backfilled: true }));
    expect(fact('hour').run(ctx([...timed, ...typed]))).toBeNull();
    expect(fact('hour').run(ctx([...timed, brew({ at: '2026-05-01T13:20' })]))).not.toBeNull();
  });
});

describe('decaf', () => {
  const mix = (eveDecaf: number, dayDecaf: number) => [
    ...Array.from({ length: 20 }, (_, i) => brew({ at: `2026-03-${String(1 + i).padStart(2, '0')}T20:10`, decaf: i < eveDecaf })),
    ...Array.from({ length: 20 }, (_, i) => brew({ at: `2026-04-${String(1 + i).padStart(2, '0')}T09:10`, decaf: i < dayDecaf }))
  ];
  it('evening share vs daytime', () => {
    const s = fact('decaf').run(ctx(mix(19, 1)))!;
    expect(s.big).toBe('95%');
    expect(s.context).toBe('19 of your 20 evening brews skipped the caffeine. Before 7pm, decaf is 5%.');
    expect(s.score).toBeCloseTo(0.9);
  });
  it('null without decaf, or when the gap is under 30 points', () => {
    expect(fact('decaf').run(ctx(mix(0, 0)))).toBeNull();
    expect(fact('decaf').run(ctx(mix(12, 8)))).toBeNull();
  });
});

describe('every fact', () => {
  it('links with caffeine=all and the year', () => {
    const got = POOL.map((f) => f.run(ctx(rich)));
    expect(got.every(Boolean)).toBe(true);
    for (const s of got) expect(s!.link.href).toMatch(/range=2026&caffeine=all/);
  });
  it('copy uses digits and unspaced units, with a card and section', () => {
    for (const f of POOL) {
      const s = f.run(ctx(rich))!;
      expect(`${s.big} ${s.context}`).not.toMatch(/\d (g|kg|L|s|d|°C|mL)\b/);
      expect(s.card.big && s.card.label && s.link.section).toBeTruthy();
    }
  });
});
