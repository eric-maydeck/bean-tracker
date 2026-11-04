import { describe, it, expect } from 'vitest';
import { coverTone, order, select, theme, tonesFor } from './select';
import type { FactResult } from './types';

const facts = (rows: [string, number][]) => rows.map(([id, score]) => ({ id, score }) as FactResult);
const manyFacts = (n: number) => facts([['total', 0], ...Array.from({ length: n }, (_, i): [string, number] => [`f${i}`, 1 - i / 100])]);
const ids = ['total', ...Array.from({ length: 11 }, (_, i) => `f${i}`)];

describe('select', () => {
  it('keeps every fact (a null one never reaches it): total first, then by score', () => {
    const r = select(facts([['a', .9], ['total', 0], ['b', .8], ['c', .7], ['d', .95], ['e', .1], ['f', .05]]));
    expect(r).toEqual(['total', 'd', 'a', 'b', 'c', 'e', 'f']);
  });
  it('no cap on the count', () => { expect(select(manyFacts(30))).toHaveLength(31); });
  it('the cover tone differs from the first slide and from year to year', () => {
    for (let y = 2000; y < 2100; y++) expect(coverTone(y), String(y)).not.toBe(tonesFor(['total'], y).total);
    expect(coverTone(2025)).not.toBe(coverTone(2026));
  });
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
