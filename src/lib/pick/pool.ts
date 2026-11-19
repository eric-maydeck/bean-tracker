import type { PickCoffee, PickRules } from './types';

const CAP = 20;

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

export function buildPool(
  coffees: PickCoffee[],
  rules: PickRules,
  out: Set<number>
): { pool: PickCoffee[]; sittingOut: PickCoffee[] } {
  const crit = new Set([...rules.critSuccess, ...rules.critFail]);
  // includeFrozenDecaf only matters when Frozen is selected and decaf is included
  const skipFrozenDecaf = !rules.includeFrozenDecaf && rules.categories.includes('frozen') && rules.includeDecaf;
  let list = coffees
    .filter((c) => rules.categories.includes(c.category))
    .filter((c) => (c.decaf ? rules.includeDecaf && !(skipFrozenDecaf && c.category === 'frozen') : true))
    .filter((c) => !crit.has(c.id) && !out.has(c.id))
    .sort(sorter(rules));
  if (rules.over20 === 'byHand') list = list.filter((c) => !rules.excluded.includes(c.id));
  return { pool: list.slice(0, CAP), sittingOut: list.slice(CAP) };
}

/** The crit coffees still in play, in `ids` order; unknown and out ids dropped. */
export function critPool(coffees: PickCoffee[], ids: number[], out: Set<number>): PickCoffee[] {
  const byId = new Map(coffees.map((c) => [c.id, c]));
  return ids.filter((id) => !out.has(id)).flatMap((id) => byId.get(id) ?? []);
}
