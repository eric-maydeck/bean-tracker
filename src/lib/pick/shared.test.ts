import { describe, it, expect } from 'vitest';
import { rollNumber, sharedPick } from './shared';
import type { PickCoffee, Slot, WheelSlice } from './types';

const co = (id: number) => ({ id }) as PickCoffee;
const board: Slot[] = [{ n: 1, kind: 'fail' }, { n: 2, kind: 'coffee', coffeeId: 7 }, { n: 3, kind: 'crossed' }, { n: 4, kind: 'success' }];
const slices: WheelSlice[] = [{ kind: 'coffee', coffeeId: 7, a0: 0, a1: 1 }, { kind: 'success', a0: 1, a1: 2 }, { kind: 'fail', a0: 2, a1: 3 }];
const first = () => 0;

describe('sharedPick', () => {
  it('d20 normal face keeps n', () => expect(sharedPick('d20', 2, board, slices, [], [], undefined, first)).toEqual({ coffeeId: 7, via: 'normal', n: 2 }));
  it('wheel slice number, no n', () => expect(sharedPick('wheel', 1, board, slices, [], [])).toEqual({ coffeeId: 7, via: 'normal' }));
  it('crit uses c while it is in the pool, else random', () => {
    expect(sharedPick('d20', 4, board, slices, [co(1), co(2)], [], 2, first)).toEqual({ coffeeId: 2, via: 'success', n: 4 });
    expect(sharedPick('d20', 4, board, slices, [co(1), co(2)], [], 9, first)).toEqual({ coffeeId: 1, via: 'success', n: 4 });
    expect(sharedPick('wheel', 3, board, slices, [], [co(5)])).toEqual({ coffeeId: 5, via: 'fail' });
  });
  it('null when off the board, crossed out or the crit pool is empty', () => {
    expect(sharedPick('d20', 20, board, slices, [], [])).toBeNull();
    expect(sharedPick('d20', 3, board, slices, [], [])).toBeNull();
    expect(sharedPick('wheel', 4, board, slices, [], [])).toBeNull();
    expect(sharedPick('d20', 1, board, slices, [], [])).toBeNull();
  });
});

describe('rollNumber', () => {
  it('d20 is its face, the wheel its slice position', () => {
    expect(rollNumber('d20', { coffeeId: 7, via: 'normal', n: 2 }, slices)).toBe(2);
    expect(rollNumber('wheel', { coffeeId: 7, via: 'normal' }, slices)).toBe(1);
    expect(rollNumber('wheel', { coffeeId: 3, via: 'success' }, slices)).toBe(2);
    expect(rollNumber('wheel', { coffeeId: 99, via: 'normal' }, slices)).toBe(0);
  });
});
