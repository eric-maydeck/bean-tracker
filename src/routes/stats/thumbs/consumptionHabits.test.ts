import { describe, expect, it } from 'vitest';
import type { ThumbCtx } from '../thumbTypes';
import { CONSUMPTION_THUMBS } from './consumption';
import { HABITS_THUMBS } from './habits';

const tab = { buckets: [{}, {}, {}], ratingFrom: 0, trendLine: null, trendLabel: null, labels: ['a', 'b', 'c'], brewed: [6, 7.5, 8], bought: [5, 0, 4], backlog: [3, 0, 1], compareBrewed: null, compareTitles: null, compareAverage: null };
const ctx = (data: object, s: object = {}): ThumbCtx => ({ data, s: { unit: 'bags', agg: 'total', measure: 'brews', ...s }, periodLabel: 'This month', compareLabel: 'Last month', perPerson: false }) as unknown as ThumbCtx;
const c = ctx({ consumptionTab: tab });

describe('consumption thumbs', () => {
  it('brewed: vbars, lines under the rating trend', () => {
    const r = CONSUMPTION_THUMBS['consumption-chart-brewed'](c);
    expect(r?.title).toBe('Brewed over time');
    expect(r?.thumb).toMatchObject({ kind: 'vbars' });
    const l = CONSUMPTION_THUMBS['consumption-chart-brewed'](ctx({ consumptionTab: tab }, { trend: 'rating' }));
    expect(l).toMatchObject({ title: 'Rating over time', thumb: { kind: 'lines' } });
  });
  it('bought: two grouped series', () => {
    const r = CONSUMPTION_THUMBS['consumption-chart-bought'](c);
    expect(r).toMatchObject({ title: 'Bought vs brewed', thumb: { kind: 'vbars' } });
    expect(r!.thumb.kind === 'vbars' && r!.thumb.series.map((s) => s.label)).toEqual(['Bought', 'Finished']);
  });
  it('on hand: one line', () => {
    const r = CONSUMPTION_THUMBS['consumption-chart-on-hand'](c);
    expect(r).toMatchObject({ title: 'On hand over time', thumb: { kind: 'lines' } });
  });
  it('null without data', () => {
    for (const f of Object.values(CONSUMPTION_THUMBS)) expect(f(ctx({ consumptionTab: null }))).toBeNull();
  });
});

describe('habits thumbs', () => {
  const h = { tiles: { brewDays: 3 }, byHour: [1, 2, 3], byWeekday: [4, 5, 6, 7], compareHour: null, compareWeekday: null };
  it('null for an empty period (the page shows one empty panel)', () => {
    const e = { ...h, tiles: { brewDays: 0 }, byHour: [0, 0, 0], byWeekday: [0, 0, 0, 0] };
    for (const f of Object.values(HABITS_THUMBS)) expect(f(ctx({ habits: e }))).toBeNull();
    for (const f of Object.values(CONSUMPTION_THUMBS)) expect(f(ctx({ consumptionTab: { ...tab, buckets: [] } }))).toBeNull();
  });
  it('vbars with their titles', () => {
    expect(HABITS_THUMBS['habits-hour'](ctx({ habits: h }))).toMatchObject({ title: 'By hour of day', thumb: { kind: 'vbars' } });
    expect(HABITS_THUMBS['habits-weekday'](ctx({ habits: h }))).toMatchObject({ title: 'By day of week', thumb: { kind: 'vbars' } });
  });
  it('null without data', () => {
    expect(HABITS_THUMBS['habits-hour'](ctx({ habits: null }))).toBeNull();
  });
});
