import type { Game, PickCoffee, PickResult, Slot, WheelSlice } from './types';

/**
 * A shared link's `roll` on this visitor's board: the d20 face `n` (1-based) or the wheel's slice `n` (1-based, `slices` order).
 * A crit uses the link's coffee `c` while it is still in that crit's pool, else a random one. Null when `n` is off the board,
 * crossed out, or the crit has no coffee left (the caller then ignores the link and plays normally).
 */
export function sharedPick(game: Game, n: number, board: Slot[], slices: WheelSlice[], success: PickCoffee[], fail: PickCoffee[], c?: number, rand = Math.random): PickResult | null {
  const s = (game === 'd20' ? board : slices)[n - 1];
  if (!s || s.kind === 'crossed') return null;
  const nField = game === 'd20' ? { n } : {};
  if (s.kind === 'coffee') return s.coffeeId === undefined ? null : { coffeeId: s.coffeeId, via: 'normal', ...nField };
  const pool = s.kind === 'success' ? success : fail;
  const pick = pool.find((x) => x.id === c) ?? pool[Math.floor(rand() * pool.length)];
  return pick ? { coffeeId: pick.id, via: s.kind, ...nField } : null;
}

/** The `roll` number that replays a result here (the d20 face, or the wheel's slice position), 0 when it cannot be placed. */
export function rollNumber(game: Game, r: PickResult, slices: WheelSlice[]): number {
  if (game === 'd20') return r.n ?? 0;
  return slices.findIndex((s) => (r.via === 'normal' ? s.kind === 'coffee' && s.coffeeId === r.coffeeId : s.kind === r.via)) + 1;
}
