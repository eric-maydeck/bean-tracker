import { describe, it, expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '../db';
import { setNoteWords } from '../recipes';
import type { PourReading } from '$lib/pours';
import type { Recipe } from '$lib/recipes';
import type { BrewFact } from './facts';
import {
  FLAVOR_WORDS, agitationBand, loadPourFacts, poursTab, swirlAfterBand, type PourFact
} from './pours';

let n = 0;
const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: ++n, coffeeId: 1, localTime: '2026-09-15T08:00', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null,
  grind: null, dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const rd = (o: { pours?: number; swirls?: number[]; total?: number; dd?: number | null; hold?: number | null }): PourReading => ({
  v: 1, pours: Array.from({ length: o.pours ?? 3 }, (_, i) => ({ startS: i * 30, durationS: 10, grams: 50, avgGps: 5, peakGps: 8, speed: 'slow' as const, bloom: i === 0, contactS: 30 })),
  swirls: (o.swirls ?? []).map((afterPour, i) => ({ atS: i, afterPour })), tares: [], bloomCount: 1, bloomHoldS: o.hold ?? null, immersion: false,
  totalS: o.total ?? 140, drawdownS: o.dd === undefined ? 40 : o.dd, scaleWaterG: 300, ratio: 16, ratioSource: 'logged', lowConfidence: false, pattern: 'x', structureKey: null
});
const fact = (b: BrewFact, o: Partial<PourFact>): PourFact => ({
  brewId: b.id, recipeId: null, how: null, reading: rd({}), agitation: 'unknown', agitationSet: false, words: [], sequence: null, ...o
});
const recipe = (id: number, name: string): Recipe => ({ id, name, tags: [], def: {} as Recipe['def'] });
const R1 = recipe(1, 'R1'), R2 = recipe(2, 'R2');

type Spec = { rec: 0 | 1 | 2; rating: number; rest: number; words?: string[]; how?: PourFact['how']; r: PourReading; ag: Partial<PourFact> };
/**
 * Bags 1-3 Washed, 4-6 Natural. Per bag (mean rating 7, so a brew's delta is rating - 7):
 *   R1: 4 brews, 8 (Washed) / 8.5 (Natural), 3 pours, 140 s, dd 40, hold 30, low agitation (set); 2 @ rest 20, 2 @ 40
 *   R2: 4 brews, 6 / 5.5, 4 pours, 160 s, dd 50, hold 40, swirls after bloom + pour 3, High then Low (set); rest 40
 *   no recipe: 2 brews, 7, 3 pours, 140 s, dd 30, high agitation (inferred); rest 20.
 */
function fixture(o: { mixedAfter?: (b: BrewFact) => void } = {}) {
  const rows: BrewFact[] = [], facts = new Map<number, PourFact>();
  const add = (bag: number, s: Spec, i: number) => {
    const b = brew({ coffeeId: bag, rating: s.rating, restDays: s.rest, processGroup: bag <= 3 ? 'Washed' : 'Natural', dripper: 'V60', ratio: 16, localDate: `2026-09-${10 + i}` });
    rows.push(b);
    facts.set(b.id, fact(b, { recipeId: s.rec || null, how: s.rec ? (s.how ?? 'match') : null, reading: s.r, words: s.words ?? [], ...s.ag }));
  };
  for (let bag = 1; bag <= 6; bag++) {
    const nat = bag > 3;
    let i = 0;
    for (let k = 0; k < 4; k++)
      add(bag, { rec: 1, rating: nat ? 8.5 : 8, rest: k < 2 ? 20 : 40, how: k === 3 ? 'modified' : 'match', words: k < 2 ? ['Brown'] : [], r: rd({ hold: 30 }), ag: { agitation: 'low', agitationSet: true } }, i++);
    for (let k = 0; k < 4; k++)
      add(bag, { rec: 2, rating: nat ? 5.5 : 6, rest: 40, how: k === 0 ? 'logged' : 'match', r: rd({ pours: 4, total: 160, dd: 50, hold: 40, swirls: [0, 2] }), ag: { agitation: 'mixed', agitationSet: true, sequence: 'High then Low' } }, i++);
    for (let k = 0; k < 2; k++)
      add(bag, { rec: 0, rating: 7, rest: 20, words: bag <= 2 && k === 0 ? ['Floral'] : [], r: rd({ dd: 30 }), ag: { agitation: 'high', agitationSet: false } }, i++);
  }
  o.mixedAfter?.(rows[0]);
  return { rows, facts };
}

describe('poursTab report card', () => {
  const { rows, facts } = fixture();
  const tab = poursTab(rows, facts, [R1, R2])!;
  it('orders R1, R2, No recipe with exact deltas and counts', () => {
    // R1 delta: 12 brews at +1 (Washed) and 12 at +1.5 -> 1.25. R2 mirrors it. No recipe: 0.
    expect(tab.recipes.map((r) => r.name)).toEqual(['R1', 'R2', 'No recipe']);
    expect(tab.recipes.map((r) => +r.stat!.delta!.toFixed(2))).toEqual([1.25, -1.25, 0]);
    expect(tab.recipes.map((r) => [r.rated, r.bags, r.thin])).toEqual([[24, 6, false], [24, 6, false], [12, 6, false]]);
    expect(tab.recipes[0]).toMatchObject({ id: 1, matched: 18, modified: 6, logged: 0, dripper: 'V60', trend: [] });
    expect(tab.recipes[1]).toMatchObject({ matched: 18, logged: 6, modified: 0 });
    expect(tab.noFlow).toBe(0);
  });
  it('best.process names the best process: Natural for R1, Washed for R2', () => {
    expect(tab.recipes[0].best.process).toMatchObject({ label: 'Natural', small: false, brews: 12 });
    expect(tab.recipes[0].best.process!.delta).toBeCloseTo(1.5);
    expect(tab.recipes[1].best.process).toMatchObject({ label: 'Washed' });
    expect(tab.recipes[1].best.process!.delta).toBeCloseTo(-1);
  });
  it('technique: pours, contact, split means, agitation inferred', () => {
    const t = (k: string) => tab.technique.find((x) => x.key === k)!;
    // 3 pours: 24 R1 brews (12 @ +1, 12 @ +1.5) and 12 no-recipe brews @ 0 -> 30 / 36.
    expect(t('pours').bands.map((s) => [s.label, +s.delta!.toFixed(2)])).toEqual([['3 pours', 0.83], ['4 pours', -1.25]]);
    expect(t('contact').bands.map((s) => s.label)).toEqual(['2:00–2:29', '2:30–2:59']);
    // dd: 24 brews at 40 and 12 at 30 -> 36.67; pour = 140 - 36.67
    expect(tab.split.map((s) => [s.label, +s.pourS.toFixed(2), +s.drawdownS.toFixed(2)])).toEqual([['2:00–2:29', 103.33, 36.67], ['2:30–2:59', 110, 50]]);
    expect(t('swirlAfter').bands.map((s) => s.label)).toEqual(['No swirl', 'After bloom + After pour 3']);
    expect(t('swirls').bands.map((s) => s.label)).toEqual(['0', '2']);
    expect(t('bloom').bands.map((s) => s.label)).toEqual(['30 s', '40 s']);
    expect(tab.technique.find((x) => x.key === 'ratio')).toBeUndefined();
  });
  it('mixed split defaults on here; split:false forces one Mixed band with inferred counts', () => {
    expect(tab.agitationSplit).toBe(true);
    expect(tab.technique[0].bands.map((s) => s.label)).toEqual(['High', 'Low', 'High then Low']);
    const one = poursTab(rows, facts, [R1, R2], { split: false })!;
    const a = one.technique.find((x) => x.key === 'agitation')!;
    expect(one.agitationSplit).toBe(false);
    expect(a.bands.map((s) => [s.label, +s.delta!.toFixed(2)])).toEqual([['High', 0], ['Low', 1.25], ['Mixed', -1.25]]);
    expect(a.inferred).toEqual({ High: 12, Low: 0, Mixed: 0 });
  });
  it('rest rows come out in WAIT_BUCKETS order', () => {
    // 31-60 holds 36 brews, 15-30 holds 24: the breakdown sorts 31-60 first.
    expect(tab.rest.byRecipe!.rows).toEqual(['15–30', '31–60']);
    expect(tab.agitationByProcess).not.toBeNull();
    expect(tab.recipeBy.process!.cols).toEqual(['R1', 'R2', 'No recipe']);
  });
  it('words: Brown listed (12 brews, 6 bags), Floral (2 bags) absent', () => {
    expect(tab.words.map((w) => w.label)).toEqual(['Brown']);
    const w = tab.words[0];
    expect([w.brews, w.bags]).toEqual([12, 6]);
    // Brown sits on R1's first two brews per bag (Low): Low 12 of 24, others 0; contact 2:00-2:29 12 of 36.
    expect(w.byAgitation).toEqual([{ label: 'High', share: 0, brews: 12 }, { label: 'Low', share: 0.5, brews: 24 }, { label: 'High then Low', share: 0, brews: 24 }]);
    expect(w.byContact.map((c) => [c.label, +c.share.toFixed(3)])).toEqual([['2:00–2:29', 0.333], ['2:30–2:59', 0]]);
  });
  it('renamed recipe shows the new name; no recipes leaves only No recipe', () => {
    expect(poursTab(rows, facts, [R1, recipe(2, 'Renamed')])!.recipes.map((r) => r.name)).toContain('Renamed');
    const bare = new Map([...facts].map(([id, f]) => [id, { ...f, recipeId: null, how: null }]));
    expect(poursTab(rows, bare, [])!.recipes.map((r) => r.name)).toEqual(['No recipe']);
  });
  it('rows without a fact count as noFlow; no fact at all is null', () => {
    expect(poursTab([...rows, brew({ coffeeId: 1, rating: 7 })], facts, [R1, R2])!.noFlow).toBe(1);
    expect(poursTab([brew({ rating: 7 })], new Map(), [])).toBeNull();
  });
  it('one bag: no deltas anywhere, counts remain', () => {
    const one = rows.filter((b) => b.coffeeId === 1);
    const t = poursTab(one, facts, [R1, R2])!;
    expect(t.recipes.map((r) => [r.name, r.rated, r.stat])).toEqual([['R1', 4, null], ['R2', 4, null], ['No recipe', 2, null]]);
    expect(t.technique).toEqual([]);
    expect([t.agitationByProcess, t.recipeBy.roast, t.recipeBy.process, t.rest.byRecipe, t.rest.byAgitation]).toEqual([null, null, null, null, null]);
  });
});

describe('mixed split rule', () => {
  // 3 bags: 4 High (8) + mixed (6) per bag; bag 1 also has 2 Low then High (7).
  const build = (perBag: number[]) => {
    const rows: BrewFact[] = [], facts = new Map<number, PourFact>();
    const add = (bag: number, rating: number, ag: Partial<PourFact>) => {
      const b = brew({ coffeeId: bag, rating }); rows.push(b); facts.set(b.id, fact(b, { agitationSet: true, ...ag }));
    };
    perBag.forEach((m, i) => {
      for (let k = 0; k < 4; k++) add(i + 1, 8, { agitation: 'high' });
      for (let k = 0; k < m; k++) add(i + 1, 6, { agitation: 'mixed', sequence: 'High then Low' });
    });
    for (let k = 0; k < 2; k++) add(1, 7, { agitation: 'mixed', sequence: 'Low then High' });
    return { rows, facts };
  };
  const labels = (t: ReturnType<typeof poursTab>) => t!.technique.find((x) => x.key === 'agitation')?.bands.map((s) => s.label);
  it('12 of 14 Mixed brews in a clearing sequence: split, the rest fold into Mixed (other)', () => {
    const { rows, facts } = build([4, 4, 4]);
    const t = poursTab(rows, facts, [])!;
    expect(t.agitationSplit).toBe(true);
    expect(labels(t)).toEqual(['High', 'High then Low', 'Mixed (other)']);
  });
  it('4 of 6 under the bar: one Mixed band', () => {
    const { rows, facts } = build([2, 2, 0]);
    const t = poursTab(rows, facts, [])!;
    expect(t.agitationSplit).toBe(false);
    expect(labels(t)).toEqual(['High', 'Mixed']);
    const b = build([4, 4, 4]);
    expect(labels(poursTab(b.rows, b.facts, [], { split: false }))).toEqual(['High', 'Mixed']);
  });
  it('agitationBand folds a sequence outside `keep` and note-only Mixed brews', () => {
    const b = brew({}), f = new Map([[b.id, fact(b, { agitation: 'mixed', sequence: 'Low then High' })]]);
    expect(agitationBand(f, true)(b)!.label).toBe('Low then High');
    expect(agitationBand(f, true, new Set())(b)!.label).toBe('Mixed (other)');
    expect(agitationBand(new Map([[b.id, fact(b, { agitation: 'mixed' })]]), true)(b)!.label).toBe('Mixed (other)');
    expect(agitationBand(f, false)(b)!.label).toBe('Mixed');
    expect(agitationBand(new Map([[b.id, fact(b, { agitation: 'unknown' })]]), true)(b)).toBeNull();
  });
});

describe('recipe trend', () => {
  it('monthly mean of ratings against the bag mean over ALL its rated brews', () => {
    // Bag 1: R1 3 @ 8 (Sep) + 3 @ 9 (Oct), R2 6 @ 5 -> bag mean 6.75: Sep +1.25, Oct +2.25 (own-recipe basis would be -0.5/+0.5).
    // Bag 2: all 7, R1 in Nov (2 brews, under 3: no point).
    const rows: BrewFact[] = [], facts = new Map<number, PourFact>();
    const add = (bag: number, rec: number, rating: number, date: string) => {
      const b = brew({ coffeeId: bag, rating, localDate: date }); rows.push(b); facts.set(b.id, fact(b, { recipeId: rec, how: 'match' }));
    };
    for (let k = 0; k < 3; k++) add(1, 1, 8, '2026-09-10');
    for (let k = 0; k < 3; k++) add(1, 1, 9, '2026-10-10');
    for (let k = 0; k < 6; k++) add(1, 2, 5, '2026-09-11');
    for (let k = 0; k < 2; k++) add(2, 1, 7, '2026-11-10');
    for (let k = 0; k < 2; k++) add(2, 2, 7, '2026-11-11');
    expect(poursTab(rows, facts, [R1, R2])!.recipes.find((r) => r.name === 'R1')!.trend).toEqual([{ label: 'Sep', value: 1.25 }, { label: 'Oct', value: 2.25 }]);
  });
});

describe('hiddenByRatings', () => {
  it('lists a recipe with 12 All-ratings brews over 3 bags and none Calibrated', () => {
    const mk = (bag: number, rec: number) => { const b = brew({ coffeeId: bag, rating: 7 }); return [b, fact(b, { recipeId: rec })] as const; };
    const cal = [mk(1, 1), mk(1, 1)], all = [...cal, ...[1, 2, 3].flatMap((bag) => Array.from({ length: 4 }, () => mk(bag, 9)))];
    const facts = new Map(all.map(([b, f]) => [b.id, f]));
    const rec = [R1, recipe(9, 'R9')];
    expect(poursTab(cal.map(([b]) => b), facts, rec, { allRows: all.map(([b]) => b) })!.hiddenByRatings).toEqual(['R9']);
    expect(poursTab(cal.map(([b]) => b), facts, rec)!.hiddenByRatings).toEqual([]);
  });
});

describe('swirlAfterBand', () => {
  it('swirls after the bloom and pour 3 (1-based, bloom counted)', () => {
    const b = brew({}), f = new Map([[b.id, fact(b, { reading: rd({ swirls: [0, 2] }) })]]);
    expect(swirlAfterBand(f)(b)!.label).toBe('After bloom + After pour 3');
    expect(swirlAfterBand(new Map([[b.id, fact(b, { reading: rd({}) })]]))(b)!.label).toBe('No swirl');
  });
});

describe('FLAVOR_WORDS', () => {
  it('are the generic labels only', () =>
    expect(FLAVOR_WORDS.map((w) => w.label)).toEqual(['Bright', 'Sour', 'Floral', 'Sweet', 'Clean', 'Bitter', 'Brown', 'Astringent']));
});

describe('loadPourFacts', () => {
  const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const pour = (bloom: boolean, gps: number) => ({ startS: 0, durationS: 10, grams: 50, avgGps: gps, peakGps: gps, speed: 'slow', bloom, contactS: 30 });
  const def = (agitations: ('high' | 'low')[], anySpeed = false, drippers: string[] = []) => ({
    v: 1, pours: agitations.map((agitation) => ({ bloom: false, grams: 50, share: null, speed: 'slow', rateGps: null, agitation, tool: null, swirlAfter: false, startS: null, durationS: null })),
    pourCount: { min: 1, max: 9 }, bloomHoldS: null, bloomHoldTolS: 5, ratio: { target: 16, tol: 1 }, tempC: null, totalS: null, notes: null, drippers, anySpeed
  });
  const setup = () => {
    const db = createDb(':memory:');
    const brews: BrewFact[] = [];
    const addBrew = (i: number, o: { notes?: string; pours?: number | null; gps?: number; dripper?: string; match?: [number, string] }) => {
      db.prepare(`INSERT INTO beanconqueror_brews (id, bc_created_at, bc_uuid, notes, rating, imported_at) VALUES (?, '2026-02-01T08:00:00Z', ?, ?, 7, 'x')`).run(i, uuid(i), o.notes ?? null);
      if (o.pours !== undefined && o.pours !== null || o.pours === null)
        db.prepare(`INSERT INTO brew_pour_readings (bc_uuid, detector_version, flow_uploaded_at, pattern, pour_count, bloom_count, swirl_count, low_confidence, immersion, reading, read_at) VALUES (?, 3, 'x', 'p', ?, 0, 0, 0, 0, ?, 'x')`)
          .run(uuid(i), o.pours ?? 0, JSON.stringify({ v: 1, pours: Array.from({ length: o.pours ?? 0 }, () => pour(false, o.gps ?? 12)), swirls: [] }));
      if (o.match) db.prepare(`INSERT INTO brew_recipe_matches (brew_id, recipe_id, how) VALUES (?, ?, ?)`).run(i, o.match[0], o.match[1]);
      brews.push(brew({ id: i, dripper: o.dripper ?? 'V60' }));
    };
    const addRecipe = (id: number, name: string, d: object) =>
      db.prepare(`INSERT INTO recipes (id, name, definition, created_at, updated_at) VALUES (?, ?, ?, 'x', 'x')`).run(id, name, JSON.stringify(d));
    return { db, brews, addBrew, addRecipe };
  };
  it('a stored pour_count 0 reading with no match is no fact; a logged match without a reading is', () => {
    const { db, brews, addBrew, addRecipe } = setup();
    addRecipe(1, 'Low', def(['low', 'low']));
    addBrew(1, { pours: 0 });
    addBrew(2, { match: [1, 'logged'] });
    const { facts, recipes } = loadPourFacts(db, brews);
    expect([...facts.keys()]).toEqual([2]);
    expect(facts.get(2)).toMatchObject({ recipeId: 1, how: 'logged', reading: null, agitation: 'low', agitationSet: true });
    expect(recipes.map((r) => r.name)).toEqual(['Low']);
  });
  it('speed-blind drippers (listed by an anySpeed recipe) leave an unmatched brew unknown; others get a speed guess', () => {
    const { db, brews, addBrew, addRecipe } = setup();
    addRecipe(1, 'Gabi', def(['low'], true, ['Gabi']));
    addBrew(1, { pours: 2, dripper: 'Gabi' });
    addBrew(2, { pours: 2, dripper: 'V60' });
    const { facts } = loadPourFacts(db, brews);
    expect(facts.get(1)).toMatchObject({ agitation: 'unknown', agitationSet: false });
    expect(facts.get(2)).toMatchObject({ agitation: 'high', agitationSet: false }); // 12 g/s > 10
  });
  it('honors the stored note words, finds flavor words, and a Mixed brew carries its sequence', () => {
    const { db, brews, addBrew, addRecipe } = setup();
    addRecipe(1, 'HL', def(['high', 'low']));
    addBrew(1, { pours: 2, notes: 'swirly, Brown sugar and acidic' });
    addBrew(2, { pours: 2, match: [1, 'match'] });
    setNoteWords(db, [{ word: 'swirly', agitation: 'low' }]);
    const { facts } = loadPourFacts(db, brews);
    expect(facts.get(1)).toMatchObject({ agitation: 'low', agitationSet: true, words: ['Bright', 'Brown'], sequence: null });
    expect(facts.get(2)).toMatchObject({ agitation: 'mixed', sequence: 'High then Low' });
  });
  it('never touches the flows table', () => {
    const { db, brews, addBrew } = setup();
    addBrew(1, { pours: 2 });
    const seen: string[] = [], real = db.prepare.bind(db) as DatabaseSync['prepare'];
    db.prepare = ((sql: string) => (seen.push(sql), real(sql))) as DatabaseSync['prepare'];
    loadPourFacts(db, brews);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((s) => /brew_flows/.test(s))).toBe(false);
  });
});
