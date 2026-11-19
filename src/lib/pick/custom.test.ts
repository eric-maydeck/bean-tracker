import { describe, expect, it } from 'vitest';
import { resolveCrits } from './pool';
import { customCoffees, customId, customRules, tidyList } from './custom';
import { DEFAULT_RULES } from './rules';

describe('tidyList', () => {
  it('splits on newlines and commas, trims, drops blanks and case-insensitive repeats (first kept)', () => {
    expect(tidyList(' Ethiopia , kenya\n\n  ETHIOPIA\r\nBrazil,,').names).toEqual(['Ethiopia', 'kenya', 'Brazil']);
    expect(tidyList('').names).toEqual([]);
  });
  it('cuts names to 80 characters and the list to 100', () => {
    expect(tidyList('x'.repeat(200)).names[0]).toHaveLength(80);
    const t = tidyList(Array.from({ length: 130 }, (_, i) => `c${i}`).join('\n'));
    expect(t.names).toHaveLength(100);
    expect(t.names[99]).toBe('c99');
    expect(t.cut).toBe(true);
    expect(tidyList(Array.from({ length: 100 }, (_, i) => `c${i}`).join('\n')).cut).toBe(false);
  });
});

describe('customCoffees', () => {
  it('ids are stable negative integers by lowercased name, whatever else is in the list', () => {
    expect(customId('Kenya')).toBe(customId('kenya'));
    expect(customId('Kenya')).toBeLessThan(0);
    expect(Number.isInteger(customId('Kenya'))).toBe(true);
    expect(customCoffees(['A', 'Kenya'])[1].id).toBe(customCoffees(['Kenya'])[0].id);
    expect(customId('a')).not.toBe(customId('b'));
  });
  it('urgency counts down the list; open, not decaf', () => {
    const cs = customCoffees(['a', 'b', 'c']);
    expect(cs.map((c) => c.urgency)).toEqual([3, 2, 1]);
    expect(cs.every((c) => c.category === 'open' && !c.decaf && c.slug === '' && c.roaster === '')).toBe(true);
  });
});

describe('the custom pool', () => {
  const coffees = customCoffees(['first', 'second', 'third', 'fourth']);
  it('ignores categories and decaf rules, and plays in list order', () => {
    const odd = { ...DEFAULT_RULES, categories: [], includeDecaf: false, sort: 'category' as const };
    const r = resolveCrits(coffees, customRules(odd), new Set());
    expect(r.fail.map((c) => c.name)).toEqual(['first']); // #1
    expect(r.pool.map((c) => c.name)).toEqual(['second', 'third']);
    expect(r.success.map((c) => c.name)).toEqual(['fourth']); // highest is crit success
  });
  it('reverse list order for urgency-asc', () => {
    const r = resolveCrits(coffees, customRules({ ...DEFAULT_RULES, sort: 'urgency-asc', critFailOn: false, critSuccessOn: false }), new Set());
    expect(r.pool.map((c) => c.name)).toEqual(['fourth', 'third', 'second', 'first']);
  });
});
