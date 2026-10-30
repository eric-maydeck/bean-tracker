import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { applyRecipeFixes, RECIPE_FIXES_2026_10_MARKER } from './recipeFixes';
import { listRecipes } from './recipes';
import { parseRecipeDef } from '../recipes';
import { recipeSlugs } from '../recipeSlug';

const M = 'test_marker';
// name -> [tags, pours (grams), ratio target, tol, tempC]; the old (pre-triggers) shape, as in prod.
const OLD: Record<string, [string[], number, number, number, number]> = {
  "Bean's Beans Standard": [['BBS'], 4, 16.7, 0.7, 91],
  'Shoebox QC': [['4SY', 'Shoebox'], 4, 16.7, 0.7, 91],
  'Standard 3 Pour': [['3 pours'], 3, 16.7, 0.7, 92],
  "Bean's Beans Floral": [['BBF'], 4, 18, 0.7, 91],
  "Bean's Beans Joocy": [['BBJ'], 5, 15.5, 0.7, 91],
  'Double Yeet Bloom 3 Pour': [['1 long pour'], 3, 16.7, 0.7, 88],
  'Lance Hedrick 2 Pour': [['LH'], 2, 16, 1, 90],
  'Standard 5 Pour': [['5 pours'], 5, 16.7, 1.7, 92],
  'Gabi Standard (bloom)': [['Gabi Standard'], 3, 18, 1, 92],
  'Gabi Gentle (bloom)': [['Gabi Gentle', 'Gentle'], 3, 16, 1, 92],
  'Lume 3 Pour': [['Lume'], 3, 16.67, 1, 90]
};
const oldDef = (n: number, target: number, tol: number, tempC: number) => ({
  v: 1,
  pours: Array.from({ length: n }, (_, i) => ({
    bloom: i === 0, grams: 60, share: null, speed: 'fast', rateGps: null, agitation: 'high', tool: null,
    swirlAfter: false, startS: i * 30, durationS: 5
  })),
  pourCount: { min: n, max: n },
  bloomHoldS: 30, bloomHoldTolS: 5, ratio: { target, tol }, tempC, totalS: 150, notes: null, drippers: [], anySpeed: false
});
function setup() {
  const db = createDb(':memory:');
  db.exec('DELETE FROM recipes');
  let id = 1;
  for (const [name, [tags, n, target, tol, t]] of Object.entries(OLD))
    db.prepare(`INSERT INTO recipes (id, name, tags, definition, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')`)
      .run(id++, name, JSON.stringify(tags), JSON.stringify(oldDef(n, target, tol, t)));
  applyRecipeFixes(db, M);
  const by = (name: string) => listRecipes(db).find((r) => r.name === name)!;
  return { db, by };
}
const trig = (r: { def: { pours: { trigger: unknown }[] } }) => r.def.pours.map((p) => p.trigger);
const after = (t: number, m: number) => ({ kind: 'after', targetS: t, maxS: m });
const low = { kind: 'low' };

describe('applyRecipeFixes', () => {
  it('writes shares as fractions and nulls grams', () => {
    const { by } = setup();
    const shares = {
      "Bean's Beans Standard": [0.205, 0.181, 0.302, 0.311],
      "Bean's Beans Floral": [0.189, 0.167, 0.287, 0.358],
      "Bean's Beans Joocy": [0.209, 0.178, 0.192, 0.15, 0.278],
      'Double Yeet Bloom 3 Pour': [0.205, 0.185, 0.607],
      'Standard 3 Pour': [0.205, 0.386, 0.399],
      'Lance Hedrick 2 Pour': [0.207, 0.793]
    };
    for (const [n, s] of Object.entries(shares)) {
      expect(by(n).def.pours.map((p) => p.share)).toEqual(s);
      expect(by(n).def.pours.every((p) => p.grams === null)).toBe(true);
    }
  });

  it('sets equalSplit on Std5 and both Shoebox recipes only', () => {
    const { by, db } = setup();
    for (const n of ['Standard 5 Pour', 'Shoebox QC (Washed)', 'Shoebox QC (Natural)']) expect(by(n).def.equalSplit).toBe(true);
    expect(listRecipes(db).filter((r) => r.def.equalSplit)).toHaveLength(3);
  });

  it('rewrites ratios and temperature', () => {
    const { by } = setup();
    for (const n of ["Bean's Beans Standard", "Bean's Beans Floral", "Bean's Beans Joocy", 'Double Yeet Bloom 3 Pour'])
      expect(by(n).def.ratio.tol).toBe(0.5);
    expect(by('Standard 5 Pour').def.ratio).toEqual({ targets: [15, 16.7, 18], tol: 0.5 });
    expect(by('Standard 3 Pour').def.ratio).toEqual({ targets: [15, 16.7, 18], tol: 0.5 });
    expect(by('Double Yeet Bloom 3 Pour').def.ratio.targets).toEqual([16.7, 18]);
    expect(by('Shoebox QC (Washed)').def.ratio).toEqual({ targets: [16.7, 18], tol: 0.5 });
    expect(by('Shoebox QC (Washed)').def.tempC).toBe(91.5);
    expect(by('Shoebox QC (Natural)').def.ratio).toEqual({ targets: [15.3], tol: 0.5 });
    expect(by('Shoebox QC (Natural)').def.tempC).toBe(85);
    expect(by('Lance Hedrick 2 Pour').def.ratio).toEqual({ targets: [16], tol: 1 });
    expect(by('Gabi Standard (bloom)').def.ratio).toEqual({ targets: [18], tol: 0.5 });
    expect(by('Gabi Gentle (bloom)').def.ratio).toEqual({ targets: [16.7], tol: 0.5 });
    expect(by('Lume 3 Pour').def.ratio).toEqual({ targets: [16.67], tol: 1 });
  });

  it('sets triggers', () => {
    const { by } = setup();
    for (const n of ["Bean's Beans Standard", "Bean's Beans Floral"])
      expect(trig(by(n))).toEqual([null, after(20, 30), after(20, 30), low]);
    expect(trig(by('Double Yeet Bloom 3 Pour'))).toEqual([null, after(20, 30), after(20, 30)]);
    expect(by('Double Yeet Bloom 3 Pour').def.pours.map((p) => p.bloom)).toEqual([true, true, false]);
    for (const n of ['Gabi Standard (bloom)', 'Gabi Gentle (bloom)']) expect(trig(by(n))).toEqual([null, after(40, 40), low]);
    expect(trig(by("Bean's Beans Joocy"))).toEqual([null, after(20, 30), after(20, 30), low, low]);
    for (const n of ['Shoebox QC (Washed)', 'Shoebox QC (Natural)'])
      expect(trig(by(n))).toEqual([null, after(30, 30), low, low]);
    expect(trig(by('Lume 3 Pour'))).toEqual([null, null, null]);
  });

  it('splits Shoebox into washed (same id) and natural (new id, same tags) with their own slugs', () => {
    const { by, db } = setup();
    expect(by('Shoebox QC (Washed)').id).toBe(2);
    expect(by('Shoebox QC (Natural)').id).not.toBe(2);
    expect(by('Shoebox QC (Natural)').tags).toEqual(['4SY', 'Shoebox']);
    expect(listRecipes(db).some((r) => r.name === 'Shoebox QC')).toBe(false);
    expect([...recipeSlugs(listRecipes(db)).values()]).toEqual(expect.arrayContaining(['shoebox-qc-washed', 'shoebox-qc-natural']));
  });

  it('removes the generic tags', () => {
    const { by } = setup();
    expect(by('Standard 3 Pour').tags).toEqual([]);
    expect(by('Gabi Gentle (bloom)').tags).toEqual(['Gabi Gentle']);
  });

  it('every rewritten def parses', () => {
    const { db } = setup();
    for (const r of listRecipes(db)) expect(parseRecipeDef(r.def), r.name).toHaveProperty('def');
  });

  it('is idempotent and sets the marker', () => {
    const { db } = setup();
    const snap = () => JSON.stringify(db.prepare(`SELECT * FROM recipes ORDER BY id`).all());
    const before = snap();
    applyRecipeFixes(db, M);
    expect(snap()).toBe(before);
    expect(db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M)).toBeTruthy();
  });

  it('is a no-op apart from the marker when none of the recipes exist', () => {
    const db = createDb(':memory:');
    db.exec('DELETE FROM recipes');
    applyRecipeFixes(db, M);
    expect(db.prepare(`SELECT COUNT(*) n FROM recipes`).get()).toEqual({ n: 0 });
    expect(db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M)).toBeTruthy();
    expect(RECIPE_FIXES_2026_10_MARKER).toBe('recipe_steps_2026_10');
  });

  describe('collisions and shape mismatches', () => {
    const fresh = () => {
      const db = createDb(':memory:');
      db.exec('DELETE FROM recipes');
      const ins = (name: string, n = 4) =>
        db.prepare(`INSERT INTO recipes (name, tags, definition, created_at, updated_at) VALUES (?, '["x"]', ?, 'x', 'x')`)
          .run(name, JSON.stringify(oldDef(n, 16.7, 0.7, 91)));
      return { db, ins, names: () => (db.prepare(`SELECT name FROM recipes ORDER BY id`).all() as { name: string }[]).map((r) => r.name) };
    };

    it('an existing Natural is left untouched; Shoebox QC is still renamed', () => {
      const { db, ins, names } = fresh();
      ins('Shoebox QC');
      ins('shoebox qc (natural)');
      const before = db.prepare(`SELECT * FROM recipes WHERE id = 2`).get();
      applyRecipeFixes(db, M);
      expect(names()).toEqual(['Shoebox QC (Washed)', 'shoebox qc (natural)']);
      expect(db.prepare(`SELECT * FROM recipes WHERE id = 2`).get()).toEqual(before);
      expect(db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M)).toBeTruthy();
    });

    it('an existing Washed leaves Shoebox QC as is', () => {
      const { db, ins, names } = fresh();
      ins('Shoebox QC');
      ins('Shoebox QC (Washed)');
      applyRecipeFixes(db, M);
      expect(names()).toEqual(expect.arrayContaining(['Shoebox QC', 'Shoebox QC (Washed)']));
      expect(db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M)).toBeTruthy();
    });

    it('leaves shares and grams alone when the pour count differs from the data', () => {
      const { db, ins } = fresh();
      ins("Bean's Beans Standard", 3);
      applyRecipeFixes(db, M);
      const def = JSON.parse((db.prepare(`SELECT definition d FROM recipes`).get() as { d: string }).d);
      expect(def.pours.map((p: { share: unknown; grams: number }) => [p.share, p.grams])).toEqual([[null, 60], [null, 60], [null, 60]]);
      expect(def.ratio.tol).toBe(0.5);
    });
  });
});
