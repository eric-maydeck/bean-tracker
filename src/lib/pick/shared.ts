import type { Game, PickCoffee, PickResult, Slot, WheelSlice } from './types';

/** What a share link carries: `roll` (a d20 face, or the number of a custom list's wheel slice), `c` (the coffee's id, site coffees only), `crit`. */
export interface SharedLink { roll?: number; c?: number; crit?: 'success' | 'fail' }

/**
 * A share link replayed here: the result to show and, on the wheel, the slice index to spin to (null when it cannot be replayed: the caller drops the link).
 * With a coffee `c` we know (a site coffee) the link pins the outcome whatever this visitor's board or wheel holds: that coffee, as a crit when `crit` says so,
 * on the d20 face `roll`; the wheel spins to the slice with that coffee, else the crit's slice, else any slice. Without one (a custom list, or an archived coffee)
 * `roll` is the d20 face or slice number on this visitor's own board; a crossed-out face, or one off the board, cannot be replayed.
 */
export function resolveShared(
  game: Game, link: SharedLink, ctx: { board: Slot[]; slices: WheelSlice[]; byId: Map<number, PickCoffee>; success: PickCoffee[]; fail: PickCoffee[] }, rand = Math.random
): { result: PickResult; slice: number } | null {
  const { roll, c, crit } = link;
  const { board, slices, byId, success, fail } = ctx;
  if (c !== undefined && byId.has(c) && (game === 'wheel' ? slices.length > 0 : roll !== undefined)) {
    const mine = slices.findIndex((s) => (crit ? s.kind === crit : s.kind === 'coffee' && s.coffeeId === c));
    return { result: { coffeeId: c, via: crit ?? 'normal', ...(game === 'd20' ? { n: roll } : {}) }, slice: mine >= 0 ? mine : Math.floor(rand() * slices.length) };
  }
  if (roll === undefined) return null;
  const s = (game === 'd20' ? board : slices)[roll - 1];
  if (!s || s.kind === 'crossed') return null;
  const nField = game === 'd20' ? { n: roll } : {};
  if (s.kind === 'coffee') return s.coffeeId === undefined ? null : { result: { coffeeId: s.coffeeId, via: 'normal', ...nField }, slice: roll - 1 };
  const pool = s.kind === 'success' ? success : fail;
  const pick = pool.find((x) => x.id === c) ?? pool[Math.floor(rand() * pool.length)];
  return pick ? { result: { coffeeId: pick.id, via: s.kind, ...nField }, slice: roll - 1 } : null;
}

/** The link params for a result: a site coffee pins its outcome (`c`, `crit`, a d20's face); a custom list has list-local ids, so its link is the face or slice number. Undefined when a custom wheel slice is gone. */
export function linkFor(game: Game, r: PickResult, slices: WheelSlice[], custom: boolean): SharedLink | undefined {
  if (!custom) return { c: r.coffeeId, ...(r.via !== 'normal' ? { crit: r.via } : {}), ...(game === 'd20' ? { roll: r.n } : {}) };
  const roll = game === 'd20' ? (r.n ?? 0) : slices.findIndex((s) => (r.via === 'normal' ? s.kind === 'coffee' && s.coffeeId === r.coffeeId : s.kind === r.via)) + 1;
  return roll ? { roll } : undefined;
}
