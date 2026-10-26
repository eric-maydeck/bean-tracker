import { describe, it, expect } from 'vitest';
import { planBagCost } from './planBagCost';

describe('planBagCost', () => {
  it('divides the price by the bags, to cents', () => {
    expect(planBagCost({ price: 60, bag_count: 4 })).toBe(15);
    expect(planBagCost({ price: 32, bag_count: 8 })).toBe(4);
    expect(planBagCost({ price: 66, bag_count: 3 })).toBe(22);
    expect(planBagCost({ price: 10, bag_count: 3 })).toBe(3.33);
  });
  it('is null without a price or a positive bag count', () => {
    expect(planBagCost({ price: 60, bag_count: 0 })).toBeNull();
    expect(planBagCost({ price: 60, bag_count: null })).toBeNull();
    expect(planBagCost({ price: null, bag_count: 4 })).toBeNull();
  });
});
