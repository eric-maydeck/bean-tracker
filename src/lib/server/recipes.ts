// Recipe storage, brew matching and structure discovery (plan 2026-10-27-pour-reading-recipes).
import type { DatabaseSync } from 'node:sqlite';
import { describeReading, timelineOf, type PourReading, type Timeline } from '$lib/pours';
import {
  draftFromReadings,
  describeRecipe,
  matchBrew,
  recipeTimeline,
  type Recipe,
  type RecipeDef
} from '$lib/recipes';
import { parseMethod } from './insights/facts';

export class RecipeError extends Error {}
export const MIN_GROUP = 10;

export function listRecipes(db: DatabaseSync): Recipe[] {
  const rows = db.prepare(`SELECT id, name, tags, definition FROM recipes ORDER BY name`).all() as {
    id: number;
    name: string;
    tags: string;
    definition: string;
  }[];
  // Defs saved before the dripper fields existed lack them.
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tags: JSON.parse(r.tags),
    def: { drippers: [], anySpeed: false, ...JSON.parse(r.definition) }
  }));
}

export function saveRecipe(
  db: DatabaseSync,
  input: { id?: number; name: string; tags: string[]; def: RecipeDef; locks?: Record<string, boolean> }
): number {
  const now = new Date().toISOString();
  let id = input.id;
  try {
    if (id != null)
      db.prepare(`UPDATE recipes SET name = ?, tags = ?, definition = ?, updated_at = ? WHERE id = ?`).run(
        input.name, JSON.stringify(input.tags), JSON.stringify(input.def), now, id
      );
    else
      id = Number(
        db.prepare(`INSERT INTO recipes (name, tags, definition, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(
          input.name, JSON.stringify(input.tags), JSON.stringify(input.def), now, now
        ).lastInsertRowid
      );
  } catch (e) {
    if (e instanceof Error && /UNIQUE/i.test(e.message)) throw new RecipeError('A recipe with that name exists');
    throw e;
  }
  // The lock belongs to the dripper, not the recipe: ticking it in any recipe for that dripper sets it for all.
  for (const name of input.def.drippers)
    if (input.locks?.[name] != null)
      db.prepare(input.locks[name] ? `INSERT OR IGNORE INTO locked_drippers (name) VALUES (?)` : `DELETE FROM locked_drippers WHERE name = ?`).run(name);
  rematchBrews(db);
  return id!;
}

export function deleteRecipe(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM recipes WHERE id = ?`).run(id);
  rematchBrews(db);
}

export function dismissStructure(db: DatabaseSync, key: string): void {
  db.prepare(`INSERT OR REPLACE INTO dismissed_structures (structure_key, dismissed_at) VALUES (?, ?)`).run(
    key, new Date().toISOString()
  );
  rematchBrews(db);
}

export function undismissStructure(db: DatabaseSync, key: string): void {
  db.prepare(`DELETE FROM dismissed_structures WHERE structure_key = ?`).run(key);
  rematchBrews(db);
}

export const lockedDrippers = (db: DatabaseSync): string[] =>
  (db.prepare(`SELECT name FROM locked_drippers ORDER BY name`).all() as { name: string }[]).map((r) => r.name);

/** Distinct drippers across all brews, for the editor's dripper choice. */
export function listDrippers(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT m.name method, m.preparation_tools tools
       FROM beanconqueror_brews b JOIN beanconqueror_methods m ON m.id = b.preparation_id`
    )
    .all() as { method: string | null; tools: string | null }[];
  return [...new Set(rows.flatMap((r) => parseMethod(r.method, r.tools).dripper ?? []))].sort();
}

/** Which recipes a structure's brews now match, with brew counts. */
export function matchedBy(db: DatabaseSync, key: string): { name: string; count: number }[] {
  return db
    .prepare(
      `SELECT rec.name, COUNT(*) count FROM brew_pour_readings r
       JOIN beanconqueror_brews b ON b.bc_uuid = r.bc_uuid
       JOIN brew_recipe_matches x ON x.brew_id = b.id JOIN recipes rec ON rec.id = x.recipe_id
       WHERE r.structure_key = ? GROUP BY rec.id ORDER BY count DESC, rec.name`
    )
    .all(key) as { name: string; count: number }[];
}

/** A stored reading, or null for none or an unreadable flow (stored as '{}' with pour_count 0). */
const parseReading = (json: string | null, pourCount: number | null): PourReading | null =>
  json && pourCount ? (JSON.parse(json) as PourReading) : null;

// ponytail: rematches every brew on a recipe change; ~1.5k brews × a few recipes is ms
export function rematchBrews(db: DatabaseSync, brewIds?: number[]): number {
  const recipes = listRecipes(db);
  const locked = new Set(lockedDrippers(db));
  const where = brewIds ? `WHERE b.id IN (${brewIds.map(() => '?').join(',') || 'NULL'})` : '';
  const rows = db
    .prepare(
      `SELECT b.id, b.notes, b.brew_temperature temp, r.reading, r.pour_count,
              m.name method, m.preparation_tools tools
       FROM beanconqueror_brews b LEFT JOIN brew_pour_readings r ON r.bc_uuid = b.bc_uuid
       LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id ${where}`
    )
    .all(...(brewIds ?? [])) as {
    id: number;
    notes: string | null;
    temp: number | null;
    reading: string | null;
    pour_count: number | null;
    method: string | null;
    tools: string | null;
  }[];
  const own = !db.isTransaction;
  if (own) db.exec('BEGIN');
  try {
    const del = db.prepare(`DELETE FROM brew_recipe_matches WHERE brew_id = ?`);
    const ins = db.prepare(`INSERT INTO brew_recipe_matches (brew_id, recipe_id, how, diffs) VALUES (?, ?, ?, ?)`);
    let n = 0;
    for (const r of rows) {
      del.run(r.id);
      const m = matchBrew(
        {
          notes: r.notes,
          reading: parseReading(r.reading, r.pour_count),
          tempC: r.temp && r.temp > 0 ? r.temp : null,
          dripper: parseMethod(r.method, r.tools).dripper
        },
        recipes,
        locked
      );
      if (!m) continue;
      ins.run(r.id, m.recipeId, m.how, JSON.stringify(m.diffs));
      n++;
    }
    if (own) db.exec('COMMIT');
    return n;
  } catch (e) {
    if (own) db.exec('ROLLBACK');
    throw e;
  }
}

export interface Group {
  key: string;
  count: number;
  avgRating: number | null;
  tagged: number;
  suggestedName: string | null;
  suggestedPhrase: string | null;
  common: string[];
  description: string;
  draft: RecipeDef;
  timeline: Timeline;
}

interface GroupRow {
  key: string;
  reading: string;
  notes: string | null;
  rating: number | null;
  temp: number | null;
  method: string | null;
  tools: string | null;
  water: string | null;
  matched: number;
}

/** Mostly matched by a saved recipe (the structure is already named). */
const mostlyMatched = (rows: GroupRow[]) => rows.filter((r) => r.matched).length * 2 >= rows.length;

const TAG = /^\s*([A-Z0-9]*[A-Z][A-Z0-9]*)(?=[\s.,;:!]|$)/;
// Known exception to the conventions test: the shipped Part B phrase detector.
const PHRASE = /\b(\d+|one|two|three|four|five)\s+(yeets?|pours?|blooms?)\b/i;

/** Most frequent value; ties go to the first seen. */
function mostCommon(xs: string[]): string | null {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function groupRows(db: DatabaseSync): Map<string, GroupRow[]> {
  const rows = db
    .prepare(
      `SELECT r.structure_key key, r.reading, b.notes, b.rating, b.brew_temperature temp,
              m.name method, m.preparation_tools tools, COALESCE(w.name, b.water) water,
              EXISTS (SELECT 1 FROM brew_recipe_matches x WHERE x.brew_id = b.id) matched
       FROM brew_pour_readings r
       JOIN beanconqueror_brews b ON b.bc_uuid = r.bc_uuid
       LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
       LEFT JOIN beanconqueror_waters w ON w.id = b.water_id
       WHERE r.structure_key IS NOT NULL AND r.low_confidence = 0 AND r.pour_count > 0
         AND r.structure_key NOT IN (SELECT structure_key FROM dismissed_structures)
       ORDER BY b.bc_created_at, b.id`
    )
    .all() as unknown as GroupRow[];
  const by = new Map<string, GroupRow[]>();
  for (const r of rows) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  return by;
}

/** Fields shared by at least 80% of the rows. */
function commonOf(rows: GroupRow[]): string[] {
  const shared = (vals: (string | null)[]) => {
    const v = mostCommon(vals.filter((x): x is string => !!x));
    return v && vals.filter((x) => x === v).length >= rows.length * 0.8 ? v : null;
  };
  const gear = rows.map((r) => parseMethod(r.method, r.tools));
  return [shared(gear.map((g) => g.dripper)), shared(gear.map((g) => g.filter)), shared(rows.map((r) => r.water))].filter(
    (x): x is string => x != null
  );
}

export function discoverGroups(db: DatabaseSync): Group[] {
  const out: Group[] = [];
  for (const [key, rows] of groupRows(db)) {
    if (rows.length < MIN_GROUP || mostlyMatched(rows)) continue;
    const words = rows.flatMap((r) => {
      const m = TAG.exec(r.notes ?? '');
      return m && m[1].length >= 2 && m[1].length <= 6 ? [m[1]] : [];
    });
    const phrases = rows.flatMap((r) => {
      const clause = (r.notes ?? '').split(/[.;]/)[0].trim();
      return clause.length <= 60 && PHRASE.test(clause) ? [clause] : [];
    });
    const rated = rows.filter((r) => r.rating != null && r.rating > 0);
    const draft = draftFromReadings(
      rows.map((r) => JSON.parse(r.reading) as PourReading),
      rows.map((r) => (r.temp && r.temp > 0 ? r.temp : null))
    );
    out.push({
      key,
      count: rows.length,
      avgRating: rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null,
      tagged: words.length,
      suggestedName: mostCommon(words),
      suggestedPhrase: mostCommon(phrases),
      common: commonOf(rows),
      description: describeRecipe(draft),
      draft,
      timeline: recipeTimeline(draft)
    });
  }
  return out.sort((a, b) => b.count - a.count || b.tagged - a.tagged || a.key.localeCompare(b.key));
}

export function smallGroupCount(db: DatabaseSync): number {
  return [...groupRows(db).values()].filter((rows) => rows.length < MIN_GROUP && !mostlyMatched(rows)).length;
}

export interface BrewRow {
  date: string;
  coffeeName: string | null;
  slug: string | null;
  rating: number | null;
  label: string | null;
  description: string;
  dripper: string | null;
  gear: string;
  lowConfidence: boolean;
  timeline: Timeline | null;
}

export const BREW_ROWS = 10;
type Item = { recipe: number } | { key: string };

/** How many brews an item's list draws from. */
export function brewCount(db: DatabaseSync, item: Item): number {
  const [from, arg] =
    'recipe' in item
      ? ['brew_recipe_matches WHERE recipe_id = ?', item.recipe]
      : ['brew_pour_readings WHERE structure_key = ?', item.key];
  return (db.prepare(`SELECT COUNT(*) n FROM ${from}`).get(arg) as { n: number }).n;
}

/** The newest BREW_ROWS brews, or the top-rated ones (rating desc, then newest). */
export function brewsFor(db: DatabaseSync, item: Item, order: 'latest' | 'top' = 'latest'): BrewRow[] {
  const [where, arg] = 'recipe' in item ? ['x.recipe_id = ?', item.recipe] : ['r.structure_key = ?', item.key];
  const sort =
    order === 'top'
      ? `COALESCE(b.rating, 0) DESC, b.bc_created_at DESC, b.id DESC`
      : `b.bc_created_at DESC, b.id DESC`;
  const rows = db
    .prepare(
      `SELECT b.bc_created_at at, COALESCE(c.coffee_name, bean.name) coffee, c.slug, b.rating,
              rec.name recipe, x.how, x.diffs, r.reading, r.pour_count,
              m.name method, m.preparation_tools tools
       FROM beanconqueror_brews b
       LEFT JOIN brew_pour_readings r ON r.bc_uuid = b.bc_uuid
       LEFT JOIN brew_recipe_matches x ON x.brew_id = b.id
       LEFT JOIN recipes rec ON rec.id = x.recipe_id
       LEFT JOIN beanconqueror_beans bean ON bean.id = b.bean_id
       LEFT JOIN coffees c ON c.id = bean.coffee_id
       LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
       WHERE ${where} ORDER BY ${sort} LIMIT ${BREW_ROWS}`
    )
    .all(arg) as unknown as {
    at: string;
    coffee: string | null;
    slug: string | null;
    rating: number | null;
    recipe: string | null;
    how: 'logged' | 'match' | 'modified' | null;
    diffs: string | null;
    reading: string | null;
    pour_count: number | null;
    method: string | null;
    tools: string | null;
  }[];
  return rows.map((r) => {
    const reading = parseReading(r.reading, r.pour_count);
    let label: string | null = null;
    if (r.how && r.recipe) {
      const diffs = JSON.parse(r.diffs ?? '[]') as { text: string; modified: boolean }[];
      const mods = diffs.filter((d) => d.modified).map((d) => d.text);
      label =
        r.how === 'logged' ? r.recipe : r.how === 'match' ? `looks like ${r.recipe}` : `looks like ${r.recipe} (modified: ${mods.join(', ')})`;
      for (const d of diffs) if (!d.modified) label += ` · ${d.text}`;
    }
    const g = parseMethod(r.method, r.tools);
    return {
      date: r.at.slice(0, 10), // local wall time with a fake Z: never converted
      coffeeName: r.coffee,
      slug: r.slug,
      rating: r.rating,
      label,
      description: reading ? describeReading(reading) : 'No flow data',
      dripper: g.dripper,
      gear: g.filter ?? '',
      lowConfidence: reading?.lowConfidence ?? false,
      timeline: reading ? timelineOf(reading) : null
    };
  });
}
