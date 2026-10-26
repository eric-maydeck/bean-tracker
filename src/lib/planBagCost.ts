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
