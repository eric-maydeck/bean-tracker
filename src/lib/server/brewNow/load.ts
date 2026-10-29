import type { DatabaseSync } from 'node:sqlite';
import { processGroup, type ProcessGroup } from '$lib/processGroups';
import { parseMethod, grindValue, restDays, normalizeRoastLevel } from '../insights/facts';
import { bcLocalTime, addDays } from '../insights/time';
import { localToday } from '../localToday';
import { getGearDetails } from '../gearDetails';
import { OWN_DATA_ONLY } from '$lib/gear';
import { recipeSlugs } from '$lib/recipeSlug';
import { listRecipes } from '../recipes';

// recipeSlug: the /recipes/<slug> path part, from the one server-side slug source (recipeSlugs).
export interface BrewRow {
  id: number; coffeeId: number; slug: string; roaster: string; coffeeName: string;
  origin: string | null; processGroup: ProcessGroup; roastLevel: string | null; localTime: string; restDays: number | null;
  grinder: string | null; grind: string | null; grindNum: number | null; dripper: string | null; filter: string | null;
  tempC: number | null; dose: number | null; waterG: number | null; water: string | null;
  recipeId: number | null; recipeName: string | null; recipeSlug?: string | null; rating: number | null; best: boolean; notes: string | null;
  decaf: boolean; grinderArchived: boolean; methodArchived: boolean; // archived in BQ: still evidence, never offered
}
// Pool key: 'cone' / 'any' or the name itself (own-data gear, or a dripper with no shape on file).
export interface GearClass { dripper: (name: string | null) => string; filter: (name: string | null) => string }
export interface CoffeeDetails {
  id: number; slug: string; roaster: string; coffeeName: string; roastDate: string | null; restDays: number | null;
  gramsLeft: number | null; processing: string | null; origin: string | null; roastLevel: string | null; decaf: boolean;
  status: 'backlog' | 'open' | 'archive';
}

interface Raw {
  id: number; at: string; coffee_id: number; slug: string | null; roaster: string; coffee_name: string; origin: string | null;
  processing: string | null; roast_level: string | null; roast_date: string | null; fs: string | null; fe: string | null;
  grinder: string | null; grind: string | null; method: string | null; tools: string | null; temp: number | null; dose: number | null;
  water_g: number | null; water: string | null; recipe_id: number | null; recipe_name: string | null; rating: number | null;
  best: number; notes: string | null; decaf: number; grinder_archived: number | null; method_archived: number | null;
}

const pos = (n: number | null) => (n && n > 0 ? n : null);

// Every brew on a linked coffee, once. Archived gear stays: its brews are evidence (R1 only hides it from lists).
export function loadBrewRows(db: DatabaseSync): BrewRow[] {
  const rows = db.prepare(
    `SELECT b.id, b.bc_created_at AS at, c.id AS coffee_id, c.slug, c.roaster, c.coffee_name, c.origin, c.processing, c.roast_level,
            c.roast_date, c.frozen_start_date AS fs, c.frozen_end_date AS fe, g.name AS grinder, b.grind_setting AS grind,
            m.name AS method, m.preparation_tools AS tools, b.brew_temperature AS temp, b.ground_coffee_g AS dose,
            b.water_amount_g AS water_g, COALESCE(w.name, b.water) AS water, rec.id AS recipe_id, rec.name AS recipe_name,
            b.rating, b.best_brew AS best, b.notes, c.decaf, g.bc_archived AS grinder_archived, m.bc_archived AS method_archived
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
  const slugs = recipeSlugs(listRecipes(db));
  return rows.map((r) => {
    const localTime = bcLocalTime(r.at);
    const grind = r.grind?.trim() || null;
    return {
      id: r.id, coffeeId: r.coffee_id, slug: r.slug ?? '', roaster: r.roaster, coffeeName: r.coffee_name, origin: r.origin,
      processGroup: processGroup(r.processing), roastLevel: normalizeRoastLevel(r.roast_level), localTime,
      restDays: restDays(r.roast_date, r.fs, r.fe, localTime.slice(0, 10)),
      grinder: r.grinder, grind, grindNum: grindValue(grind), ...parseMethod(r.method, r.tools),
      tempC: pos(r.temp), dose: pos(r.dose), waterG: pos(r.water_g), water: r.water,
      recipeId: r.recipe_id, recipeName: r.recipe_name, recipeSlug: r.recipe_id === null ? null : slugs.get(r.recipe_id) ?? null, rating: pos(r.rating), best: r.best === 1, notes: r.notes?.trim() || null,
      decaf: r.decaf === 1, grinderArchived: r.grinder_archived === 1, methodArchived: r.method_archived === 1
    };
  });
}

// Which drippers/filters pool together: Conical drippers share 'cone'; own-data gear stands alone; the rest of the
// filters share 'any'. A dripper with no Shape on file stands alone.
export function loadGearClass(db: DatabaseSync): GearClass {
  const d = getGearDetails(db);
  const of = (kind: string, name: string | null) => d.find((x) => x.kind === kind && x.name === name)?.values;
  const own = (kind: string, name: string | null) => of(kind, name)?.ownData === OWN_DATA_ONLY;
  return {
    dripper: (name) => (!name || own('dripper', name) ? (name ?? '') : of('dripper', name)?.shape === 'Conical' ? 'cone' : name),
    filter: (name) => (!name || own('filter', name) ? (name ?? '') : 'any')
  };
}

// Gear for the pickers, archived (R1) left out. Rows arrive oldest first. Grinders: used in the last 365 days, newest first.
// Drippers: the last 365 days by use, the rest of the non-archived ones as `otherDrippers`.
// Filters for a `dripper` (round 7): chips = the ones used with it in the last 365 days, ignoring one-offs (>= 2 brews, or
// any in the last 90 days); `otherFilters` = the same kind of filter used with drippers of the same class (`gc`), never
// the whole list, so it is empty for a dripper with no siblings. With no dripper: every filter, the rest as other.
export interface GearOptions { grinders: string[]; drippers: string[]; otherDrippers: string[]; filters: string[]; otherFilters: string[] }
export function gearOptions(rows: BrewRow[], today = localToday(), dripper?: string | null, gc?: GearClass): GearOptions {
  const since = addDays(today, -365), recentDay = addDays(today, -90);
  const all = [...rows].reverse(), recent = all.filter((r) => r.localTime.slice(0, 10) >= since);
  const list = (src: BrewRow[], pick: (r: BrewRow) => string | null, skip: (r: BrewRow) => boolean) =>
    [...new Set(src.filter((r) => !skip(r)).flatMap((r) => pick(r) ?? []))];
  const byUse = (src: BrewRow[], pick: (r: BrewRow) => string | null) => {
    const n = new Map<string, number>();
    for (const r of src) if (!r.methodArchived && pick(r)) n.set(pick(r)!, (n.get(pick(r)!) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).map(([k]) => k); // stable: newest first among ties
  };
  const drippers = byUse(recent, (r) => r.dripper);
  // Filters of `src` (newest first) that are not one-offs.
  const real = (src: BrewRow[]) => list(src, (r) => r.filter, (r) => r.methodArchived).filter((f) => {
    const fs = src.filter((r) => r.filter === f && !r.methodArchived);
    return fs.length >= 2 || fs.some((r) => r.localTime.slice(0, 10) >= recentDay);
  });
  let filters: string[], otherFilters: string[];
  if (dripper) {
    filters = real(recent.filter((r) => r.dripper === dripper));
    const kin = gc ? all.filter((r) => r.dripper && r.dripper !== dripper && gc.dripper(r.dripper) === gc.dripper(dripper)) : [];
    otherFilters = real(kin).filter((f) => !filters.includes(f));
  } else {
    filters = list(recent, (r) => r.filter, (r) => r.methodArchived);
    otherFilters = list(all, (r) => r.filter, (r) => r.methodArchived).filter((f) => !filters.includes(f));
  }
  return {
    grinders: list(recent, (r) => r.grinder, (r) => r.grinderArchived),
    drippers, otherDrippers: list(all, (r) => r.dripper, (r) => r.methodArchived).filter((d) => !drippers.includes(d)),
    filters, otherFilters
  };
}

// The most used of each over the last 30 brews that still have non-archived gear; ties go to the most recent.
// The filter is the chosen dripper's own most used (its last 30 brews), else the global one.
export function gearDefaults(rows: BrewRow[], dripper?: string | null): { grinder: string | null; dripper: string | null; filter: string | null } {
  const top = (pick: (r: BrewRow) => string | null, skip: (r: BrewRow) => boolean, only: (r: BrewRow) => boolean = () => true) => {
    const c = new Map<string, number>();
    for (const r of rows.filter((r) => !skip(r) && only(r) && pick(r)).slice(-30).reverse()) c.set(pick(r)!, (c.get(pick(r)!) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; // stable sort: first-seen (most recent) wins ties
  };
  const d = top((r) => r.dripper, (r) => r.methodArchived);
  const filter = (dripper ?? d) ? top((r) => r.filter, (r) => r.methodArchived, (r) => r.dripper === (dripper ?? d)) : null;
  return { grinder: top((r) => r.grinder, (r) => r.grinderArchived), dripper: d, filter: filter ?? top((r) => r.filter, (r) => r.methodArchived) };
}

// E8: this coffee's own most used gear first (`mine` = its brews), the global defaults where it has none. The default
// dripper never follows `dripper` (the pick): the URL omits a value equal to its default, so an echo here made a later
// filter pick drop the dripper. Only the default filter follows the dripper.
export function coffeeGearDefaults(rows: BrewRow[], mine: BrewRow[], dripper?: string | null) {
  const own = gearDefaults(mine, dripper), all = gearDefaults(rows, dripper), d = dripper ?? own.dripper ?? all.dripper;
  const ownFilter = mine.some((r) => r.dripper === d && !r.methodArchived && r.filter);
  return { grinder: own.grinder ?? all.grinder, dripper: own.dripper ?? all.dripper, filter: ownFilter ? own.filter : gearDefaults(rows, d).filter };
}

export function coffeeDetails(db: DatabaseSync, slug: string, today: string): CoffeeDetails | null {
  const c = db.prepare(
    `SELECT c.id, c.slug, c.roaster, c.coffee_name, c.roast_date, c.frozen_start_date AS fs, c.frozen_end_date AS fe, c.amount_g,
            c.processing, c.origin, c.roast_level, c.decaf, c.status,
            (SELECT COALESCE(SUM(b.ground_coffee_g), 0) FROM beanconqueror_brews b
             JOIN beanconqueror_beans bean ON bean.id = b.bean_id WHERE bean.coffee_id = c.id) AS used
     FROM coffees c WHERE c.slug = ?`
  ).get(slug) as { id: number; slug: string; roaster: string; coffee_name: string; roast_date: string | null; fs: string | null;
    fe: string | null; amount_g: number | null; processing: string | null; origin: string | null; roast_level: string | null; decaf: number; status: CoffeeDetails['status']; used: number } | undefined;
  if (!c) return null;
  return {
    id: c.id, slug: c.slug, roaster: c.roaster, coffeeName: c.coffee_name, roastDate: c.roast_date,
    restDays: restDays(c.roast_date, c.fs, c.fe, today), gramsLeft: c.amount_g === null ? null : Math.max(0, c.amount_g - c.used),
    processing: c.processing, origin: c.origin, roastLevel: c.roast_level, decaf: c.decaf === 1, status: c.status
  };
}
