import { describe, it, expect } from 'vitest';
import { assignCols, sortAgitation, sortContact } from './pourCols';

describe('words table band order', () => {
  it('agitation: High, Medium, Low, sequences, Mixed, Mixed (other)', () =>
    expect(sortAgitation(['Mixed (other)', 'Low', 'Low then High', 'High then Low', 'Medium', 'High', 'Mixed', 'High'])).toEqual(
      ['High', 'Medium', 'Low', 'Mixed', 'High then Low', 'Low then High', 'Mixed (other)']));
  it('contact: ascending by the first time, whatever order they were first seen', () =>
    expect(sortContact(['4:30+', '1:30–1:59', '< 1:30', '3:00–3:29', '2:00–2:29'])).toEqual(['< 1:30', '1:30–1:59', '2:00–2:29', '3:00–3:29', '4:30+']));
});

describe('assignCols', () => {
  const H: Record<string, number> = { a: 300, b: 300, c: 100, d: 100, e: 200 };
  const split = (ids: string[]) => assignCols(ids, (id) => H[id]);
  const total = (c: string[]) => c.reduce((s, id) => s + H[id] + 12, 0);
  it('balances heights: no split is closer', () => {
    const [x, y] = split(['a', 'b', 'c', 'd', 'e']);
    expect([...x, ...y].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(Math.abs(total(x) - total(y))).toBeLessThanOrEqual(12);
  });
  it('equal cards go left, right, left, right (reading order)', () =>
    expect(assignCols(['a', 'b', 'c', 'd'], () => 100)).toEqual([['a', 'c'], ['b', 'd']]));
  it('one card, none', () => {
    expect(assignCols(['a'], () => 100)).toEqual([['a'], []]);
    expect(assignCols([], () => 100)).toEqual([[], []]);
  });
  it('keeps each column in reading order', () => {
    const [x, y] = split(['a', 'b', 'c', 'd', 'e']);
    for (const c of [x, y]) expect(c).toEqual([...c].sort());
  });
});
