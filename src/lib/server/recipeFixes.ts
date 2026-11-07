// One-time boot fix: prod recipes get shares, triggers, ratio lists,
// the Shoebox washed/natural split and two generic tags removed. Keyed by recipe name; the stored JSON is
// edited as plain data, so no value imports from $lib (db.ts runs under node without a bundler).
import type { DatabaseSync } from 'node:sqlite';

// The pre-lengths shape this first fix writes: a pour's trigger is its start-to-start gap from the previous pour.
type Trigger = null | { kind: 'after'; targetS: number; maxS: number } | { kind: 'low' };

export const RECIPE_FIXES_2026_10_MARKER = 'recipe_steps_2026_10';

const after = (targetS: number, maxS: number): Trigger => ({ kind: 'after', targetS, maxS });
const LOW: Trigger = { kind: 'low' };
const A = after(20, 30);
const GABI = [null, after(40, 40), LOW, LOW, LOW, LOW, LOW, LOW];

interface Fix {
  name: string;
  shares?: number[]; // fractions of the water; grams are nulled
  equalSplit?: boolean;
  targets?: number[];
  tol?: number;
  tempC?: number;
  triggers?: Trigger[]; // per pour; the first is always null
  blooms?: boolean[]; // per pour
  dropTags?: string[];
}

// Shares are the data medians (Joocy pours 4-5 stored as 0.150/0.278; matching combines them). Floral confirmed
// on the prod copy 2026-10-29: 94 brews, 4 pours FFFS, 87 with two blooms, medians 18.9/16.7/28.7/35.8.
export const RECIPE_FIXES: Fix[] = [
  { name: "Bean's Beans Standard", shares: [0.205, 0.181, 0.302, 0.311], targets: [16.7], tol: 0.5, triggers: [null, A, A, LOW] },
  { name: "Bean's Beans Floral", shares: [0.189, 0.167, 0.287, 0.358], targets: [18], tol: 0.5, triggers: [null, A, A, LOW] },
  { name: "Bean's Beans Joocy", shares: [0.209, 0.178, 0.192, 0.15, 0.278], targets: [15.5], tol: 0.5, triggers: [null, A, A, LOW, LOW] },
  { name: 'Double Yeet Bloom 3 Pour', shares: [0.205, 0.185, 0.607], targets: [16.7, 18], tol: 0.5, blooms: [true, true, false], tempC: 91, triggers: [null, A, A] },
  { name: 'Standard 3 Pour', shares: [0.205, 0.386, 0.399], targets: [15, 16.7, 18], tol: 0.5, dropTags: ['3 pours'] },
  { name: 'Lance Hedrick 2 Pour', shares: [0.207, 0.793] },
  { name: 'Standard 5 Pour', equalSplit: true, targets: [15, 16.7, 18], tol: 0.5 },
  // Gabi Master A controls the flow (controlsFlow): matching ignores triggers, so they only shape the steps (spare entries cover more pours).
  { name: 'Gabi Standard (bloom)', targets: [18], tol: 0.5, triggers: GABI },
  { name: 'Gabi Gentle (bloom)', targets: [16.7], tol: 0.5, triggers: GABI, dropTags: ['Gentle'] }
];
const SHOEBOX = { equalSplit: true, tol: 0.5, triggers: [null, after(30, 30), LOW, LOW] as Trigger[] };

type Def = Record<string, any>;
function fixDef(def: Def, f: Omit<Fix, 'name' | 'dropTags'>): Def {
  def.pours.forEach((p: Def, i: number) => {
    if (f.shares && f.shares.length === def.pours.length) Object.assign(p, { share: f.shares[i], grams: null });
    if (f.triggers) p.trigger = f.triggers[i] ?? null;
    if (f.blooms) p.bloom = f.blooms[i] ?? false;
  });
  if (f.equalSplit) def.equalSplit = true;
  if (f.tempC != null) def.tempC = f.tempC;
  if (f.targets || f.tol != null) {
    const r = def.ratio ?? {};
    def.ratio = { targets: f.targets ?? r.targets ?? [r.target], tol: f.tol ?? r.tol };
  }
  return def;
}

export function applyRecipeFixes(db: DatabaseSync, marker = RECIPE_FIXES_2026_10_MARKER): void {
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return;
  const now = new Date().toISOString();
  const get = db.prepare(`SELECT id, tags, definition FROM recipes WHERE name = ?`);
  const set = db.prepare(`UPDATE recipes SET name = ?, tags = ?, definition = ?, updated_at = ? WHERE id = ?`);
  type Row = { id: number; tags: string; definition: string };
  const apply = (name: string, f: Fix | (Omit<Fix, 'name'> & { rename: string })) => {
    const row = get.get(name) as Row | undefined;
    if (!row) return;
    const def = fixDef(JSON.parse(row.definition), f);
    const tags = (JSON.parse(row.tags) as string[]).filter((t) => !f.dropTags?.includes(t));
    set.run('rename' in f ? f.rename : name, JSON.stringify(tags), JSON.stringify(def), now, row.id);
  };
  db.exec('BEGIN');
  try {
    for (const f of RECIPE_FIXES) apply(f.name, f);
    const box = get.get('Shoebox QC') as Row | undefined;
    if (box) {
      // Natural first: it copies the untouched def and tags; washed keeps the id and brew links.
      const nat = fixDef(JSON.parse(box.definition), { ...SHOEBOX, targets: [15.3], tempC: 85 });
      // Names are unique (NOCASE); a name someone already made is left alone rather than aborting boot.
      if (!get.get('Shoebox QC (Natural)'))
        db.prepare(`INSERT INTO recipes (name, tags, definition, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
          .run('Shoebox QC (Natural)', box.tags, JSON.stringify(nat), now, now);
      if (!get.get('Shoebox QC (Washed)'))
        apply('Shoebox QC', { ...SHOEBOX, targets: [16.7, 18], tempC: 91.5, rename: 'Shoebox QC (Washed)' });
    }
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, now);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Second boot fix (backlog "Recipe steps own their length"): stored recipes move from per-pour triggers and
// recipe-level bloom hold to per-step lengths. A pure shift: old pour i's trigger is pour i-1's length; the last
// step has none. Then the four recipes that only had the legacy hold get a bloom length: the median start of pour 2
// over their brews on the prod copy (2026-10-29): Standard 3 Pour 60.7s (137 brews), Standard 5 Pour 60.4s (130),
// Lume 3 Pour 60.6s (21), Lance Hedrick 2 Pour 32.5s (56), in clusters near 30s / 45s / 60s. User call (preview
// round 1): most recipes bloom anywhere from 30-60s, so Standard 3/5 Pour and Lance Hedrick get a 30-60 range
// (no clean match turns "modified"); Lume keeps 60s.
export const RECIPE_LENGTH_MARKER = 'recipe_lengths_2026_10';
const time = (targetS: number, maxS: number) => ({ kind: 'time', targetS, maxS });
const BLOOM_LENGTHS: Record<string, Def> = {
  'Standard 3 Pour': time(30, 60),
  'Standard 5 Pour': time(30, 60),
  'Lume 3 Pour': time(60, 60),
  'Lance Hedrick 2 Pour': time(30, 60)
};

export function lengthsOf(def: Def, bloom?: Def): Def {
  const pours = (def.pours ?? []) as Def[];
  if (pours.length && pours.every((p) => !('trigger' in p)) && pours.some((p) => 'length' in p)) return def; // already converted
  const trig = pours.map((p) => (p.trigger ? (p.trigger.kind === 'after' ? { ...p.trigger, kind: 'time' } : p.trigger) : null));
  pours.forEach((p, i) => {
    p.length = trig[i + 1] ?? null;
    delete p.trigger;
  });
  // A bloom with no length of its own keeps the legacy recipe-level hold (to 5s) as its length; the named recipes' values win.
  const hold = typeof def.bloomHoldS === 'number' ? Math.round(def.bloomHoldS / 5) * 5 : 0;
  const fallback = pours[0]?.bloom && hold > 0 ? time(hold, hold) : undefined;
  if (pours.length > 1 && !pours[0].length) pours[0].length = bloom ?? fallback ?? null;
  delete def.bloomHoldS;
  delete def.bloomHoldTolS;
  return def;
}

export function applyRecipeLengthFix(db: DatabaseSync, marker = RECIPE_LENGTH_MARKER): void {
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return;
  const now = new Date().toISOString();
  const set = db.prepare(`UPDATE recipes SET definition = ?, updated_at = ? WHERE id = ?`);
  db.exec('BEGIN');
  try {
    for (const r of db.prepare(`SELECT id, name, definition FROM recipes`).all() as { id: number; name: string; definition: string }[])
      set.run(JSON.stringify(lengthsOf(JSON.parse(r.definition), BLOOM_LENGTHS[r.name])), now, r.id);
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, now);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
