import { describe, it, expect } from 'vitest';
import { AGE_TOKENS, ageChart, runwayPaces, runwaySeries, stateRows, waitingRows } from './onHandSeries';
import type { OnHandTab } from '#lib/server/insights/onHand.ts';

const split = (n: number) => ({ before: [n], inside: [n + 1], past: [n + 2], noWindow: [n + 3] });
const t = {
  age: { labels: ['0-7'], bags: split(1), grams: split(100) },
  states: { open: { bags: 1, grams: 50 }, waiting: { bags: 2, grams: 400 }, frozen: { bags: 3, grams: 600 } },
  waiting: { by: { roaster: [{ label: 'A', grams: 1, bags: 1, href: null }], origin: [{ label: 'Peru', grams: 2, bags: 1, href: null }], process: [], roast: [], caffeine: [] } }
} as unknown as OnHandTab;

describe('onHandSeries', () => {
  it('ageChart gives 4 series with the AGE_TOKENS, per unit', () => {
    const a = ageChart(t, 'grams');
    expect(a.series.map((s) => s.color)).toEqual(AGE_TOKENS.map((k) => `var(${k})`));
    expect(a.series[0].values).toEqual([100]);
    expect(ageChart(t, 'bags').series[0].values).toEqual([1]);
  });
  it('stateRows follows the unit', () => {
    expect(stateRows(t, 'bags').values).toEqual([1, 2, 3]);
    expect(stateRows(t, 'grams').values).toEqual([50, 400, 600]);
  });
  it('waitingRows defaults to roaster', () => {
    expect(waitingRows(t)[0].label).toBe('A');
    expect(waitingRows(t, 'origin')[0].label).toBe('Peru');
  });
  it('runwayPaces: range all gives 1 pace, otherwise 2', () => {
    expect(runwayPaces({ range: 'all', periodLabel: 'All time', runwayDays: 5, allDays: 9 })).toEqual([{ name: 'all-time pace', days: 9 }]);
    expect(runwayPaces({ range: '12m', periodLabel: 'Last 12 months', runwayDays: 5, allDays: 9 }).map((p) => p.name)).toEqual(['last 12 months', 'all-time pace']);
  });
  it('runwaySeries: ~41 points, null after run-out, null when no pace has days', () => {
    const r = runwaySeries(1000, '2026-09-25', [{ name: 'a', days: 10 }, { name: 'b', days: 40 }])!;
    expect(r.series).toHaveLength(2);
    expect(r.labels.length).toBeGreaterThanOrEqual(41);
    expect(r.series[0].values.at(-1)).toBeNull();
    expect(r.series[1].values.at(-1)).toBe(0);
    expect(runwaySeries(1000, '2026-09-25', [{ name: 'a', days: null }])).toBeNull();
  });
});
