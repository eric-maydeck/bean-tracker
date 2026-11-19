import { describe, expect, it } from 'vitest';
import type { ThumbCtx } from '../thumbTypes';
import { CONSUMPTION_THUMBS } from './consumption';
import { THUMB_TOKENS } from '#lib/linkPreview.ts';
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
  it('weekday bars colour Sat and Sun brown-3; hours carry 12-hour tick labels and y labels', () => {
    const full = { ...h, byWeekday: [1, 2, 3, 4, 5, 6, 7] };
    const w = HABITS_THUMBS['habits-weekday'](ctx({ habits: full }))!.thumb as { series: { color: number; colors?: number[] }[]; x: [number, string][] };
    const b3 = THUMB_TOKENS.indexOf('--series-brown-3');
    expect(w.series[0].colors).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => (i >= 5 ? b3 : w.series[0].color)));
    expect(w.x.map((t) => t[1])).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const hr = HABITS_THUMBS['habits-hour'](ctx({ habits: { ...h, byHour: Array.from({ length: 24 }, (_, i) => i) } }))!.thumb as { x: [number, string][]; y: [string, string]; series: { colors?: number[] }[] };
    expect(hr.x[0]).toEqual([0, '12a']);
    expect(hr.x.at(-1)).toEqual([23, '11p']);
    expect(hr.y).toEqual(['0', '23']);
    expect(hr.series[0].colors).toBeUndefined();
  });
  it('null without data', () => {
    expect(HABITS_THUMBS['habits-hour'](ctx({ habits: null }))).toBeNull();
  });
});
