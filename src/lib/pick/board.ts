import { seededRandom, shuffled } from './random';
import type { PickCoffee, PickRules, Slot } from './types';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Coffee index for the i-th assigned slot under `snake` (0..k-1, k-2..1, repeat). */
function snakeIndex(i: number, k: number): number {
  if (k === 1) return 0;
  const p = i % (2 * k - 2);
  return p < k ? p : 2 * k - 2 - p;
}

/** The D20 board: always 20 slots numbered 1..20. */
export function fillBoard(pool: PickCoffee[], rules: PickRules, hasSuccess: boolean, hasFail: boolean, seed: string): Slot[] {
  const rnd = seededRandom(seed);
  const slots = new Map<number, Slot>();
  if (hasSuccess) slots.set(20, { n: 20, kind: 'success' });
  if (hasFail) slots.set(1, { n: 1, kind: 'fail' });
  let fillable = range(1, 20).filter((n) => !slots.has(n));
  if (!rules.fillEnds) {
    for (const n of [1, 20]) if (fillable.includes(n)) slots.set(n, { n, kind: 'crossed' });
    fillable = fillable.filter((n) => n !== 1 && n !== 20);
  }
  const all = range(1, 20);
  const even = fillable.filter((n) => n % 2 === 0);
  const odd = fillable.filter((n) => n % 2 === 1);
  const order =
    rules.iteration === 'desc' ? [...fillable].reverse()
    : rules.iteration === 'evens' ? [...even, ...odd]
    : rules.iteration === 'odds' ? [...odd, ...even]
    : rules.iteration === 'random' ? shuffled(fillable, rnd)
    : fillable;

  const k = pool.length;
  if (k > 0) {
    let ids = order.map((_, i) => pool[rules.fill === 'snake' ? snakeIndex(i, k) : i % k].id);
    if (rules.fill === 'shuffle') ids = shuffled(ids, rnd);
    order.forEach((n, i) => {
      slots.set(n, rules.fill === 'cross' && i >= k ? { n, kind: 'crossed' } : { n, kind: 'coffee', coffeeId: ids[i] });
    });
  }
  return all.map((n) => slots.get(n) ?? { n, kind: 'crossed' });
}
