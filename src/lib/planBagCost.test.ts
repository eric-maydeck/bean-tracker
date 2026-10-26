import { describe, it, expect } from 'vitest';
import { planBagCost, costAfterPlanChange, type CostMemo } from './planBagCost';

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

describe('costAfterPlanChange', () => {
  const a = { price: 60, bag_count: 4 }; // 15
  const b = { price: 66, bag_count: 3 }; // 22
  it('fill from empty, then None, clears the box', () => {
    const r = costAfterPlanChange(null, '', a);
    expect(r.cost).toBe('15');
    expect(costAfterPlanChange(r.memo, '15', null).cost).toBe('');
  });
  it('fill over 20.00, then None, restores 20.00', () => {
    const r = costAfterPlanChange(null, '20.00', a);
    expect(costAfterPlanChange(r.memo, r.cost!, null).cost).toBe('20.00');
  });
  it('A then B then None restores the original', () => {
    const r1 = costAfterPlanChange(null, '20', a);
    const r2 = costAfterPlanChange(r1.memo, r1.cost!, b);
    expect(r2.cost).toBe('22');
    expect(costAfterPlanChange(r2.memo, '22', null).cost).toBe('20');
  });
  it('a cost typed between two fills becomes the new original', () => {
    const r1 = costAfterPlanChange(null, '20', a);
    const r2 = costAfterPlanChange(r1.memo, '18', b);
    expect(costAfterPlanChange(r2.memo, r2.cost!, null).cost).toBe('18');
  });
  it('leaves a cost the user edited after the fill', () => {
    const r = costAfterPlanChange(null, '20', a);
    expect(costAfterPlanChange(r.memo, '18', null).cost).toBeNull();
  });
  it('None with no prior fill changes nothing; a plan with no cost fills nothing', () => {
    expect(costAfterPlanChange(null, '20', null).cost).toBeNull();
    const memo: CostMemo = { original: '20', lastFilled: '15' };
    expect(costAfterPlanChange(memo, '15', { price: 5, bag_count: 0 })).toEqual({ cost: null, memo });
  });
});
