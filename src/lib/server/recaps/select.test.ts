import { describe, it, expect } from 'vitest';
import { FACT_SLOTS, order, select, theme, tonesFor } from './select';
import type { Category, FactResult } from './types';

const facts = (rows: [string, Category, number][]) => rows.map(([id, category, score]) => ({ id, category, score }) as FactResult);
const cats: Category[] = ['amounts', 'habits', 'coffees', 'brewing', 'money'];
const manyFacts = (n: number) => facts([['total', 'amounts', 0], ...Array.from({ length: n }, (_, i): [string, Category, number] => [`f${i}`, cats[i % 5], 1 - i / 100])]);
const ids = ['total', ...Array.from({ length: 11 }, (_, i) => `f${i}`)];

describe('select', () => {
  it('total always first; at most 3 per category; top scores win', () => {
    const r = select(facts([['total', 'amounts', 0], ['a', 'coffees', .9], ['b', 'coffees', .8], ['c', 'coffees', .7], ['d', 'coffees', .95], ['e', 'habits', .1]]));
    expect(r[0]).toBe('total');
    expect(r.filter((id) => 'abcd'.includes(id))).toEqual(['d', 'a', 'b']);
    expect(r).toContain('e');
  });
  it('total counts toward amounts', () => {
    const r = select(facts([['total', 'amounts', 0], ['a', 'amounts', .9], ['b', 'amounts', .8], ['c', 'amounts', .7]]));
    expect(r).toEqual(['total', 'a', 'b']);
  });
  it('caps at FACT_SLOTS', () => { expect(select(manyFacts(30))).toHaveLength(FACT_SLOTS); });
  it('order and theme are stable per year and differ between years', () => {
    expect(order(ids, 2026)).toEqual(order(ids, 2026));
    expect(order(ids, 2026)[0]).toBe('total');
    expect(order(ids, 2026)).not.toEqual(order(ids, 2027));
    expect(theme(2026)).toEqual(theme(2026));
    expect(theme(2026)).not.toEqual(theme(2027));
    expect(new Set(theme(2026)).size).toBe(12);
  });
  it('tonesFor: personality is cream, others get distinct theme tones', () => {
    const t = tonesFor(ids, 2026);
    expect(t.you).toBe('cream');
    expect(new Set(ids.map((id) => t[id])).size).toBe(ids.length);
  });
});
