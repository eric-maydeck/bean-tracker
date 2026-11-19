import { describe, expect, it } from 'vitest';
import type { ConsumptionTab } from '#lib/server/insights/consumption.ts';
import type { Habits } from '#lib/server/insights/habits.ts';
import { consumptionCharts, habitsCharts } from './consumptionSeries';

const tab = (o: Partial<ConsumptionTab> = {}) => ({
  ratingFrom: 1, trendLine: null, trendLabel: null, labels: ['a', 'b', 'c'], brewed: [200, 300, 250], bought: [500, 0, 400], backlog: [300, 0, 150],
  compareBrewed: null, compareTitles: null, compareAverage: null, ...o
}) as unknown as ConsumptionTab;
const O = { unit: 'grams' as const, agg: 'total' as const, periodLabel: 'This month', compareLabel: 'Last month', compareDates: 'x' };

describe('consumptionCharts', () => {
  it('brewed is a bar without a trend', () => {
    const { brewed } = consumptionCharts(tab(), O);
    expect(brewed).toMatchObject({ type: 'bar', title: 'Brewed over time', values: [200, 300, 250], k: 1, series: [] });
  });
  it('rating is a line from ratingFrom with a floor one under the min', () => {
    const { brewed } = consumptionCharts(tab({ brewed: [null, 7.4, 8.2] }), { ...O, trend: 'rating' });
    expect(brewed).toMatchObject({ type: 'line', title: 'Rating over time', labels: ['b', 'c'], values: [7.4, 8.2], yMin: 6 });
  });
  it('grams go to kg from 10000', () => {
    const { brewed, bought } = consumptionCharts(tab({ brewed: [12000, 500, 0] }), O);
    expect(brewed.k).toBe(1000);
    expect(brewed.values[0]).toBe(12);
    expect(bought.k).toBe(1000);
  });
  it('compare + trend line give their flagged series', () => {
    const t = tab({ compareBrewed: [100, 120, 90], compareTitles: ['p', 'q', 'r'], trendLine: [1, 2, 3], trendLabel: '7-day average' });
    const { brewed } = consumptionCharts(t, O);
    expect(brewed.series.map((s) => [s.label, !!s.faded, !!s.dashed, !!s.trend])).toEqual([['Last month', true, false, false], ['7-day average', false, false, true]]);
    const avg = consumptionCharts(tab({ compareAverage: 50, trendLine: [1, 2, 3], trendLabel: 't' }), O).brewed.series;
    expect(avg.map((s) => [s.label, !!s.dashed, !!s.trend])).toEqual([['Last month (avg)', true, false], ['t', false, true]]);
  });
  it('bought has Brewed for grams and Finished for bags', () => {
    expect(consumptionCharts(tab(), O).bought.series[0].label).toBe('Brewed');
    expect(consumptionCharts(tab(), { ...O, unit: 'bags' }).bought.series[0].label).toBe('Finished');
    expect(consumptionCharts(tab(), O).bought.datasetLabel).toBe('Bought');
  });
});

const hab = (o: Partial<Habits> = {}) => ({ byHour: [7, 8, null], byWeekday: [6.5, 9], compareHour: [1, 2, 3], compareWeekday: null, ...o }) as unknown as Habits;
const H = { agg: 'total' as const, comparing: true, periodLabel: 'P', compareLabel: 'C' };

describe('habitsCharts', () => {
  it('yMin only for rating', () => {
    expect(habitsCharts(hab(), { ...H, measure: 'brews' }).hour.yMin).toBeUndefined();
    expect(habitsCharts(hab(), { ...H, measure: 'rating' }).hour.yMin).toBe(0);
    expect(habitsCharts(hab(), { ...H, measure: 'rating' }).weekday.yMin).toBe(5);
  });
  it('compare adds a faded series only when comparing with data', () => {
    expect(habitsCharts(hab(), { ...H, measure: 'brews' }).hour.series).toEqual([{ label: 'C', values: [1, 2, 3], faded: true }]);
    expect(habitsCharts(hab(), { ...H, measure: 'brews' }).weekday.series).toEqual([]);
    expect(habitsCharts(hab(), { ...H, comparing: false, measure: 'brews' }).hour.series).toEqual([]);
  });
});
