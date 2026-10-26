// One-time backfill rules: which existing bags were likely subscription deliveries
// (spec: docs/superpowers/specs/2026-10-25-insights-buying-backlog-design.md "Subscription link").
// No $lib imports so plain `node` can load it.
export const normRoaster = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const sameRoaster = (a: string, b: string): boolean => {
  const x = normRoaster(a), y = normRoaster(b);
  return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
};

export interface CandBag { id: number; slug: string; roaster: string; name: string; cost: number | null; amountG: number | null; added: string; subscriptionId: number | null }
export interface CandPlan { id: number; name: string; roaster: string }
// planId / planRoaster: the first matched plan (plans.length > 1 means the controller picks one), for the data migration that links the confirmed slugs.
export interface Delivery { date: string; roaster: string; planId: number; planRoaster: string; plans: CandPlan[]; bags: CandBag[] }
export interface Other { planId: number; planRoaster: string; plans: CandPlan[]; bag: CandBag }

export function subscriptionCandidates(bags: readonly CandBag[], plans: readonly CandPlan[]): { likely: Delivery[]; other: Other[] } {
  const groups = new Map<string, Delivery>();
  for (const bag of bags) {
    if (bag.subscriptionId !== null) continue;
    const matched = plans.filter((p) => sameRoaster(bag.roaster, p.roaster));
    if (!matched.length) continue;
    // Group by the plan's roaster, so differently spelled bag roasters land together.
    const key = `${normRoaster(matched[0].roaster)}|${bag.added}`;
    const g = groups.get(key) ?? { date: bag.added, roaster: bag.roaster, planId: matched[0].id, planRoaster: matched[0].roaster, plans: [], bags: [] };
    for (const m of matched) if (!g.plans.some((p) => p.id === m.id)) g.plans.push(m); // merge across the group's bags
    g.bags.push(bag);
    groups.set(key, g);
  }
  const likely: Delivery[] = [], other: Other[] = [];
  for (const g of groups.values()) {
    const count = new Map<number, number>();
    for (const b of g.bags) if (b.cost && b.cost > 0) count.set(b.cost, (count.get(b.cost) ?? 0) + 1);
    if ([...count.values()].some((n) => n >= 2)) likely.push(g);
    else for (const bag of g.bags) other.push({ planId: g.planId, planRoaster: g.planRoaster, plans: g.plans, bag });
  }
  likely.sort((a, b) => b.date.localeCompare(a.date));
  other.sort((a, b) => b.bag.added.localeCompare(a.bag.added));
  return { likely, other };
}
