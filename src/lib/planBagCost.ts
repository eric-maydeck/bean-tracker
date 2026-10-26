// One plan as the coffee form's Subscription select needs it.
export interface SubscriptionOption {
  id: number;
  label: string;
  paused: boolean;
  price: number | null;
  bag_count: number | null;
}

// Per-bag price of a plan (price / bags, cents), or null when it can't be told.
export function planBagCost(plan: Pick<SubscriptionOption, 'price' | 'bag_count'>): number | null {
  if (plan.price == null || !plan.bag_count || plan.bag_count <= 0) return null;
  return Math.round((plan.price / plan.bag_count) * 100) / 100;
}

// What the Cost box held before the first plan fill, and what that fill wrote (input strings).
export interface CostMemo {
  original: string;
  lastFilled: string;
}

// Cost after the Subscription select changes. `cost` null = leave the box alone. A plan fills it
// (remembering the first original); None puts the original back only while the box still holds the fill.
export function costAfterPlanChange(
  memo: CostMemo | null,
  current: string,
  plan: Pick<SubscriptionOption, 'price' | 'bag_count'> | null
): { cost: string | null; memo: CostMemo | null } {
  if (plan) {
    const filled = planBagCost(plan);
    if (filled == null) return { cost: null, memo };
    return { cost: String(filled), memo: { original: memo?.original ?? current, lastFilled: String(filled) } };
  }
  return { cost: memo && current === memo.lastFilled ? memo.original : null, memo: null };
}
