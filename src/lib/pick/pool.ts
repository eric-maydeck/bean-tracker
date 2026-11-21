import type { PickCoffee, PickRules } from './types';

const CAP = 20;

/** Bags of one coffee (same name and roaster, ignoring case and outer whitespace) are one entry in Pick for me. */
export const keyOf = (c: PickCoffee) => `${c.name.trim().toLowerCase()}\u0000${c.roaster.trim().toLowerCase()}`;
type Key = (c: PickCoffee) => string;
/** With grouping off every bag is its own entry. */
const keyFor = (rules: Pick<PickRules, 'groupBags'>): Key => (rules.groupBags ? keyOf : (c) => String(c.id));

const CAT_RANK: Record<PickCoffee['category'], number> = { open: 0, backlog: 1, frozen: 2 };
const started = (c: PickCoffee) => c.info?.gramsLeft != null && c.info.amountG != null && c.info.gramsLeft < c.info.amountG;
const gramsIn = (c: PickCoffee) => c.info?.gramsLeft ?? c.info?.amountG ?? Infinity;
/** Which bag stands for its coffee (negative = a): open before backlog before frozen, then more urgent, then already started, then fewer grams in the bag. */
export const standIn = (a: PickCoffee, b: PickCoffee) =>
  CAT_RANK[a.category] - CAT_RANK[b.category] || (b.urgency ?? -Infinity) - (a.urgency ?? -Infinity) || +started(b) - +started(a) || gramsIn(a) - gramsIn(b) || 0;
/** The stand-in bag of each key. */
const onePerCoffee = (list: PickCoffee[], key: Key) => {
  const best = new Map<string, PickCoffee>();
  for (const c of list) { const b = best.get(key(c)); if (!b || standIn(c, b) < 0) best.set(key(c), c); }
  return best;
};

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

/** Out for today is per entry: grouped, every bag of a coffee that has a bag out is out (Discard removes the coffee, another bag does not stand in). */
const outKeysOf = (coffees: PickCoffee[], out: Set<number>, key: Key) => new Set(coffees.filter((c) => out.has(c.id)).map(key));

export function buildPool(
  coffees: PickCoffee[],
  rules: PickRules,
  out: Set<number>
): { pool: PickCoffee[]; sittingOut: PickCoffee[] } {
  const key = keyFor(rules);
  const chosen = new Set(specificIds(rules));
  // a coffee chosen as a specific crit leaves the normal pool with all its bags
  const critKeys = new Set(coffees.filter((c) => chosen.has(c.id)).map(key));
  const outKeys = outKeysOf(coffees, out, key);
  // includeFrozenDecaf only matters when Frozen is selected and decaf is included
  const skipFrozenDecaf = !rules.includeFrozenDecaf && rules.categories.includes('frozen') && rules.includeDecaf;
  let list = coffees
    .filter((c) => rules.categories.includes(c.category))
    .filter((c) => (c.decaf ? rules.includeDecaf && !(skipFrozenDecaf && c.category === 'frozen') : true))
    .filter((c) => !critKeys.has(key(c)) && !outKeys.has(key(c)));
  if (rules.over20 === 'byHand') {
    // the Excluded list shows one row per coffee, so excluding a bag excludes every bag of it
    const skip = new Set(coffees.filter((c) => rules.excluded.includes(c.id)).map(key));
    list = list.filter((c) => !skip.has(key(c)));
  }
  // the stand-in bag takes the coffee's number; its other bags take none and count toward no cap
  list = [...onePerCoffee(list, key).values()].sort(sorter(rules));
  return { pool: list.slice(0, CAP), sittingOut: list.slice(CAP) };
}

/** The crit coffees still in play, one per chosen entry in `ids` order (its stand-in bag); an entry that is out for today is dropped. */
export function critPool(coffees: PickCoffee[], ids: number[], out: Set<number>, rules: Pick<PickRules, 'groupBags'> = { groupBags: true }): PickCoffee[] {
  const key = keyFor(rules);
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const keys = [...new Set(ids.flatMap((id) => byId.get(id) ?? []).map(key))];
  const outKeys = outKeysOf(coffees, out, key);
  const live = onePerCoffee(coffees.filter((c) => !outKeys.has(key(c))), key);
  return keys.flatMap((k) => live.get(k) ?? []);
}

/**
 * The pool and both crits for a day. Specific crits come from their chosen coffees; spot crits take the coffee in
 * #1 (fail) and #20 (success) of the sorted pool, or the last coffee when fewer than 20 and `highestIsCrit`.
 * Spot crits need at least 3 coffees, so a normal slot is always left; a spot-crit coffee leaves the normal pool.
 */
export function resolveCrits(coffees: PickCoffee[], rules: PickRules, out: Set<number>): { pool: PickCoffee[]; sittingOut: PickCoffee[]; success: PickCoffee[]; fail: PickCoffee[] } {
  const { pool, sittingOut } = buildPool(coffees, rules, out);
  const specific = (on: boolean, mode: PickRules['critFailMode'], ids: number[]) => (on && mode === 'specific' ? critPool(coffees, ids, out, rules) : []);
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
