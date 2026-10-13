import { describe, it, expect } from 'vitest';
import { capList, inkOf, lines, nameColors, smooth, SLOTS } from './multiLine';

const m = (values: (number | null)[][], labels = values.map((_, i) => `L${i}`)) =>
  ({ x: values[0].map((_, i) => String(i)), lines: values.map((v, i) => ({ label: labels[i], values: v })) });
describe('multiLine', () => {
  it('a null breaks a line into runs; a lone point is a dash', () => {
    const [l] = lines(m([[1, 2, null, 3]]));
    expect(l.runs).toHaveLength(2);
    expect(l.runs[1]).toMatch(/^M[\d.,]+L[\d.,]+$/);
  });
  it('smooth: a monotone curve never overshoots (a flat end stays flat)', () => {
    const d = smooth([[0, 10], [50, 0], [100, 0]]);
    const ys = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((x) => +x[1]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
    expect(d.endsWith('100,0')).toBe(true);
  });
  it('categorical slots in order; Other muted', () =>
    expect(lines(m([[1, 2], [2, 3], [3, 4]], ['A', 'Other', 'B'])).map((l) => l.color)).toEqual(
      ['var(--series-1)', 'var(--series-other)', 'var(--series-2)']));
  it('all-null: no runs, no Infinity', () => {
    expect(lines(m([[null, null]]))[0].runs).toEqual([]);
  });
});

it('inkOf maps a slot to its text-safe variant', () => expect(inkOf('var(--series-3)')).toBe('var(--series-3-ink)'));

describe('nameColors', () => {
  const pairs = [{ a: 'E', b: 'F' }, { a: 'A', b: 'E' }, { a: 'F', b: 'G' }];
  it('one color per name, distinct while slots last; lines keep their order; Other is not a name', () => {
    const c = nameColors(['A', 'B', 'C', 'D', 'Other'], pairs);
    expect([...c.keys()]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(new Set(c.values()).size).toBe(7);
    expect(c.get('A')).toBe(SLOTS[0]);
    expect(c.has('Other')).toBe(false);
  });
  it('past the palette, a name reuses only a slot none of its bar or pair partners use', () => {
    const lines = Array.from({ length: 14 }, (_, i) => `L${i}`);
    const many = [{ a: 'L0', b: 'X' }, { a: 'X', b: 'Y' }, { a: 'Y', b: 'L1' }];
    const c = nameColors(lines, many);
    expect(new Set(lines.map((l) => c.get(l))).size).toBe(14); // every bar's segments differ
    for (const p of many) expect(c.get(p.a)).not.toBe(c.get(p.b)); // every pair's two differ
  });
});

describe('capList (Other tips: 8 on desktop, 4 on phones)', () => {
  const ten = Array.from({ length: 10 }, (_, i) => i);
  it('cuts at max with "+N more"', () => {
    expect(capList(ten, 8)).toEqual({ shown: ten.slice(0, 8), more: 2 });
    expect(capList(ten, 4)).toEqual({ shown: ten.slice(0, 4), more: 6 });
  });
  it('never "+1 more": one leftover is shown; short lists stay whole', () => {
    expect(capList(ten.slice(0, 9), 8)).toEqual({ shown: ten.slice(0, 9), more: 0 });
    expect(capList(ten.slice(0, 5), 4).more).toBe(0);
    expect(capList([], 4)).toEqual({ shown: [], more: 0 });
  });
});
