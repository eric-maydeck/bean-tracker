import { describe, expect, it } from 'vitest';
import { rowSizes, rowVars } from './rows';

describe('rowSizes', () => {
  it('spreads cards evenly over the fewest rows, fuller rows first', () => {
    expect(rowSizes(13, 4)).toEqual([4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(rowSizes(5, 4)).toEqual([3, 3, 3, 2, 2]);
    expect(rowSizes(8, 4)).toEqual(Array(8).fill(4));
    expect(rowSizes(7, 2)).toEqual([3, 3, 3, 2, 2, 2, 2]);
    expect(rowSizes(3, 2)).toEqual([3, 3, 3]);
    expect(rowSizes(1, 3)).toEqual([1]);
    expect(rowSizes(0, 3)).toEqual([]);
  });
  it('five cards on a very wide grid make one row', () => {
    expect(rowVars(5)[0]).toBe('--q5:5;--q4:3;--q3:3;--q2:3');
    expect(rowVars(4)[0]).toBe('--q5:4;--q4:4;--q3:2;--q2:2');
  });
});
