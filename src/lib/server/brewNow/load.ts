import type { DatabaseSync } from 'node:sqlite';
import { processGroup, type ProcessGroup } from '$lib/processGroups';
import { parseMethod, grindValue, restDays, normalizeRoastLevel } from '../insights/facts';
import { bcLocalTime, addDays } from '../insights/time';
import { localToday } from '../localToday';
import { getGearDetails } from '../gearDetails';

export interface BrewRow {
  id: number; coffeeId: number; slug: string; roaster: string; coffeeName: string;
  origin: string | null; processGroup: ProcessGroup; roastLevel: string | null; localTime: string; restDays: number | null;
  grinder: string | null; grind: string | null; grindNum: number | null; dripper: string | null; filter: string | null;
  tempC: number | null; dose: number | null; waterG: number | null; water: string | null;
  recipeId: number | null; recipeName: string | null; rating: number | null; best: boolean; notes: string | null;
  grinderArchived: boolean; methodArchived: boolean; // archived in BQ: still evidence, never offered
}
// Pool key: 'cone' / 'any' or the name itself (own-data gear, or a dripper with no shape on file).
export interface GearClass { dripper: (name: string | null) => string; filter: (name: string | null) => string }
export interface CoffeeDetails {
  id: number; slug: string; roaster: string; coffeeName: string; roastDate: string | null; restDays: number | null;
  gramsLeft: number | null; processing: string | null; origin: string | null; roastLevel: string | null;
}

interface Raw {
  id: number; at: string; coffee_id: number; slug: string | null; roaster: string; coffee_name: string; origin: string | null;
  processing: string | null; roast_level: string | null; roast_date: string | null; fs: string | null; fe: string | null;
  grinder: string | null; grind: string | null; method: string | null; tools: string | null; temp: number | null; dose: number | null;
  water_g: number | null; water: string | null; recipe_id: number | null; recipe_name: string | null; rating: number | null;
  best: number; notes: string | null; grinder_archived: number | null; method_archived: number | null;
}

const pos = (n: number | null) => (n && n > 0 ? n : null);

// Every brew on a linked coffee, once. Archived gear stays: its brews are evidence (R1 only hides it from lists).
export function loadBrewRows(db: DatabaseSync): BrewRow[] {
  const rows = db.prepare(
    `SELECT b.id, b.bc_created_at AS at, c.id AS coffee_id, c.slug, c.roaster, c.coffee_name, c.origin, c.processing, c.roast_level,
            c.roast_date, c.frozen_start_date AS fs, c.frozen_end_date AS fe, g.name AS grinder, b.grind_setting AS grind,
            m.name AS method, m.preparation_tools AS tools, b.brew_temperature AS temp, b.ground_coffee_g AS dose,
            b.water_amount_g AS water_g, COALESCE(w.name, b.water) AS water, rec.id AS recipe_id, rec.name AS recipe_name,
            b.rating, b.best_brew AS best, b.notes, g.bc_archived AS grinder_archived, m.bc_archived AS method_archived
     FROM beanconqueror_brews b
     JOIN beanconqueror_beans bean ON bean.id = b.bean_id
     JOIN coffees c ON c.id = bean.coffee_id
     LEFT JOIN beanconqueror_grinders g ON g.id = b.mill_id
     LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
     LEFT JOIN beanconqueror_waters w ON w.id = b.water_id
     LEFT JOIN brew_recipe_matches x ON x.brew_id = b.id
     LEFT JOIN recipes rec ON rec.id = x.recipe_id
     ORDER BY b.bc_created_at, b.id`
  ).all() as unknown as Raw[];
  return rows.map((r) => {
    const localTime = bcLocalTime(r.at);
    const grind = r.grind?.trim() || null;
    return {
      id: r.id, coffeeId: r.coffee_id, slug: r.slug ?? '', roaster: r.roaster, coffeeName: r.coffee_name, origin: r.origin,
      processGroup: processGroup(r.processing), roastLevel: normalizeRoastLevel(r.roast_level), localTime,
      restDays: restDays(r.roast_date, r.fs, r.fe, localTime.slice(0, 10)),
      grinder: r.grinder, grind, grindNum: grindValue(grind), ...parseMethod(r.method, r.tools),
      tempC: pos(r.temp), dose: pos(r.dose), waterG: pos(r.water_g), water: r.water,
      recipeId: r.recipe_id, recipeName: r.recipe_name, rating: pos(r.rating), best: r.best === 1, notes: r.notes?.trim() || null,
      grinderArchived: r.grinder_archived === 1, methodArchived: r.method_archived === 1
    };
  });
}

// Which drippers/filters pool together: Conical drippers share 'cone'; own-data gear stands alone; the rest of the
// filters share 'any'. A dripper with no Shape on file stands alone.
export function loadGearClass(db: DatabaseSync): GearClass {
  const d = getGearDetails(db);
  const of = (kind: string, name: string | null) => d.find((x) => x.kind === kind && x.name === name)?.values;
  const own = (kind: string, name: string | null) => of(kind, name)?.ownData === 'Own brews only';
  return {
    dripper: (name) => (!name || own('dripper', name) ? (name ?? '') : of('dripper', name)?.shape === 'Conical' ? 'cone' : name),
    filter: (name) => (!name || own('filter', name) ? (name ?? '') : 'any')
  };
}

// Gear for the pickers, newest first: used in the last 365 days, archived (R1) left out. Rows arrive oldest first.
export function gearOptions(rows: BrewRow[], today = localToday()): { grinders: string[]; drippers: string[]; filters: string[] } {
  const since = addDays(today, -365);
  const recent = rows.filter((r) => r.localTime.slice(0, 10) >= since).reverse();
  const list = (pick: (r: BrewRow) => string | null, skip: (r: BrewRow) => boolean) =>
    [...new Set(recent.filter((r) => !skip(r)).flatMap((r) => pick(r) ?? []))];
  return {
    grinders: list((r) => r.grinder, (r) => r.grinderArchived),
    drippers: list((r) => r.dripper, (r) => r.methodArchived),
    filters: list((r) => r.filter, (r) => r.methodArchived)
  };
}

// The most used of each over the last 30 brews that still have non-archived gear; ties go to the most recent.
export function gearDefaults(rows: BrewRow[]): { grinder: string | null; dripper: string | null; filter: string | null } {
  const top = (pick: (r: BrewRow) => string | null, skip: (r: BrewRow) => boolean) => {
    const c = new Map<string, number>();
    for (const r of rows.filter((r) => !skip(r) && pick(r)).slice(-30).reverse()) c.set(pick(r)!, (c.get(pick(r)!) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; // stable sort: first-seen (most recent) wins ties
  };
  return {
    grinder: top((r) => r.grinder, (r) => r.grinderArchived),
    dripper: top((r) => r.dripper, (r) => r.methodArchived),
    filter: top((r) => r.filter, (r) => r.methodArchived)
  };
}

export function coffeeDetails(db: DatabaseSync, slug: string, today: string): CoffeeDetails | null {
  const c = db.prepare(
    `SELECT c.id, c.slug, c.roaster, c.coffee_name, c.roast_date, c.frozen_start_date AS fs, c.frozen_end_date AS fe, c.amount_g,
            c.processing, c.origin, c.roast_level,
            (SELECT COALESCE(SUM(b.ground_coffee_g), 0) FROM beanconqueror_brews b
             JOIN beanconqueror_beans bean ON bean.id = b.bean_id WHERE bean.coffee_id = c.id) AS used
     FROM coffees c WHERE c.slug = ?`
  ).get(slug) as { id: number; slug: string; roaster: string; coffee_name: string; roast_date: string | null; fs: string | null;
    fe: string | null; amount_g: number | null; processing: string | null; origin: string | null; roast_level: string | null; used: number } | undefined;
  if (!c) return null;
  return {
    id: c.id, slug: c.slug, roaster: c.roaster, coffeeName: c.coffee_name, roastDate: c.roast_date,
    restDays: restDays(c.roast_date, c.fs, c.fe, today), gramsLeft: c.amount_g === null ? null : Math.max(0, c.amount_g - c.used),
    processing: c.processing, origin: c.origin, roastLevel: c.roast_level
  };
}
