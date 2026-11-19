import type { PickCoffee, PickRules } from './types';

const CAP = 20;

/** Bags of one coffee (same name and roaster, ignoring case and outer whitespace) are one entry in Pick for me. */
export const keyOf = (c: PickCoffee) => `${c.name.trim().toLowerCase()}\u0000${c.roaster.trim().toLowerCase()}`;
/** The first of each key, in order. */
const onePerCoffee = (list: PickCoffee[]) => { const seen = new Set<string>(); return list.filter((c) => { const k = keyOf(c); return !seen.has(k) && !!seen.add(k); }); };

function sorter(rules: PickRules): (a: PickCoffee, b: PickCoffee) => number {
  const byName = (a: PickCoffee, b: PickCoffee) => a.name.localeCompare(b.name);
  // null urgency sorts last in both directions
  const urg = (dir: 1 | -1) => (a: PickCoffee, b: PickCoffee) => {
    if (a.urgency === b.urgency) return byName(a, b);
    if (a.urgency === null) return 1;
    if (b.urgency === null) return -1;
    return dir * (a.urgency - b.urgency) || byName(a, b);
  };
  switch (rules.sort) {
    case 'urgency-asc': return urg(1);
    case 'name': return byName;
    case 'category': {
      const grp = (c: PickCoffee) => rules.categoryOrder.indexOf(c.decaf ? 'decaf' : c.category);
      const u = urg(-1);
      return (a, b) => grp(a) - grp(b) || u(a, b);
    }
    default: return urg(-1);
  }
}

/** The coffee ids held by crits in 'specific' mode (enabled ones only). */
const specificIds = (rules: PickRules): number[] => [
  ...(rules.critSuccessOn && rules.critSuccessMode === 'specific' ? rules.critSuccess : []),
  ...(rules.critFailOn && rules.critFailMode === 'specific' ? rules.critFail : [])
];

/** Out for today is per coffee: every bag of a coffee that has a bag out is out (Discard removes the coffee, another bag does not stand in). */
const outKeysOf = (coffees: PickCoffee[], out: Set<number>) => new Set(coffees.filter((c) => out.has(c.id)).map(keyOf));

export function buildPool(
  coffees: PickCoffee[],
  rules: PickRules,
  out: Set<number>
): { pool: PickCoffee[]; sittingOut: PickCoffee[] } {
  const chosen = new Set(specificIds(rules));
  // a coffee chosen as a specific crit leaves the normal pool with all its bags
  const critKeys = new Set(coffees.filter((c) => chosen.has(c.id)).map(keyOf));
  const outKeys = outKeysOf(coffees, out);
  // includeFrozenDecaf only matters when Frozen is selected and decaf is included
  const skipFrozenDecaf = !rules.includeFrozenDecaf && rules.categories.includes('frozen') && rules.includeDecaf;
  let list = coffees
    .filter((c) => rules.categories.includes(c.category))
    .filter((c) => (c.decaf ? rules.includeDecaf && !(skipFrozenDecaf && c.category === 'frozen') : true))
    .filter((c) => !critKeys.has(keyOf(c)) && !outKeys.has(keyOf(c)))
    .sort(sorter(rules));
  if (rules.over20 === 'byHand') {
    // the Excluded list shows one row per coffee, so excluding a bag excludes every bag of it
    const skip = new Set(coffees.filter((c) => rules.excluded.includes(c.id)).map(keyOf));
    list = list.filter((c) => !skip.has(keyOf(c)));
  }
  list = onePerCoffee(list); // the most urgent bag (the sort order) stands for the coffee: later bags take no number, count toward no cap
  return { pool: list.slice(0, CAP), sittingOut: list.slice(CAP) };
}

/** The crit coffees still in play, one per chosen coffee in `ids` order (its most urgent bag); a coffee that is out for today is dropped. */
export function critPool(coffees: PickCoffee[], ids: number[], out: Set<number>): PickCoffee[] {
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const keys = [...new Set(ids.flatMap((id) => byId.get(id) ?? []).map(keyOf))];
  const outKeys = outKeysOf(coffees, out);
  const live = coffees.filter((c) => !outKeys.has(keyOf(c))).sort(sorter({ sort: 'urgency-desc' } as PickRules));
  return keys.flatMap((k) => live.find((c) => keyOf(c) === k) ?? []);
}

/**
 * The pool and both crits for a day. Specific crits come from their chosen coffees; spot crits take the coffee in
 * #1 (fail) and #20 (success) of the sorted pool, or the last coffee when fewer than 20 and `highestIsCrit`.
 * Spot crits need at least 3 coffees, so a normal slot is always left; a spot-crit coffee leaves the normal pool.
 */
export function resolveCrits(coffees: PickCoffee[], rules: PickRules, out: Set<number>): { pool: PickCoffee[]; sittingOut: PickCoffee[]; success: PickCoffee[]; fail: PickCoffee[] } {
  const { pool, sittingOut } = buildPool(coffees, rules, out);
  const specific = (on: boolean, mode: PickRules['critFailMode'], ids: number[]) => (on && mode === 'specific' ? critPool(coffees, ids, out) : []);
  let success = specific(rules.critSuccessOn, rules.critSuccessMode, rules.critSuccess);
  let fail = specific(rules.critFailOn, rules.critFailMode, rules.critFail);
  let normal = pool;
  if (pool.length >= 3) {
    const wantFail = rules.critFailOn && rules.critFailMode === 'spot';
    const idx = pool.length >= CAP ? CAP - 1 : rules.highestIsCrit ? pool.length - 1 : -1;
    const wantSuccess = rules.critSuccessOn && rules.critSuccessMode === 'spot' && idx >= 0;
    if (wantFail) fail = [pool[0]];
    if (wantSuccess) success = [pool[idx]];
    normal = pool.filter((_, i) => !(wantFail && i === 0) && !(wantSuccess && i === idx));
  }
  return { pool: normal, sittingOut, success, fail };
}
