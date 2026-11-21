import { describe, it, expect } from 'vitest';
import { customId } from './custom';
import { linkFor, resolveShared } from './shared';
import type { PickCoffee, Slot, WheelSlice } from './types';

const co = (id: number) => ({ id }) as PickCoffee;
const board: Slot[] = [{ n: 1, kind: 'fail' }, { n: 2, kind: 'coffee', coffeeId: 7 }, { n: 3, kind: 'crossed' }, { n: 4, kind: 'success' }];
const slices: WheelSlice[] = [{ kind: 'coffee', coffeeId: 7, a0: 0, a1: 1 }, { kind: 'success', a0: 1, a1: 2 }, { kind: 'fail', a0: 2, a1: 3 }];
const byId = new Map([7, 8, 5].map((id) => [id, co(id)]));
const ctx = (over: Partial<Parameters<typeof resolveShared>[2]> = {}) => ({ board, slices, byId, success: [co(1), co(2)], fail: [co(5)], ...over });
const first = () => 0;

describe('resolveShared with a known coffee c', () => {
  it('d20: the coffee on the link, on the link face, whatever the visitor board holds there', () => {
    expect(resolveShared('d20', { c: 8, roll: 3 }, ctx(), first)?.result).toEqual({ coffeeId: 8, via: 'normal', n: 3 }); // crossed out here
    expect(resolveShared('d20', { c: 8, roll: 14 }, ctx(), first)?.result).toEqual({ coffeeId: 8, via: 'normal', n: 14 }); // off this board
    expect(resolveShared('d20', { c: 5, roll: 20, crit: 'fail' }, ctx(), first)?.result).toEqual({ coffeeId: 5, via: 'fail', n: 20 });
  });
  it('d20 needs its face', () => expect(resolveShared('d20', { c: 8 }, ctx(), first)).toBeNull());
  it('wheel: the slice with the coffee, or the crit slice; no spin when it is not on this wheel', () => {
    expect(resolveShared('wheel', { c: 7 }, ctx(), first)).toEqual({ result: { coffeeId: 7, via: 'normal' }, slice: 0 });
    expect(resolveShared('wheel', { c: 5, crit: 'fail' }, ctx(), first)).toEqual({ result: { coffeeId: 5, via: 'fail' }, slice: 2 });
    expect(resolveShared('wheel', { c: 8 }, ctx(), first)).toEqual({ result: { coffeeId: 8, via: 'normal' }, slice: null }); // not on this wheel: straight to the result
    expect(resolveShared('wheel', { c: 8, crit: 'success' }, ctx({ slices: slices.slice(0, 1) }), first)?.slice).toBeNull(); // no crit slice here
    expect(resolveShared('wheel', { c: 8 }, ctx({ slices: [] }), first)?.slice).toBeNull();
  });
});

describe('resolveShared with a custom name', () => {
  const id = customId('Blue Bottle');
  const mine = { slices: [{ kind: 'coffee' as const, coffeeId: id, a0: 0, a1: 1 }, ...slices.slice(1)] };
  it('the name is the coffee, on the d20 face roll, on or off this list', () => {
    expect(resolveShared('d20', { name: 'Blue Bottle', roll: 4 }, ctx(), first)?.result).toEqual({ coffeeId: id, via: 'normal', n: 4 });
    expect(resolveShared('d20', { name: 'Blue Bottle', roll: 3, crit: 'fail' }, ctx(), first)?.result).toEqual({ coffeeId: id, via: 'fail', n: 3 });
    expect(resolveShared('d20', { name: 'Blue Bottle' }, ctx(), first)).toBeNull(); // no face
  });
  it('wheel: the slice with that name (any case), else straight to the result', () => {
    expect(resolveShared('wheel', { name: 'blue BOTTLE' }, ctx(mine), first)).toEqual({ result: { coffeeId: id, via: 'normal' }, slice: 0 });
    expect(resolveShared('wheel', { name: 'Other' }, ctx(mine), first)?.slice).toBeNull();
    expect(resolveShared('wheel', { name: 'Other', crit: 'success' }, ctx(mine), first)?.slice).toBe(1);
  });
});

describe('resolveShared by number (custom list, or a coffee this site no longer has)', () => {
  it('d20 face keeps n; wheel slice number gives its index', () => {
    expect(resolveShared('d20', { roll: 2 }, ctx(), first)).toEqual({ result: { coffeeId: 7, via: 'normal', n: 2 }, slice: 1 });
    expect(resolveShared('wheel', { roll: 1 }, ctx(), first)).toEqual({ result: { coffeeId: 7, via: 'normal' }, slice: 0 });
  });
  it('crit uses a pool coffee c, else random', () => {
    expect(resolveShared('d20', { roll: 4, c: 2 }, ctx({ byId: new Map() }), first)?.result).toEqual({ coffeeId: 2, via: 'success', n: 4 });
    expect(resolveShared('d20', { roll: 4, c: 99 }, ctx(), first)?.result).toEqual({ coffeeId: 1, via: 'success', n: 4 });
    expect(resolveShared('wheel', { roll: 3 }, ctx(), first)?.result).toEqual({ coffeeId: 5, via: 'fail' });
  });
  it('null when off the board, crossed out, the crit pool empty, or nothing on the link', () => {
    expect(resolveShared('d20', { roll: 20 }, ctx(), first)).toBeNull();
    expect(resolveShared('d20', { roll: 3 }, ctx(), first)).toBeNull();
    expect(resolveShared('wheel', { roll: 4 }, ctx(), first)).toBeNull();
    expect(resolveShared('d20', { roll: 4 }, ctx({ success: [] }), first)).toBeNull();
    expect(resolveShared('d20', {}, ctx(), first)).toBeNull();
    expect(resolveShared('wheel', { c: 99 }, ctx(), first)).toBeNull(); // an unknown coffee and no number
  });
});

describe('linkFor', () => {
  it('a site coffee pins c (and crit, and the d20 face)', () => {
    expect(linkFor('wheel', { coffeeId: 7, via: 'normal' }, false, 'x')).toEqual({ c: 7 });
    expect(linkFor('wheel', { coffeeId: 7, via: 'success' }, false, 'x')).toEqual({ c: 7, crit: 'success' });
    expect(linkFor('d20', { coffeeId: 7, via: 'fail', n: 1 }, false, 'x')).toEqual({ c: 7, crit: 'fail', roll: 1 });
  });
  it('a custom coffee shares its name (list-local ids never leave)', () => {
    expect(linkFor('wheel', { coffeeId: -3, via: 'normal' }, true, 'Blue Bottle')).toEqual({ name: 'Blue Bottle' });
    expect(linkFor('d20', { coffeeId: -3, via: 'success', n: 20 }, true, 'Blue Bottle')).toEqual({ name: 'Blue Bottle', crit: 'success', roll: 20 });
  });
});
