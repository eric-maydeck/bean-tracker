import { describe, expect, it } from 'vitest';
import { chartThumb } from './chartThumb';
import { THUMB_TOKENS, type Thumb } from './linkPreview';

const idx = (t: string) => THUMB_TOKENS.indexOf(t as never);
const vals = (n: number, f: (i: number) => number | null) => Array.from({ length: n }, (_, i) => f(i));
const out = (t: Thumb | null) => (t as { series: { label: string; color: number; values: (number | null)[] }[] }).series;

describe('chartThumb', () => {
  it('one series vbars', () => {
    expect(chartThumb('vbars', [{ label: 'A', values: [0, 5, 10] }])).toEqual({ kind: 'vbars', series: [{ label: 'A', color: idx('--series-11'), values: [0, 50, 100] }] });
  });
  it('drops overlays', () => {
    const t = chartThumb('vbars', [{ label: 'A', values: [0, 5, 10] }, { label: 'f', values: [1, 1, 1], faded: true }, { label: 'd', values: [1, 1, 1], dashed: true }, { label: 't', values: [1, 1, 1], trend: true }]);
    expect(out(t)).toEqual([{ label: 'A', color: idx('--series-11'), values: [0, 50, 100] }]);
  });
  it('caps lines at 3', () => {
    const t = chartThumb('lines', vals(5, (i) => i).map((i) => ({ label: `S${i}`, values: [1, 2, 3] })));
    expect(out(t).map((s) => s.color)).toEqual(['--series-1', '--series-2', '--series-3'].map(idx));
  });
  it('page colours for 2, explicit colour kept', () => {
    const two = [{ label: 'A', values: [1, 2] }, { label: 'B', values: [1, 2] }];
    expect(out(chartThumb('lines', two)).map((s) => s.color)).toEqual(['--series-brown-1', '--series-brown-3'].map(idx));
    expect(out(chartThumb('lines', [two[0], { ...two[1], color: 'var(--series-10)' }]))[1].color).toBe(idx('--series-10'));
    expect(out(chartThumb('lines', [two[0], { ...two[1], color: '--series-10' }]))[1].color).toBe(idx('--series-10'));
  });
  it('stacked folds Other', () => {
    const s = [[1, 2], [1, 2], [1, 1], [2, 2]].map((values, i) => ({ label: `S${i}`, values }));
    const o = out(chartThumb('vbars', s, { stacked: true }));
    expect(o).toHaveLength(3);
    expect(o[2]).toEqual({ label: 'Other', color: idx('--series-other'), values: [43, 43] });
    expect(o[0].values).toEqual([14, 29]);
  });
  it('grouped scales to the max over both', () => {
    expect(out(chartThumb('vbars', [{ label: 'A', values: [5, 10] }, { label: 'B', values: [20, 0] }])).map((s) => s.values)).toEqual([[25, 50], [100, 0]]);
  });
  it('downsamples', () => {
    const l = out(chartThumb('lines', [{ label: 'A', values: vals(100, (i) => i) }]))[0].values;
    expect(l).toHaveLength(40);
    expect([l[0], l[39]]).toEqual([0, 100]);
    const b = out(chartThumb('vbars', [{ label: 'A', values: vals(100, (i) => (i < 50 ? 0 : 10)) }]))[0].values;
    expect(b).toHaveLength(40);
    expect([b[0], b[19], b[20], b[39]]).toEqual([0, 0, 100, 100]);
  });
  it('lines keep gaps, vbars null is 0', () => {
    expect(out(chartThumb('lines', [{ label: 'A', values: [1, null, 3] }]))[0].values).toEqual([0, null, 100]);
    expect(out(chartThumb('vbars', [{ label: 'A', values: [1, null, 3] }]))[0].values).toEqual([33, 0, 100]);
  });
  it('lines scale from data min, or yMin', () => {
    expect(out(chartThumb('lines', [{ label: 'A', values: [6, 8, 10] }]))[0].values).toEqual([0, 50, 100]);
    expect(out(chartThumb('lines', [{ label: 'A', values: [6, 8, 10] }], { yMin: 0 }))[0].values).toEqual([60, 80, 100]);
  });
  it('clamps below yMin', () => {
    expect(out(chartThumb('vbars', [{ label: 'A', values: [5, 8, 10] }], { yMin: 6 }))[0].values).toEqual([0, 50, 100]);
  });
  it('constant lines draw mid-height', () => {
    expect(out(chartThumb('lines', [{ label: 'A', values: [4, 4, 4] }]))[0].values).toEqual([50, 50, 50]);
  });
  it('gives null for all null, one point, or only overlays', () => {
    expect(chartThumb('lines', [{ label: 'A', values: [null, null] }])).toBeNull();
    expect(chartThumb('lines', [{ label: 'A', values: [3] }])).toBeNull();
    expect(chartThumb('lines', [{ label: 'A', values: [1, 2], faded: true }])).toBeNull();
  });
});
