import { describe, expect, it } from 'vitest';
import fixture from './fixtures/bq-export-main.json';
import { bcRoastDate } from './beanConquerorJson.ts';
import { coffeeBeanUuid } from './bqBeanUuid.ts';
import {
  NEW_BEAN_TEMPLATE, applyPatchPlan, bqDateFromLocal, buildPatchPlan, comparePatched,
  type PatchCoffee, type PatchPlan
} from './bqPatch.ts';

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
      'Alpha', 'Bravo', 'Charlie', 'Full', 'N1', 'N2'
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

  it('reports duplicate uuids and count mismatches', () => {
    const dup = structuredClone(m) as { BREWS: unknown[] };
    dup.BREWS.push(structuredClone(dup.BREWS[0]));
    const n = (m.BREWS as unknown[]).length;
    expect(comparePatched(m, dup)).toEqual([
      'BREWS brew-1: duplicate in actual',
      `BREWS: count ${n} expected, ${n + 1} actual`
    ]);
    expect(comparePatched(dup, m)).toContain('BREWS brew-1: duplicate in expected');
  });
});

// The fixture's 'bean-full' carries every key a real v8.7.0 export has (key names checked
// against the real export once); the template must have exactly the union of the fixture's keys.
const EXPORTED_BEAN_KEYS = [...new Set(beans.flatMap((b) => Object.keys(b)))];

const bean = (uuid: string, extra: Record<string, unknown> = {}) => ({
  ...structuredClone(NEW_BEAN_TEMPLATE), name: 'Alpha', config: { uuid, unix_timestamp: 1 }, ...extra
});
const mainOf = (...bs: Record<string, unknown>[]) => ({ BEANS: bs });
const site = (o: Partial<PatchCoffee> = {}): PatchCoffee => ({
  id: 1, roaster: 'r1', coffee_name: 'Alpha', product_url: null, roast_date: null, roast_level: null,
  degrees_of_roast: null, amount_g: null, cost: null, decaf: 0, blend: 0, status: 'open',
  frozen_start_date: null, frozen_end_date: null, origin: null, processing: null, producer: null,
  farm: null, variety: null, region: null, elevation: null, harvest_time: null, certification: null,
  bean_uuid: 'u1', photo: null, ...o
});
const plan = (c: Partial<PatchCoffee>, b = bean('u1'), keep = {}) =>
  buildPatchPlan([site(c)], mainOf(b), keep);

describe('buildPatchPlan', () => {
  it('site blank writes nothing', () => {
    const r = plan({}, bean('u1', { url: 'x', cost: 5, bean_information: [{ country: 'Peru' }] }));
    expect(r.plan.beans).toEqual([]);
  });

  it('UTC instant is not a difference', () => {
    const d = '2026-03-01';
    expect(bcRoastDate(bqDateFromLocal(d))).toBe(d);
    expect(plan({ roast_date: d }, bean('u1', { roastingDate: bqDateFromLocal(d) })).plan.beans).toEqual([]);
    expect(plan({ roast_date: d }).plan.beans[0].set).toEqual({ roastingDate: bqDateFromLocal(d) });
  });

  it('half-step roast writes 1.5', () => {
    const r = plan({ roast_level: 'Light-Medium', degrees_of_roast: 1.5 });
    expect(r.plan.beans[0].set).toEqual({ roast_range: 1.5 });
  });

  it('cost and weight below 0.005 are noise', () => {
    const r = plan({ cost: 20.001, amount_g: 250 }, bean('u1', { cost: 20, weight: 250.004 }));
    expect(r.plan.beans).toEqual([]);
  });

  it('keep stops a field', () => {
    const c = { coffee_name: 'ALPHA', origin: 'Peru' };
    expect(plan(c).plan.beans[0]).toMatchObject({ set: { name: 'ALPHA' }, origin: { country: 'Peru' } });
    expect(plan(c, bean('u1'), { 1: ['coffee_name', 'origin'] }).plan.beans).toEqual([]);
  });

  it('finished follows site status both ways', () => {
    expect(plan({ status: 'archive' }).plan.beans[0].set).toEqual({ finished: true });
    for (const status of ['open', 'backlog']) {
      expect(plan({ status }, bean('u1', { finished: true })).plan.beans[0].set).toEqual({ finished: false });
    }
  });

  it('producer writes farmer', () => {
    expect(plan({ producer: 'P' }).plan.beans[0].origin).toEqual({ farmer: 'P' });
  });

  it('new bean uses derived uuid and has every key of an exported bean', () => {
    const r = buildPatchPlan([site({ id: 7, bean_uuid: null, coffee_name: 'House Blend', amount_g: 250 })], mainOf(), {});
    const nb = r.plan.newBeans[0];
    expect(Object.keys(nb).sort()).toEqual([...EXPORTED_BEAN_KEYS].sort());
    expect((nb.config as { uuid: string }).uuid).toBe(coffeeBeanUuid(7));
    expect(nb).toMatchObject({ bean_roasting_type: 'FILTER', beanMix: 'SINGLE_ORIGIN', weight: 250, roaster: 'r1' });
  });

  it('NULL site decaf writes nothing; 0 writes false; keep stops it', () => {
    const b = bean('u1', { decaffeinated: true });
    expect(plan({ decaf: null }, b).plan.beans).toEqual([]);
    expect(plan({ decaf: 0 }, b).plan.beans[0].set).toEqual({ decaffeinated: false });
    expect(plan({ decaf: 0 }, b, { 1: ['decaf'] }).plan.beans).toEqual([]);
  });

  it('beanMix follows the site blend column: overwrites without settled, fills blanks, never from the name', () => {
    const hs = plan({ blend: 0, coffee_name: 'Alpha Field Blend' }, bean('u1', { beanMix: 'BLEND', name: 'Alpha Field Blend' }));
    expect(hs.plan.beans[0].set).toEqual({ beanMix: 'SINGLE_ORIGIN' });
    expect(hs.unexpected).toEqual([]);
    const blank = plan({ blend: 0 }, bean('u1', { beanMix: 'UNKNOWN' }));
    expect(blank.plan.beans[0].set).toEqual({ beanMix: 'SINGLE_ORIGIN' });
    const none = plan({ blend: 0 }, bean('u1', { beanMix: undefined }));
    expect(none.plan.beans[0].set).toEqual({ beanMix: 'SINGLE_ORIGIN' });
    const teddy = plan({ blend: 1 }, bean('u1'));
    expect(teddy.plan.beans[0].set).toEqual({ beanMix: 'BLEND' });
    expect(teddy.unexpected).toEqual([]);
    expect(plan({ blend: 1 }, bean('u1'), { 1: ['blend'] }).plan.beans).toEqual([]);
    expect(applyPatchPlan(mainOf(bean('u1', { beanMix: 'BLEND' })), hs.plan).changes)
      .toEqual([expect.objectContaining({ field: 'beanMix', from: 'BLEND', to: 'SINGLE_ORIGIN' })]);
  });

  it('a new bean takes beanMix from blend, not the name', () => {
    const nb = (o: Partial<PatchCoffee>) => buildPatchPlan([site({ bean_uuid: null, ...o })], mainOf(), {}).plan.newBeans[0].beanMix;
    expect(nb({ coffee_name: 'House Blend', blend: 0 })).toBe('SINGLE_ORIGIN');
    expect(nb({ coffee_name: 'Alpha', blend: 1 })).toBe('BLEND');
  });

  it('two bags stay two beans', () => {
    const r = buildPatchPlan([site({ id: 7, bean_uuid: null }), site({ id: 8, bean_uuid: null })], mainOf(), {});
    expect(r.plan.newBeans.map((b) => (b.config as { uuid: string }).uuid)).toEqual([
      coffeeBeanUuid(7), coffeeBeanUuid(8)
    ]);
  });

  it('missing bean is unexpected', () => {
    expect(plan({ bean_uuid: 'gone' }).unexpected).toHaveLength(1);
  });

  it('derived uuid already in the export is unexpected; roast level with no degree too', () => {
    const r = buildPatchPlan([site({ id: 7, bean_uuid: null, roast_level: 'X' })], mainOf(bean(coffeeBeanUuid(7))), {});
    expect(r.unexpected).toHaveLength(2);
    expect(r.plan.newBeans).toEqual([]);
  });

  it('unlinked bean stays untouched', () => {
    const r = buildPatchPlan([site()], mainOf(bean('u1'), bean('stray')), {});
    expect(r.untouchedBeans).toEqual(['stray']);
  });

  it('no photo when attachments exist or no own image', () => {
    const withPhoto = plan({ photo: '/p.jpg' });
    expect(withPhoto.plan.beans[0].photo).toBe('/p.jpg');
    const existing = bean('u1', { attachments: ['photo_a.jpg'] });
    const r = applyPatchPlan(mainOf(existing), withPhoto.plan, { u1: 'photo_new.jpg' });
    expect((r.main.BEANS as { attachments: string[] }[])[0].attachments).toEqual(['photo_a.jpg']);
    expect(plan({ photo: null }).plan.beans).toEqual([]);
  });

  it('overwriting a non-blank BQ value needs settled; blank fills do not', () => {
    const b = bean('u1', { cost: 5, url: '' });
    const c = { cost: 9, product_url: 'https://x.test' };
    const r = plan(c, b);
    expect(r.unexpected).toEqual(['coffee 1: cost overwrites a Bean Conqueror value that is not settled']);
    expect(r.plan.beans[0].set).toMatchObject({ cost: 9, url: 'https://x.test' });
    expect(buildPatchPlan([site(c)], mainOf(b), {}, ['1:cost']).unexpected).toEqual([]);
    expect(buildPatchPlan([site(c)], mainOf(b), { 1: ['cost'] }).unexpected).toEqual([]);
  });

  it('unsettled origin overwrite is unexpected', () => {
    const b = bean('u1', { bean_information: [{ farm: 'Old' }] });
    expect(plan({ farm: 'New' }, b).unexpected).toHaveLength(1);
    expect(buildPatchPlan([site({ farm: 'New' })], mainOf(b), {}, ['1:farm']).unexpected).toEqual([]);
  });

  it('new bean beside an unlinked same-name export bean is unexpected, null dates match', () => {
    const stray = bean('stray', { name: 'ALPHA!', roaster: 'R1', roastingDate: '' });
    const nb = (d: string | null) => site({ id: 7, bean_uuid: null, roast_date: d });
    expect(buildPatchPlan([nb('2026-03-01')], mainOf(stray), {}).unexpected).toHaveLength(1);
    expect(buildPatchPlan([nb(null)], mainOf(bean('stray', { name: 'Alpha', roaster: 'r1', roastingDate: bqDateFromLocal('2026-03-01') })), {}).unexpected).toHaveLength(1);
    const other = bean('stray', { name: 'Alpha', roaster: 'r1', roastingDate: bqDateFromLocal('2026-01-01') });
    expect(buildPatchPlan([nb('2026-03-01')], mainOf(other), {}).unexpected).toEqual([]);
  });
});
