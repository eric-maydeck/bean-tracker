import { describe, expect, it } from 'vitest';
import type { ThumbCtx } from '../thumbTypes';
import { SPEND_THUMBS } from './spend';
import { BREWING_THUMBS } from './brewing';

const ctx = (data: object, s: object = {}): ThumbCtx => ({ data, s, periodLabel: 'p', compareLabel: 'Prev', perPerson: false } as never);
const series = { by: 'month', labels: ['a', 'b', 'c'], sub: [1, 2, 3], oneOff: [3, 2, 1], ppg: { all: [0.1, 0.2, 0.3], sub: [0.1, 0.2, 0.3], oneOff: [0.1, 0.2, 0.3] }, compare: null, compareAverage: null, comparePpg: null, compareSplit: null, comparePpgSplit: null, compareAverageSplit: null };
const spend = (o: object = {}) => ({ spend: { tiles: { bags: 3 }, series, discovery: { cumulative: [1, 2, 3] }, ...o } });

describe('spend thumbs', () => {
  it('spend-chart: stacked bars by default, lines for ppg', () => {
    const b = SPEND_THUMBS['spend-chart'](ctx(spend()));
    expect(b?.title).toBe('Spend over time');
    expect(b?.thumb).toMatchObject({ kind: 'vbars', stacked: true });
    expect(SPEND_THUMBS['spend-chart'](ctx(spend(), { spendView: 'ppg' }))?.thumb.kind).toBe('lines');
  });
  it('spend-chart: none without bags, other tab or unpriced ppg', () => {
    expect(SPEND_THUMBS['spend-chart'](ctx(spend({ tiles: { bags: 0 } })))).toBeNull();
    expect(SPEND_THUMBS['spend-chart'](ctx({ spend: null }))).toBeNull();
    expect(SPEND_THUMBS['spend-chart'](ctx(spend({ series: { ...series, ppg: { ...series.ppg, all: [null, null, null] } } }), { spendView: 'ppg' }))).toBeNull();
  });
  it('spend-discovery: lines from 0, none under 2 points', () => {
    expect(SPEND_THUMBS['spend-discovery'](ctx(spend()))).toMatchObject({ title: 'Roaster discovery', thumb: { kind: 'lines' } });
    expect(SPEND_THUMBS['spend-discovery'](ctx(spend({ discovery: { cumulative: [1] } })))).toBeNull();
  });
});

describe('brewing thumbs', () => {
  it('brewing-best: bars from bestAt, none when empty', () => {
    const t = BREWING_THUMBS['brewing-best'](ctx({ brewing: { bestAt: [{ label: '#1', bags: 2 }, { label: '#2', bags: 1 }] } }));
    expect(t).toMatchObject({ title: 'Brews until dialed', thumb: { kind: 'vbars' } });
    expect(BREWING_THUMBS['brewing-best'](ctx({ brewing: { bestAt: [] } }))).toBeNull();
  });
  it('brewing-rating-by-wait: bars above the floor, none when unrated', () => {
    const w = (r: (number | null)[]) => ({ brewing: { wait: { byWait: r.map((rating, i) => ({ label: `${i}`, rating })) } } });
    const t = BREWING_THUMBS['brewing-rating-by-wait'](ctx(w([7, 8.5, 9])));
    expect(t).toMatchObject({ title: 'Rating by wait', thumb: { kind: 'vbars' } });
    expect(BREWING_THUMBS['brewing-rating-by-wait'](ctx(w([null, null])))).toBeNull();
    expect(BREWING_THUMBS['brewing-rating-by-wait'](ctx({ brewing: { wait: null } }))).toBeNull();
  });
});
