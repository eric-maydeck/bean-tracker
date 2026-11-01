import { describe, expect, it } from 'vitest';
import fixture from './fixtures/bq-export-main.json';
import { applyPatchPlan, comparePatched, type PatchPlan } from './bqPatch.ts';

const m = fixture as Record<string, unknown>;
const beans = m.BEANS as Record<string, unknown>[];
const empty: PatchPlan = { beans: [], newBeans: [] };
const run = (beanPlan: PatchPlan['beans'], names = {}) =>
  applyPatchPlan(m, { beans: beanPlan, newBeans: [] }, names);

describe('applyPatchPlan', () => {
  it('empty plan returns byte-identical JSON', () => {
    const r = applyPatchPlan(m, empty);
    expect(JSON.stringify(r.main)).toBe(JSON.stringify(m));
    expect(r.changes).toEqual([]);
  });

  it('patches only named fields', () => {
    const r = run([{ uuid: 'bean-a', set: { url: 'https://x.test' }, origin: { farm: 'F' } }]);
    const [a] = r.main.BEANS as Record<string, unknown>[];
    expect(a.url).toBe('https://x.test');
    const { url: _u, bean_information: _b, ...restNew } = a;
    const { url: _u2, bean_information: _b2, ...restOld } = beans[0];
    expect(restNew).toEqual(restOld);
    expect(r.main.BEANS).not.toBe(m.BEANS);
    for (const k of Object.keys(m).filter((k) => k !== 'BEANS')) {
      expect(JSON.stringify(r.main[k])).toBe(JSON.stringify(m[k]));
    }
    expect(JSON.stringify((r.main.BEANS as unknown[]).slice(1))).toBe(
      JSON.stringify(beans.slice(1))
    );
    expect(r.changes.map((c) => c.field)).toEqual(['url', 'bean_information[0].farm']);
  });

  it('never touches protected keys', () => {
    for (const k of ['note', 'rating', 'favourite', 'config']) {
      expect(() => run([{ uuid: 'bean-a', set: { [k]: 1 } }])).toThrow();
    }
  });

  it('never blanks', () => {
    const r = run([{ uuid: 'bean-b', set: { url: '' }, origin: { farm: '' } }]);
    expect(JSON.stringify(r.main)).toBe(JSON.stringify(m));
    expect(r.changes).toEqual([]);
  });

  it('attachments only where empty', () => {
    const names = { 'bean-c': 'photo_new.jpg', 'bean-a': 'photo_a.jpg' };
    const r = run([{ uuid: 'bean-c', photo: 'p' }, { uuid: 'bean-a', photo: 'p' }], names);
    const b = r.main.BEANS as Record<string, unknown>[];
    expect(b[2].attachments).toEqual(['photo_x.jpg']);
    expect(b[0].attachments).toEqual(['photo_a.jpg']);
    expect(r.changes).toHaveLength(1);
  });

  it('origin writes bean_information[0] only', () => {
    const r = run([
      { uuid: 'bean-a', origin: { country: 'Kenya' } },
      { uuid: 'bean-b', origin: { farm: 'New Farm' } }
    ]);
    const b = r.main.BEANS as { bean_information: unknown[] }[];
    expect(b[0].bean_information).toEqual([{ country: 'Kenya' }]);
    expect(b[1].bean_information).toEqual([
      { country: 'Kenya', farm: 'New Farm' },
      { country: 'Peru' }
    ]);
  });

  it('unknown uuid throws, and a new bean whose uuid exists throws', () => {
    expect(() => run([{ uuid: 'nope' }])).toThrow();
    const dup = { config: { uuid: 'bean-a' } };
    expect(() => applyPatchPlan(m, { beans: [], newBeans: [dup] })).toThrow();
  });

  it('new beans append after existing ones, in plan order', () => {
    const n = [{ name: 'N1', config: { uuid: 'n1' } }, { name: 'N2', config: { uuid: 'n2' } }];
    const r = applyPatchPlan(m, { beans: [], newBeans: n });
    expect((r.main.BEANS as { name: string }[]).map((b) => b.name)).toEqual([
      'Alpha', 'Bravo', 'Charlie', 'N1', 'N2'
    ]);
  });
});

describe('comparePatched', () => {
  it('returns [] for equal data (key order ignored)', () => {
    const reordered = { ...m, BREWS: [...(m.BREWS as object[])].reverse() };
    expect(comparePatched(m, reordered)).toEqual([]);
  });

  it('names the key and uuid otherwise', () => {
    const bad = structuredClone(m) as { BREWS: { grind_weight: number }[] };
    bad.BREWS[0].grind_weight = 99;
    expect(comparePatched(m, bad)).toEqual(['BREWS brew-1: differs']);
  });
});
