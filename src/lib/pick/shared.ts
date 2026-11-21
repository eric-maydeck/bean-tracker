import { customId } from './custom';
import type { Game, PickCoffee, PickResult, Slot, WheelSlice } from './types';

/** What a share link carries: `roll` (a d20 face, or the number of a wheel slice), `c` (a site coffee's id) or `name` (a custom list's coffee), `crit`. */
export interface SharedLink { roll?: number; c?: number; name?: string; crit?: 'success' | 'fail' }

/**
 * A share link replayed here: the result to show and, on the wheel, the slice index to spin to (null: that coffee is not on this wheel, so no spin, straight to the result),
 * or null overall when it cannot be replayed (the caller drops the link).
 * With a coffee the link names (a site coffee `c` we know, or a custom `name`) the link pins the outcome whatever this visitor's board or wheel holds: that coffee,
 * as a crit when `crit` says so, on the d20 face `roll`; the wheel spins to the slice with that coffee (the crit's slice for a crit). Without one (an archived coffee)
 * `roll` is the d20 face or slice number on this visitor's own board; a crossed-out face, or one off the board, cannot be replayed.
 */
export function resolveShared(
  game: Game, link: SharedLink, ctx: { board: Slot[]; slices: WheelSlice[]; byId: Map<number, PickCoffee>; success: PickCoffee[]; fail: PickCoffee[] }, rand = Math.random
): { result: PickResult; slice: number | null } | null {
  const { roll, c, name, crit } = link;
  const { board, slices, byId, success, fail } = ctx;
  const known = c !== undefined && byId.has(c) ? c : name ? customId(name) : undefined;
  if (known !== undefined && (game === 'wheel' || roll !== undefined)) {
    const mine = slices.findIndex((s) => (crit ? s.kind === crit : s.kind === 'coffee' && s.coffeeId === known));
    return { result: { coffeeId: known, via: crit ?? 'normal', ...(game === 'd20' ? { n: roll } : {}) }, slice: mine >= 0 ? mine : null };
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

/** The link params for a result: the coffee pins its outcome (a site coffee's `c`, a custom list's `name`, as `crit`, and a d20's face). */
export const linkFor = (game: Game, r: PickResult, custom: boolean, name: string): SharedLink => ({
  ...(custom ? { name } : { c: r.coffeeId }), ...(r.via !== 'normal' ? { crit: r.via } : {}), ...(game === 'd20' ? { roll: r.n } : {})
});
