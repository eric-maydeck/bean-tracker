import { describe, expect, it } from 'vitest';
import { boardMatches, fillBoard } from './board';
import { DEFAULT_RULES } from './rules';
import type { PickCoffee, PickRules } from './types';

const coffee = (id: number): PickCoffee => ({ id, slug: `c${id}`, name: `C${id}`, roaster: 'r', image: null, fill: null, category: 'open', decaf: false, urgency: null });
const pool = (n: number) => Array.from({ length: n }, (_, i) => coffee(i));
const R = (o: Partial<PickRules> = {}): PickRules => ({ ...DEFAULT_RULES, ...o });
const ids = (b: ReturnType<typeof fillBoard>) => b.map((s) => (s.kind === 'coffee' ? s.coffeeId : s.kind));

describe('fillBoard', () => {
  it('wraps by default, 20 slots numbered 1..20', () => {
    const b = fillBoard(pool(3), R(), false, false, 's');
    expect(b.map((s) => s.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(ids(b).slice(0, 6)).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it('snake', () => expect(ids(fillBoard(pool(3), R({ fill: 'snake' }), false, false, 's')).slice(0, 7)).toEqual([0, 1, 2, 1, 0, 1, 2]));
  it('cross marks the rest crossed', () => {
    const b = ids(fillBoard(pool(3), R({ fill: 'cross' }), false, false, 's'));
    expect(b.slice(0, 3)).toEqual([0, 1, 2]);
    expect(b.slice(3).every((x) => x === 'crossed')).toBe(true);
  });
  it('desc puts first coffee on 20, evens on 2', () => {
    expect(ids(fillBoard(pool(3), R({ iteration: 'desc' }), false, false, 's'))[19]).toBe(0);
    expect(ids(fillBoard(pool(3), R({ iteration: 'evens' }), false, false, 's'))[1]).toBe(0);
  });
  it('crits take 20 and 1', () => {
    const b = ids(fillBoard(pool(3), R(), true, true, 's'));
    expect(b[19]).toBe('success');
    expect(b[0]).toBe('fail');
    expect(b[1]).toBe(0);
  });
  it('fillEnds false crosses 1 and 20', () => {
    const b = ids(fillBoard(pool(3), R({ fillEnds: false }), false, false, 's'));
    expect(b[0]).toBe('crossed');
    expect(b[19]).toBe('crossed');
    expect(b[1]).toBe(0);
  });
  it('shuffle and random are stable per seed', () => {
    for (const o of [{ fill: 'shuffle' as const }, { iteration: 'random' as const }]) {
      const a = fillBoard(pool(5), R(o), false, false, 'x');
      expect(fillBoard(pool(5), R(o), false, false, 'x')).toEqual(a);
      expect(a.every((s) => s.kind === 'coffee')).toBe(true);
    }
    expect(ids(fillBoard(pool(5), R({ fill: 'shuffle' }), false, false, 'x'))).not.toEqual(ids(fillBoard(pool(5), R(), false, false, 'x')));
  });
  it('empty pool has no coffee slots', () => {
    const b = fillBoard([], R(), true, false, 's');
    expect(b.some((s) => s.kind === 'coffee')).toBe(false);
    expect(b[19].kind).toBe('success');
    expect(b[5].kind).toBe('crossed');
  });
});

describe('boardMatches', () => {
  const a = fillBoard(pool(3), R(), true, false, 's');
  it('same coffees and crits match, even if reshuffled', () => {
    expect(boardMatches(a, fillBoard(pool(3), R({ fill: 'shuffle' }), true, false, 'other'))).toBe(true);
  });
  it('a coffee gone, or a crit gained, does not match', () => {
    expect(boardMatches(a, fillBoard(pool(2), R(), true, false, 's'))).toBe(false);
    expect(boardMatches(a, fillBoard(pool(3), R(), true, true, 's'))).toBe(false);
  });
});
