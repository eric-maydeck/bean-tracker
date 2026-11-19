import { describe, expect, it } from 'vitest';
import type { SpendSeries } from '#lib/server/insights/spend.ts';
import type { WaitWindow } from '#lib/server/insights/freshness.ts';
import { spendChart } from './spendSeries';
import { waitBars } from './waitBars';

const sr = (o: Partial<SpendSeries> = {}): SpendSeries => ({
  by: 'month', labels: ['Jan', 'Feb', 'Mar'], titles: ['Jan', 'Feb', 'Mar'], partial: false,
  sub: [10, 20, 30], oneOff: [5, 5, 5], ppg: { all: [0.1, 0.2, 0.3], sub: [0.1, 0.2, 0.3], oneOff: [0.1, 0.2, 0.3] },
  compare: null, compareTitles: null, compareAverage: null, comparePpg: null, compareSplit: null, comparePpgSplit: null, compareAverageSplit: null, ...o
});

describe('spendChart', () => {
  it('default split is two stacked bars', () => {
    const c = spendChart(sr(), { compareLabel: 'Prev' });
    expect(c.type).toBe('bar');
    expect(c.series.map((s) => s.label)).toEqual(['One-off', 'Subscription']);
    expect(c.series.every((s) => s.color && !s.faded)).toBe(true);
    expect(c.whole).toBe(false);
  });
  it('spendSeries=all with ppg is three lines', () => {
    const c = spendChart(sr(), { spendView: 'ppg', spendSeries: 'all', compareLabel: 'Prev' });
    expect(c.type).toBe('line');
    expect(c.series.map((s) => s.label)).toEqual(['One-off', 'Subscription', 'Overall']);
  });
  it('a compare window adds a flagged series', () => {
    const split = { sub: [1, 2, 3], oneOff: [1, 1, 1] };
    const bars = spendChart(sr({ compare: [2, 3, 4], compareSplit: split }), { spendSeries: 'overall', compareLabel: 'Prev' });
    expect(bars.series.map((s) => [s.label, !!s.faded])).toEqual([['Overall', false], ['Prev', true]]);
    const lines = spendChart(sr({ comparePpg: [1, 1, 1], comparePpgSplit: split }), { spendView: 'ppg', spendSeries: 'sub', compareLabel: 'Prev' });
    expect(lines.series.map((s) => [s.label, !!s.dashed])).toEqual([['Subscription', false], ['Prev', true]]);
  });
  it('whole dollars once an amount reaches $1,000', () => {
    expect(spendChart(sr({ sub: [1000, 2000, 3000] }), { compareLabel: 'Prev' }).whole).toBe(true);
  });
});

describe('waitBars', () => {
  const smp = { small: false } as never;
  const w = (ratings: (number | null)[]): WaitWindow => ({ byWait: ratings.map((rating, i) => ({ label: `${i}d`, rating, sample: smp, bags: 1 })), window: [], noWindow: 0 });
  it('floors the axis a point under the lowest rating', () => {
    expect(waitBars(w([null, 7.4, 8.2]))).toEqual({ labels: ['0d', '1d', '2d'], values: [null, 7.4, 8.2], yMin: 6 });
  });
  it('is null when nothing is rated', () => {
    expect(waitBars(w([null, null]))).toBeNull();
  });
});
