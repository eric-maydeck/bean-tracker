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
  it('lines trim all-null edges, vbars do not', () => {
    expect(out(chartThumb('lines', [{ label: 'A', values: [null, 1, 2, null] }]))[0].values).toHaveLength(2);
    expect(out(chartThumb('vbars', [{ label: 'A', values: [null, 1, 2, null] }]))[0].values).toHaveLength(4);
  });
  it('clips labels to 80 and maps non-finite values to null', () => {
    const r = out(chartThumb('vbars', [{ label: 'x'.repeat(100), values: [NaN, 1, Infinity, 2] }]))[0];
    expect(r.label).toHaveLength(80);
    expect(r.values.every((v) => v != null && Number.isFinite(v))).toBe(true);
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

describe('chartThumb labels', () => {
  const lab = (t: Thumb | null) => t as unknown as { x?: [number, string][]; y?: [string, string]; vals?: string[]; series: { colors?: number[] }[] };
  const fmt = (v: number) => `${v}g`;
  const names = (n: number) => Array.from({ length: n }, (_, i) => `L${i}`);
  it('picks at most 7 ticks, first and last included, no duplicates', () => {
    for (const n of [2, 3, 7, 24, 100]) {
      const t = lab(chartThumb('lines', [{ label: 'A', values: vals(n, (i) => i) }], { x: names(n) }));
      const ix = t.x!.map((a) => a[0]);
      expect(ix.length).toBeLessThanOrEqual(7);
      expect(ix[0]).toBe(0);
      expect(ix.at(-1)).toBe(Math.min(n, 40) - 1);
      expect(new Set(ix).size).toBe(ix.length);
    }
  });
  it('labels sampled points by their source column, and skips the trimmed lead', () => {
    const t = lab(chartThumb('lines', [{ label: 'A', values: [null, 1, 2, 3] }], { x: ['a', 'b', 'c', 'd'] }));
    expect(t.x).toEqual([[0, 'b'], [1, 'c'], [2, 'd']]);
    const big = lab(chartThumb('lines', [{ label: 'A', values: vals(100, (i) => i) }], { x: names(100) }));
    expect(big.x!.at(-1)).toEqual([39, 'L99']);
  });
  it('bars up to 12 label every bar, more spread to 7; lines stay at 7', () => {
    expect(lab(chartThumb('vbars', [{ label: 'A', values: vals(8, (i) => i + 1) }], { x: names(8) })).x).toHaveLength(8);
    expect(lab(chartThumb('vbars', [{ label: 'A', values: vals(24, (i) => i + 1) }], { x: names(24) })).x).toHaveLength(7);
    expect(lab(chartThumb('lines', [{ label: 'A', values: vals(8, (i) => i + 1) }], { x: names(8) })).x).toHaveLength(7);
  });
  it('formats y from the raw values: bars from 0, lines from the data min', () => {
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [2, 300] }], { fmt })).y).toEqual(['0g', '300g']);
    expect(lab(chartThumb('lines', [{ label: 'A', values: [2, 300] }], { fmt })).y).toEqual(['2g', '300g']);
    expect(lab(chartThumb('lines', [{ label: 'A', values: [2, 300] }], { fmt, yMin: 0 })).y).toEqual(['0g', '300g']);
  });
  it('drops labels over 12 characters', () => {
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [2, 3] }], { fmt: (v) => `${v} avg rating!!` })).y).toBeUndefined();
  });
  it('data labels: single or stacked bars up to 12, not grouped, not lines, not 13', () => {
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [2, 3] }], { fmt })).vals).toEqual(['2g', '3g']);
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [1, 2] }, { label: 'B', values: [3, 4] }], { fmt, stacked: true })).vals).toEqual(['4g', '6g']);
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [1, 2] }, { label: 'B', values: [3, 4] }], { fmt })).vals).toBeUndefined();
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [1, 2] }, { label: 'B', values: [3, 2] }], { fmt, stacked: true })).vals).toBeUndefined(); // every total alike (100% bars): no information
    expect(lab(chartThumb('lines', [{ label: 'A', values: [1, 2] }], { fmt })).vals).toBeUndefined();
    expect(lab(chartThumb('vbars', [{ label: 'A', values: vals(13, (i) => i + 1) }], { fmt })).vals).toBeUndefined();
    expect(lab(chartThumb('vbars', [{ label: 'A', values: vals(12, (i) => i + 1) }], { fmt })).vals).toHaveLength(12);
  });
  it('per-point colours on a single bar series', () => {
    const t = lab(chartThumb('vbars', [{ label: 'A', values: [1, 2, 3] }], { points: [null, '--series-brown-3', null] }));
    expect(t.series[0].colors).toEqual([idx('--series-11'), idx('--series-brown-3'), idx('--series-11')]);
    expect(lab(chartThumb('vbars', [{ label: 'A', values: [1, 2] }], { points: [null, null] })).series[0].colors).toBeUndefined();
  });
});
