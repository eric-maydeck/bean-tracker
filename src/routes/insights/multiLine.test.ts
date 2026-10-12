import { describe, it, expect } from 'vitest';
import { lines, scale } from './multiLine';

const m = (values: (number | null)[][], labels = values.map((_, i) => `L${i}`)) =>
  ({ x: values[0].map((_, i) => String(i)), lines: values.map((v, i) => ({ label: labels[i], values: v })) });
describe('multiLine', () => {
  it('a null breaks a line into runs; a lone point is a dash', () => {
    const [l] = lines(m([[1, 2, null, 3]]));
    expect(l.runs).toHaveLength(2);
    expect(l.runs[1].split(' ')).toHaveLength(2);
  });
  it('categorical slots in order; Other muted', () =>
    expect(lines(m([[1, 2], [2, 3], [3, 4]], ['A', 'Other', 'B'])).map((l) => l.color)).toEqual(
      ['var(--series-1)', 'var(--series-other)', 'var(--series-2)']));
  it('scale: the zero line only when the range crosses 0', () => {
    expect(scale(m([[-1, 1]])).zero).toBeCloseTo(20);
    expect(scale(m([[1, 2]])).zero).toBeNull();
  });
  it('empty or all-null: a flat 0 range, no Infinity', () => {
    expect(scale({ x: [], lines: [] })).toEqual({ lo: 0, hi: 0, zero: null });
    expect(scale(m([[null, null]]))).toEqual({ lo: 0, hi: 0, zero: null });
    expect(lines(m([[null, null]]))[0].runs).toEqual([]);
  });
});
