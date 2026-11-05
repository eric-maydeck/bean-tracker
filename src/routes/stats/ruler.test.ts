import { describe, it, expect } from 'vitest';
import { rulerTicks, tickAt, rulerToFeed, feedToRuler } from './ruler';

describe('rulerTicks', () => {
  const months = ['2026-10', '2026-08', '2026-03', '2026-01']; // newest first; gaps have no milestones
  it('every month in the span, newest first, evenly spaced; gaps jump to the earlier month', () => {
    const t = rulerTicks(months, 1000, 20);
    expect(t.map((x) => x.ym)).toEqual(['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    expect(t[0].p).toBeCloseTo(0.05);
    expect(t[9].p).toBeCloseTo(0.95);
    expect(t.find((x) => x.ym === '2026-09')!.target).toBe('2026-08');
    expect(t.find((x) => x.ym === '2026-02')!.target).toBe('2026-01');
    expect(t[0].label).toBe('Oct 2026');
    expect(t.every((x) => x.major)).toBe(true); // room for every label
  });
  it('labels thin out to quarters, then years, as room shrinks', () => {
    expect(rulerTicks(months, 300, 72).filter((x) => x.major).map((x) => x.label)).toEqual(['Oct 2026', 'Jul 2026', 'Apr 2026', 'Jan 2026']);
    const long = rulerTicks(['2026-10', '2023-02'], 300, 72).filter((x) => x.major).map((x) => x.label);
    expect(long).toEqual(['Jan 2026', 'Jan 2025', 'Jan 2024']);
    expect(rulerTicks(['2026-10', '2026-08'], 50, 72).filter((x) => x.major).map((x) => x.ym)).toEqual(['2026-10']); // never unlabelled
  });
  it('tickAt maps a fraction to its band', () => {
    const t = rulerTicks(months, 1000, 20);
    expect(tickAt(t, 0).ym).toBe('2026-10');
    expect(tickAt(t, 0.42).ym).toBe('2026-06');
    expect(tickAt(t, 1.2).ym).toBe('2026-01');
  });
});

describe('ruler ↔ feed', () => {
  // Oct (0..100), Aug (100..300), Mar (300..400), Jan (400..600); Sep, Jul..Apr, Feb are empty.
  const months = ['2026-10', '2026-08', '2026-03', '2026-01'];
  const t = rulerTicks(months, 1000, 20);
  const secs = [{ ym: '2026-10', top: 0, bottom: 100 }, { ym: '2026-08', top: 100, bottom: 300 },
    { ym: '2026-03', top: 300, bottom: 400 }, { ym: '2026-01', top: 400, bottom: 600 }];
  it('a point 60% through a month band lands 60% through its section', () => {
    expect(rulerToFeed(t, secs, 0.26)).toBeCloseTo(100 + 0.6 * 200); // Aug band is 0.2..0.3
    expect(rulerToFeed(t, secs, 0.12)).toBe(100); // Sep is empty: the start of Aug
    expect(rulerToFeed(t, secs, 1)).toBe(600);
  });
  it('feedToRuler inverts it', () => {
    expect(feedToRuler(t, secs, 220)).toBeCloseTo(0.26);
    expect(feedToRuler(t, secs, -50)).toBe(0);
    expect(feedToRuler(t, secs, 700)).toBe(1);
    expect(feedToRuler(t, secs, 350)).toBeCloseTo(0.75); // Mar band 0.7..0.8
  });
});
