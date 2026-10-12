import { describe, it, expect } from 'vitest';
import { rulerTicks, tickAt } from './ruler';

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
