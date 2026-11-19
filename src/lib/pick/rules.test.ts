import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, parseRules, rulesDiffer } from './rules';

describe('pick rules', () => {
  it('defaults', () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES);
    expect(parseRules('junk')).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES.categories).toEqual(['open', 'backlog']);
    expect(DEFAULT_RULES.categoryOrder).toEqual(['open', 'backlog', 'frozen', 'decaf']);
  });
  it('falls back per field', () => {
    const r = parseRules({ fill: 'bogus', repeats: true });
    expect(r.repeats).toBe(true);
    expect(r.fill).toBe('wrap');
  });
  it('drops non-integer ids and unknown categories', () => {
    const r = parseRules({ categories: ['frozen', 'x'], excluded: [1, 2.5, 'a', 3] });
    expect(r.categories).toEqual(['frozen']);
    expect(r.excluded).toEqual([1, 3]);
  });
  it('categoryOrder must be a permutation of all four', () => {
    expect(parseRules({ categoryOrder: ['decaf', 'open', 'backlog', 'frozen'] }).categoryOrder).toEqual([
      'decaf', 'open', 'backlog', 'frozen'
    ]);
    expect(parseRules({ categoryOrder: ['open', 'open', 'backlog', 'frozen'] }).categoryOrder).toEqual(
      DEFAULT_RULES.categoryOrder
    );
    expect(parseRules({ categoryOrder: ['open'] }).categoryOrder).toEqual(DEFAULT_RULES.categoryOrder);
  });
  it('an id in both crits stays only in critSuccess', () => {
    const r = parseRules({ critSuccess: [5, 6], critFail: [6, 7] });
    expect(r.critSuccess).toEqual([5, 6]);
    expect(r.critFail).toEqual([7]);
  });
  it('rulesDiffer', () => {
    expect(rulesDiffer(DEFAULT_RULES, { ...DEFAULT_RULES, sort: 'name' })).toBe(true);
    expect(rulesDiffer(DEFAULT_RULES, { ...DEFAULT_RULES, excluded: [1] })).toBe(true);
    expect(rulesDiffer(DEFAULT_RULES, parseRules(null))).toBe(false);
  });
});
