import { describe, expect, it } from 'vitest';
import { normRoaster, sameRoaster, subscriptionCandidates, type CandBag, type CandPlan } from './subscriptionBackfill';

let n = 0;
const bag = (roaster: string, added: string, cost: number | null, over: Partial<CandBag> = {}): CandBag =>
  ({ id: ++n, slug: `b${n}`, roaster, name: `Bag ${n}`, cost, amountG: 63, added, subscriptionId: null, ...over });
const plans: CandPlan[] = [{ id: 1, name: 'Shoebox', roaster: 'Shoebox' }, { id: 2, name: 'H&S', roaster: 'H&S' }];

describe('sameRoaster', () => {
  it('matches whole-word prefixes and case', () => {
    expect(normRoaster('H&S Coffee Roasters')).toBe('h s coffee roasters');
    expect(sameRoaster('H&S', 'H&S Coffee Roasters')).toBe(true);
    expect(sameRoaster('Shoebox', 'Shoebox Coffee Roaster')).toBe(true);
    expect(sameRoaster('norml coffee ppl', 'norml')).toBe(true);
    expect(sameRoaster('Ceto', 'ceto')).toBe(true);
    expect(sameRoaster('Sey', 'Seymour Coffee')).toBe(false);
  });
});

describe('subscriptionCandidates', () => {
  it('groups the Kamwangi delivery and ignores the non-plan split', () => {
    const k = bag('Shoebox Coffee Roaster', '2026-09-18', 14.5, { amountG: 125 });
    const { likely, other } = subscriptionCandidates(
      [k, bag('Shoebox', '2026-09-18', 7.25), bag('Shoebox', '2026-09-18', 7.25), bag('Aviary', '2026-09-18', 34, { amountG: 200 }), bag('Aviary', '2026-09-18', 34, { amountG: 200 })], plans);
    expect(likely).toHaveLength(1);
    expect(likely[0]).toMatchObject({ date: '2026-09-18', planId: 1, planRoaster: 'Shoebox' });
    expect(likely[0].bags).toHaveLength(3);
    expect(likely[0].bags).toContain(k);
    expect(other).toEqual([]);
  });
  it('puts a lone bag in other and skips linked bags', () => {
    const lone = bag('Shoebox', '2026-08-01', 7);
    const { likely, other } = subscriptionCandidates([lone, bag('Shoebox', '2026-08-02', 7, { subscriptionId: 1 })], plans);
    expect(likely).toEqual([]);
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({ bag: lone, planId: 1, planRoaster: 'Shoebox' });
  });
  it('keeps different prices or $0 prices out of likely', () => {
    const { likely, other } = subscriptionCandidates(
      [bag('H&S', '2026-07-01', 10), bag('H&S', '2026-07-01', 12), bag('H&S', '2026-07-02', 0), bag('H&S', '2026-07-02', 0)], plans);
    expect(likely).toEqual([]);
    expect(other).toHaveLength(4);
  });
  it('groups differently spelled roasters of one plan together, newest first', () => {
    const { likely } = subscriptionCandidates(
      [bag('H&S', '2026-06-01', 9), bag('H&S Coffee Roasters', '2026-06-01', 9), bag('Shoebox', '2026-07-01', 5), bag('Shoebox', '2026-07-01', 5)], plans);
    expect(likely.map((d) => d.planRoaster)).toEqual(['Shoebox', 'H&S']);
    expect(likely[1].bags).toHaveLength(2);
  });
  it('merges every matched plan when a roaster matches more than one', () => {
    const two: CandPlan[] = [{ id: 5, name: 'A', roaster: 'H&S' }, { id: 6, name: 'B', roaster: 'H&S Coffee' }];
    const { likely } = subscriptionCandidates([bag('H&S', '2026-05-01', 9), bag('H&S Coffee Roasters', '2026-05-01', 9)], two);
    expect(likely).toHaveLength(1);
    expect(likely[0].planId).toBe(5);
    expect(likely[0].plans.map((p) => p.id)).toEqual([5, 6]);
  });
  it('treats a null cost as unpriced', () => {
    const { likely, other } = subscriptionCandidates([bag('Shoebox', '2026-05-01', null), bag('Shoebox', '2026-05-01', null)], plans);
    expect(likely).toEqual([]);
    expect(other).toHaveLength(2);
  });
});
