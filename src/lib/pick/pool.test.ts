import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES } from './rules';
import { buildPool, critPool, resolveCrits } from './pool';
import type { PickCoffee, PickRules } from './types';

const mk = (id: number, o: Partial<PickCoffee> = {}): PickCoffee => ({
  id, slug: `c${id}`, name: `Coffee ${String(id).padStart(2, '0')}`, roaster: 'R', image: null, fill: null,
  category: 'open', decaf: false, urgency: id, origin: null, roastLevel: null, processing: null, ...o
});
// 1..22 open (22 > 20), 23 backlog (null urgency), 24 frozen, 25 frozen decaf, 26 open decaf
const fixture: PickCoffee[] = [
  ...Array.from({ length: 22 }, (_, i) => mk(i + 1)),
  mk(23, { category: 'backlog', urgency: null }),
  mk(24, { category: 'frozen' }),
  mk(25, { category: 'frozen', decaf: true }),
  mk(26, { decaf: true, urgency: 50 })
];
const R = (o: Partial<PickRules> = {}): PickRules => ({ ...DEFAULT_RULES, ...o });
const ids = (c: PickCoffee[]) => c.map((x) => x.id);

describe('buildPool', () => {
  it('empty input', () => {
    expect(buildPool([], DEFAULT_RULES, new Set())).toEqual({ pool: [], sittingOut: [] });
  });
  it('defaults exclude frozen and decaf; cap 20, rest sit out', () => {
    const { pool, sittingOut } = buildPool(fixture, DEFAULT_RULES, new Set());
    expect(pool).toHaveLength(20);
    expect(ids(pool)).not.toContain(24);
    expect(ids(pool)).not.toContain(26);
    expect(ids(pool)[0]).toBe(22);
    expect(ids(sittingOut)).toEqual([2, 1, 23]);
  });
  it('frozen decaf left out unless includeFrozenDecaf', () => {
    const base = R({ categories: ['frozen'], includeDecaf: true });
    expect(ids(buildPool(fixture, { ...base, includeFrozenDecaf: false }, new Set()).pool)).toEqual([24]);
    expect(ids(buildPool(fixture, { ...base, includeFrozenDecaf: true }, new Set()).pool).sort()).toEqual([24, 25]);
  });
  it('includeFrozenDecaf ignored when decaf not included', () => {
    const r = R({ categories: ['frozen'], includeDecaf: false, includeFrozenDecaf: true });
    expect(ids(buildPool(fixture, r, new Set()).pool)).toEqual([24]);
  });
  it('open decaf comes in with includeDecaf', () => {
    const r = R({ includeDecaf: true });
    expect(ids(buildPool(fixture, r, new Set()).pool)).toContain(26);
  });
  it('crit coffee absent from pool', () => {
    const { pool } = buildPool(fixture, R({ critSuccess: [22], critFail: [21], critSuccessMode: 'specific', critFailMode: 'specific' }), new Set());
    expect(ids(pool)).not.toContain(22);
    expect(ids(pool)).not.toContain(21);
  });
  it('out coffee absent and the 21st moves up', () => {
    const { pool, sittingOut } = buildPool(fixture, DEFAULT_RULES, new Set([22]));
    expect(ids(pool)).not.toContain(22);
    expect(pool).toHaveLength(20);
    expect(ids(pool)).toContain(2);
    expect(ids(sittingOut)).toEqual([1, 23]);
  });
  it('byHand drops excluded, then caps at 20 on what is left', () => {
    const r = R({ over20: 'byHand', excluded: [22] });
    const { pool, sittingOut } = buildPool(fixture, r, new Set());
    expect(ids(pool)).not.toContain(22);
    expect(pool).toHaveLength(20);
    expect(ids(sittingOut)).toEqual([1, 23]); // 21 left after exclusion, cap trims
  });
  it('byHand with 20 or fewer left uses them all', () => {
    const r = R({ over20: 'byHand', excluded: [22, 21, 20, 19] });
    const { pool, sittingOut } = buildPool(fixture, r, new Set());
    expect(pool).toHaveLength(19);
    expect(sittingOut).toEqual([]);
  });
  it('urgency-asc, null last', () => {
    const { pool } = buildPool(fixture, R({ sort: 'urgency-asc' }), new Set());
    expect(ids(pool)[0]).toBe(1);
    expect(ids(pool)).not.toContain(23);
  });
  it('name sort', () => {
    const { pool } = buildPool(fixture, R({ sort: 'name' }), new Set());
    expect(ids(pool).slice(0, 3)).toEqual([1, 2, 3]);
  });
  it('category sort places decaf group per categoryOrder', () => {
    const base = R({
      sort: 'category',
      includeDecaf: true,
      over20: 'byHand',
      excluded: Array.from({ length: 18 }, (_, i) => i + 1)
    });
    // left: 19..22 open, 23 backlog, 26 open decaf
    expect(ids(buildPool(fixture, base, new Set()).pool)).toEqual([22, 21, 20, 19, 23, 26]);
    const b = { ...base, categoryOrder: ['decaf', 'backlog', 'open', 'frozen'] as PickRules['categoryOrder'] };
    expect(ids(buildPool(fixture, b, new Set()).pool)).toEqual([26, 23, 22, 21, 20, 19]);
  });
});

describe('critPool', () => {
  it('drops out and unknown ids, keeps order of ids', () => {
    expect(ids(critPool(fixture, [3, 999, 5, 7], new Set([5])))).toEqual([3, 7]);
  });
});

describe('resolveCrits', () => {
  const some = (n: number) => Array.from({ length: n }, (_, i) => mk(i + 1)); // urgency i+1: sorted high first, so #1 is the last id
  it('pool of 25: fail is #1, success is #20, both leave the normal pool', () => {
    const r = resolveCrits(some(25), R(), new Set());
    expect(ids(r.fail)).toEqual([25]);
    expect(ids(r.success)).toEqual([6]); // 25..6 are the top 20
    expect(r.pool).toHaveLength(18);
    expect(ids(r.pool)).not.toContain(25);
    expect(ids(r.pool)).not.toContain(6);
  });
  it('pool of 12: highest is the success unless the option is off', () => {
    expect(ids(resolveCrits(some(12), R(), new Set()).success)).toEqual([1]);
    const off = resolveCrits(some(12), R({ highestIsCrit: false }), new Set());
    expect(off.success).toEqual([]);
    expect(ids(off.fail)).toEqual([12]);
    expect(off.pool).toHaveLength(11);
  });
  it('fewer than 3 coffees: no spot crits', () => {
    const r = resolveCrits(some(2), R(), new Set());
    expect(r).toMatchObject({ success: [], fail: [] });
    expect(r.pool).toHaveLength(2);
  });
  it('disabled crits and specific mode', () => {
    expect(resolveCrits(some(12), R({ critFailOn: false, critSuccessOn: false }), new Set())).toMatchObject({ success: [], fail: [] });
    const s = resolveCrits(some(12), R({ critSuccessMode: 'specific', critSuccess: [3], critFailOn: false }), new Set());
    expect(ids(s.success)).toEqual([3]);
    expect(ids(s.pool)).not.toContain(3);
  });
});
