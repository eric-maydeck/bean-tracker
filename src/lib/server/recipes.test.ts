import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { compactFlow } from './bcFlow';
import { saveShot } from './visualizerUpload';
import { readStale } from './pourReadings';
import {
  MIN_GROUP, RecipeError, brewsFor, deleteRecipe, discoverGroups, dismissStructure, listRecipes,
  rematchBrews, saveRecipe, getNoteWords, setNoteWords, smallGroupCount, undismissStructure
} from './recipes';
import { draftFromReadings } from '$lib/recipes';
import type { PourReading } from '$lib/pours';
import { DEFAULT_NOTE_WORDS } from '$lib/agitation';

const load = (n: string) =>
  compactFlow(JSON.parse(readFileSync(new URL(`./fixtures/bcflow/${n}.json`, import.meta.url), 'utf8')))!;
const BBS = load('bbs');
const BBJ = load('4sy'); // a different structure from BBS
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

let seq = 0;
/** A brew with a flow (water/dose give ratio ~16.4) or without one. */
function addBrew(db: DatabaseSync, o: { flow?: typeof BBS | null; notes?: string | null; method?: string; rating?: number } = {}) {
  const i = ++seq;
  const hasFlow = o.flow !== null;
  db.prepare(
    `INSERT INTO beanconqueror_brews (bc_created_at, bc_uuid, water_amount_g, ground_coffee_g, brew_time, notes, rating, preparation_id, has_flow_profile, imported_at)
     VALUES (?, ?, 295.3, 18, '117', ?, ?, ?, ?, 'x')`
  ).run(`2026-02-${String(i % 28 + 1).padStart(2, '0')}T08:30:00Z`, uuid(i), o.notes ?? null, o.rating ?? 0, o.method ?? null, hasFlow ? 1 : 0);
  if (hasFlow) saveShot(db, { uuid: uuid(i), flow: o.flow ?? BBS });
  return i;
}
const fresh = () => {
  seq = 0;
  const db = createDb(':memory:');
  db.prepare(`INSERT INTO beanconqueror_methods (id, name, preparation_tools, imported_at) VALUES ('m1', 'V60 - Abaca', NULL, 'x')`).run();
  return db;
};
const reading = (db: DatabaseSync, i: number) =>
  JSON.parse((db.prepare(`SELECT reading FROM brew_pour_readings WHERE bc_uuid = ?`).get(uuid(i)) as { reading: string }).reading) as PourReading;
const matches = (db: DatabaseSync) =>
  db.prepare(`SELECT brew_id, recipe_id, how FROM brew_recipe_matches ORDER BY brew_id`).all() as { brew_id: number; recipe_id: number; how: string }[];

it('listRecipes normalizes a legacy row', () => {
  const db = fresh();
  const legacy = { v: 1, pours: [{ bloom: false, grams: 50, share: null, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: null, durationS: null }], pourCount: { min: 1, max: 1 }, bloomHoldS: null, bloomHoldTolS: 5, ratio: { target: 16.7, tol: 0.7 }, tempC: null, totalS: null, notes: null };
  db.prepare(`INSERT INTO recipes (name, tags, definition, created_at, updated_at) VALUES ('Old', '[]', ?, 'x', 'x')`).run(JSON.stringify(legacy));
  const old = listRecipes(db).find((r) => r.name === 'Old')!;
  expect(old.def.ratio.targets).toEqual([16.7]);
  expect(old.def.pours[0].length).toBeNull();
  expect(old.def.equalSplit).toBe(false);
});

describe('recipes', () => {
  it('saveRecipe labels matching brews; rename keeps them; delete cascades; duplicate name throws', () => {
    const db = fresh();
    for (let k = 0; k < 3; k++) addBrew(db);
    addBrew(db, { flow: BBJ });
    const draft = draftFromReadings([reading(db, 1)], [null]);
    const id = saveRecipe(db, { name: 'R1', tags: [], def: draft });
    expect(matches(db).filter((m) => m.recipe_id === id).map((m) => m.how)).toEqual(['match', 'match', 'match']);
    saveRecipe(db, { id, name: 'Renamed', tags: ['x'], def: draft });
    expect(listRecipes(db)).toMatchObject([{ id, name: 'Renamed', tags: ['x'] }]);
    expect(matches(db)).toHaveLength(3);
    expect(() => saveRecipe(db, { name: 'renamed', tags: [], def: draft })).toThrow(RecipeError);
    deleteRecipe(db, id);
    expect(matches(db)).toEqual([]);
  });

  it('a note tag logs a brew, with or without flow; readBrew rematches that brew', () => {
    const db = fresh();
    const draft = draftFromReadings([reading(db, addBrew(db))], [null]);
    saveRecipe(db, { name: 'R1', tags: [], def: draft });
    const noFlow = addBrew(db, { flow: null, notes: 'R1. good' });
    const withFlow = addBrew(db, { notes: 'r1 again' }); // saveShot -> readBrew labels it, no explicit rematch
    expect(matches(db).filter((m) => m.brew_id !== 1)).toEqual([{ brew_id: withFlow, recipe_id: 1, how: 'logged' }]);
    rematchBrews(db); // the import path: queueReadings ends with this; picks up the brew without a flow
    expect(matches(db).filter((m) => m.brew_id !== 1)).toEqual([
      { brew_id: noFlow, recipe_id: 1, how: 'logged' },
      { brew_id: withFlow, recipe_id: 1, how: 'logged' }
    ]);
    expect(rematchBrews(db, [])).toBe(0);
  });

  it('brews without ratio or key never match by identity and group under -x', () => {
    const db = fresh();
    for (let k = 0; k < MIN_GROUP; k++) {
      const i = addBrew(db);
      db.prepare(`UPDATE beanconqueror_brews SET water_amount_g = 0, ground_coffee_g = 0 WHERE id = ?`).run(i);
    }
    expect(readStale(db)).toBe(MIN_GROUP);
    const draft = draftFromReadings([reading(db, 1)], [null]);
    saveRecipe(db, { name: 'R1', tags: [], def: draft });
    expect(matches(db)).toEqual([]);
    expect(discoverGroups(db).map((g) => g.key)).toEqual([expect.stringMatching(/-x$/)]);
  });
});

describe('discoverGroups', () => {
  it('groups of MIN_GROUP+, biggest first, with tags, phrase and shared gear', () => {
    const db = fresh();
    for (let k = 0; k < MIN_GROUP; k++) addBrew(db, { notes: 'BBS. sweet', method: 'm1', rating: 8 });
    for (let k = 0; k < MIN_GROUP + 1; k++) addBrew(db, { flow: BBJ, notes: k < 2 ? '2 yeets, 1 MD. Sweet' : null, method: 'm1' });
    for (let k = 0; k < MIN_GROUP - 1; k++) addBrew(db, { flow: load('5sy') });
    const g = discoverGroups(db);
    expect(g).toHaveLength(2);
    expect(g[0].count).toBe(MIN_GROUP + 1);
    expect(g[0]).toMatchObject({ tagged: 0, suggestedPhrase: '2 yeets, 1 MD', common: ['V60', 'Abaca'] });
    expect(g[1]).toMatchObject({ count: MIN_GROUP, tagged: MIN_GROUP, suggestedName: 'BBS', avgRating: 8 });
    expect(g[1].description).toMatch(/^Two 20s blooms/);
    expect(g[1].timeline.pours.length).toBeGreaterThan(0);
    expect(MIN_GROUP).toBe(10);
    expect(smallGroupCount(db)).toBe(1);
  });

  it('ties on count put more tagged first, then key order', () => {
    const db = fresh();
    for (let k = 0; k < MIN_GROUP; k++) addBrew(db, { flow: BBJ });
    for (let k = 0; k < MIN_GROUP; k++) addBrew(db, { notes: 'BBS' });
    expect(discoverGroups(db).map((x) => x.tagged)).toEqual([MIN_GROUP, 0]);
  });

  it('dismissed keys disappear and come back', () => {
    const db = fresh();
    for (let k = 0; k < MIN_GROUP; k++) addBrew(db);
    const key = discoverGroups(db)[0].key;
    dismissStructure(db, key);
    expect(discoverGroups(db)).toEqual([]);
    expect(smallGroupCount(db)).toBe(0);
    undismissStructure(db, key);
    expect(discoverGroups(db)).toHaveLength(1);
  });

  it('a small structure mostly matched by a recipe is not an "other structure"', () => {
    const db = fresh();
    for (let k = 0; k < 3; k++) addBrew(db);
    for (let k = 0; k < 2; k++) addBrew(db, { flow: BBJ });
    expect(smallGroupCount(db)).toBe(2);
    saveRecipe(db, { name: 'R1', tags: [], def: draftFromReadings([reading(db, 1)], [null]) });
    expect(smallGroupCount(db)).toBe(1);
  });

  it('a group mostly matched by a saved recipe is gone', () => {
    const db = fresh();
    for (let k = 0; k < MIN_GROUP; k++) addBrew(db);
    saveRecipe(db, { name: 'R1', tags: [], def: draftFromReadings([reading(db, 1)], [null]) });
    expect(discoverGroups(db)).toEqual([]);
  });
});

describe('brewsFor windows', () => {
  it("gives a recipe's aligned brews windows from their own starts; misaligned and structure rows get none", () => {
    const db = fresh();
    const a = addBrew(db);
    addBrew(db);
    const draft = draftFromReadings([reading(db, a)], [null]);
    draft.pours[0].length = { kind: 'time', targetS: 20, maxS: 30 };
    const id = saveRecipe(db, { name: 'R1', tags: [], def: draft });
    addBrew(db, { flow: BBJ, notes: 'R1' }); // logged, but a different pour count and no equal split
    rematchBrews(db);
    const rows = brewsFor(db, { recipe: id });
    const own = rows.filter((r) => r.timeline!.pours.length === draft.pours.length);
    expect(own.length).toBeGreaterThan(0);
    for (const r of own) {
      const t = r.timeline!;
      // pour 0 runs the set 20s; any other drafted bloom its own length (the readings' hold)
      expect(t.windows![0]).toEqual({ startS: t.pours[0].startS, targetS: t.pours[0].startS + 20, bloom: 0, pour: 0 });
      expect(t.windows).toHaveLength(draft.pours.filter((p, i) => p.bloom && p.length && i < draft.pours.length - 1).length);
    }
    for (const r of rows.filter((r) => !own.includes(r))) expect(r.timeline!.windows ?? []).toEqual([]);
    for (const r of brewsFor(db, { key: reading(db, a).structureKey! })) expect(r.timeline!.windows ?? []).toEqual([]);
  });
});

describe('brewsFor', () => {
  it('labels logged, match and modified; no-flow tagged; low confidence flagged', () => {
    const db = fresh();
    const a = addBrew(db, { method: 'm1' });
    const b = addBrew(db, { method: 'm1' });
    const draft = draftFromReadings([reading(db, a)], [null]);
    const id = saveRecipe(db, { name: 'R1', tags: [], def: { ...draft, pours: draft.pours.map((p, i) => (i ? p : { ...p, length: { kind: 'time' as const, targetS: 10, maxS: 10 } })) } });
    const logged = addBrew(db, { notes: 'R1' });
    const noFlow = addBrew(db, { flow: null, notes: 'R1' });
    rematchBrews(db);
    const rows = brewsFor(db, { recipe: id });
    expect(rows.map((r) => r.label)).toEqual([
      'R1',
      'R1',
      'looks like R1 (modified: pour 2 after 20s)',
      'looks like R1 (modified: pour 2 after 20s)'
    ]);
    expect(rows[0]).toMatchObject({ description: 'No flow data', timeline: null, date: expect.stringMatching(/^2026-02-\d\d$/) });
    expect(rows[1].description).toMatch(/ total/);
    saveRecipe(db, { id, name: 'R1', tags: [], def: draft });
    expect(brewsFor(db, { key: reading(db, b).structureKey! }).map((r) => r.label)).toEqual([
      'R1', 'looks like R1', 'looks like R1'
    ]);
    db.prepare(`UPDATE brew_pour_readings SET reading = json_set(reading, '$.lowConfidence', json('true')) WHERE bc_uuid = ?`).run(uuid(b));
    expect(brewsFor(db, { key: reading(db, b).structureKey! }).find((r) => r.lowConfidence)).toBeTruthy();
    void logged; void noFlow;
  });
});

describe('note words', () => {
  it('defaults, round-trips, falls back on garbage, keeps an empty list', () => {
    const db = createDb(':memory:');
    expect(getNoteWords(db)).toEqual(DEFAULT_NOTE_WORDS);
    setNoteWords(db, [{ word: 'fast', agitation: 'high' }]);
    expect(getNoteWords(db)).toEqual([{ word: 'fast', agitation: 'high' }]);
    db.prepare(`UPDATE app_meta SET value = 'garbage' WHERE key = 'agitation_note_words'`).run();
    expect(getNoteWords(db)).toEqual(DEFAULT_NOTE_WORDS);
    setNoteWords(db, []);
    expect(getNoteWords(db)).toEqual([]);
  });
});
