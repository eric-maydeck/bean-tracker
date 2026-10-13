import { describe, expect, it } from 'vitest';
import { rowSizes, rowVars, sizedGrid } from './rows';

describe('rowSizes', () => {
  it('spreads cards evenly over the fewest rows, fuller rows first', () => {
    expect(rowSizes(13, 4)).toEqual([4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(rowSizes(5, 4)).toEqual([3, 3, 3, 2, 2]);
    expect(rowSizes(8, 4)).toEqual(Array(8).fill(4));
  });
  it('phones (2 columns): never 3 in a row; an odd count ends in one full-width card (T5)', () => {
    expect(rowSizes(7, 2)).toEqual([2, 2, 2, 2, 2, 2, 1]);
    expect(rowSizes(3, 2)).toEqual([2, 2, 1]);
    expect(rowSizes(4, 2)).toEqual([2, 2, 2, 2]);
    expect(rowSizes(1, 2)).toEqual([1]);
    expect(rowSizes(1, 3)).toEqual([1]);
    expect(rowSizes(0, 3)).toEqual([]);
  });
  it('five cards on a very wide grid make one row', () => {
    expect(rowVars(5)[0]).toBe('--q5:5;--q4:3;--q3:3;--q2:2');
    expect(rowVars(4)[0]).toBe('--q5:4;--q4:4;--q3:2;--q2:2');
  });
});

describe('sizedGrid', () => {
  const big = (x: string) => x.startsWith('L');
  it('packs each class into its own rows, the strongest card’s class first, order kept', () => {
    const g = sizedGrid(['s1', 'L1', 's2', 'L2', 's3', 'L3', 's4', 'L4', 's5', 'L5', 's6', 's7', 'L6', 'L7', 'L8', 'L9', 'L10'], big);
    expect(g.map((x) => x.item).join()).toBe('s1,s2,s3,s4,s5,s6,s7,L1,L2,L3,L4,L5,L6,L7,L8,L9,L10');
    expect(g[0].size).toBe('s');
    expect(g[0].style).toBe('--q5:4;--q4:4;--q3:3;--q2:2;--h5:var(--fs-s4);--h4:var(--fs-s4);--h3:var(--fs-3);--h2:var(--fs-s2)');
    expect(g[6].style).toContain('--q2:1;'); // the 7th small card spans a phone row
    expect(g[4].style).toContain('--h4:var(--fs-3)'); // 7 small at 4 across: 4 + 3
    expect(g[6].style).toContain('--h2:var(--fs-s2)');
    expect(g[7].style).toContain('--h4:var(--fs-l4)'); // 10 large: 4 + 3 + 3
    expect(g[16].style).toContain('--h4:var(--fs-3)');
    expect(sizedGrid(['L1', 's1'], big)[0].item).toBe('L1');
  });
  it('a class of one card makes every card LARGE (no lone card, no squeezed chart)', () => {
    const g = sizedGrid(['s1', 's2', 'L1', 's3'], big);
    expect(g.map((x) => x.size).join()).toBe('l,l,l,l');
    expect(g.map((x) => x.item).join()).toBe('s1,s2,L1,s3');
    expect(sizedGrid(['s1'], big)[0].style).toContain('--h4:var(--fs-s2)');
    expect(sizedGrid([], big)).toEqual([]);
  });
  it('five of a class make one row of 5 on a very wide grid, sized like a row of 4', () => {
    expect(sizedGrid(['L1', 'L2', 'L3', 'L4', 'L5'], big)[0].style).toContain('--h5:var(--fs-l4);--h4:var(--fs-3)');
  });
});
