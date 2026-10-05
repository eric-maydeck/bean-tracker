import type { DatabaseSync } from 'node:sqlite';
import type { CoffeeRow } from '../types';
import { generateBaseSlug, isAutoSlug, uniqueSlug } from './slug.ts';

export interface NewCoffeeInput {
  roaster: string;
  coffee_name: string;
  origin: string | null;
  roast_level: string | null;
  processing: string | null;
  amount_g: number | null;
  cost: number | null;
  roast_date: string | null;
  frozen_start_date: string | null;
  frozen_end_date: string | null;
  rest_days_low: number | null;
  rest_days_high: number | null;
  image_url: string | null;
  product_url?: string | null;
  status?: 'backlog' | 'open' | 'archive';
  moved_date?: string | null;
  decaf?: boolean;
}

const ORDER_BY_NAME = `ORDER BY c.roaster COLLATE NOCASE, c.coffee_name COLLATE NOCASE`;

// grams_left: open coffees with a bag size and a linked bean only. The GROUP BY
// yields no row (NULL) when no bean is linked; MAX(0, NULL) stays NULL.
// roaster_image_url: the roaster's default image (roaster_images). ri.roaster on
// the left so the comparison uses its NOCASE collation.
const LIST_SELECT = `SELECT c.*, ri.image_url AS roaster_image_url,
  EXISTS (SELECT 1 FROM beanconqueror_beans b WHERE b.coffee_id = c.id) AS in_bean_conqueror,
  CASE WHEN c.status = 'open' THEN MAX(0, ROUND((
    SELECT c.amount_g - TOTAL(br.ground_coffee_g) FROM beanconqueror_beans b
    LEFT JOIN beanconqueror_brews br ON br.bean_id = b.id WHERE b.coffee_id = c.id GROUP BY b.id
  ))) END AS grams_left
  FROM coffees c LEFT JOIN roaster_images ri ON ri.roaster = c.roaster`;

export function getBacklogCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`${LIST_SELECT} WHERE c.status = 'backlog' ${ORDER_BY_NAME}`).all() as CoffeeRow[];
}

export function getOpenCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`${LIST_SELECT} WHERE c.status = 'open' ${ORDER_BY_NAME}`).all() as CoffeeRow[];
}

export function getArchivedCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`${LIST_SELECT} WHERE c.status = 'archive' ${ORDER_BY_NAME}`).all() as CoffeeRow[];
}

export function getNonArchivedCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`${LIST_SELECT} WHERE c.status != 'archive' ${ORDER_BY_NAME}`).all() as CoffeeRow[];
}

const DISTINCT_VALUE_COLUMNS = ['roaster', 'origin', 'processing'] as const;
export type DistinctValueColumn = (typeof DISTINCT_VALUE_COLUMNS)[number];

// Powers <datalist> autocomplete on the coffee form. Column is restricted to a
// fixed allowlist (not user input) so string-building it into SQL is safe.
export function getDistinctFieldValues(db: DatabaseSync, column: DistinctValueColumn): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT ${column} as value FROM coffees WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column} COLLATE NOCASE`
    )
    .all() as { value: string }[];
  return rows.map((r) => r.value);
}

export type FillHistoryRow = Pick<
  CoffeeRow,
  'id' | 'roaster' | 'product_url' | 'roast_level' | 'amount_g' | 'rest_days_low' | 'rest_days_high'
>;

// Everything the product-page fill (and the rest suggestion) learns from:
// every coffee, archived included.
export function getFillHistory(db: DatabaseSync): FillHistoryRow[] {
  return db
    .prepare(`SELECT id, roaster, product_url, roast_level, amount_g, rest_days_low, rest_days_high FROM coffees`)
    .all() as FillHistoryRow[];
}

export function getCoffeeById(db: DatabaseSync, id: number): CoffeeRow | undefined {
  return db.prepare(`SELECT * FROM coffees WHERE id = ?`).get(id) as CoffeeRow | undefined;
}

export function getCoffeeBySlug(db: DatabaseSync, slug: string): CoffeeRow | undefined {
  return db.prepare(`${LIST_SELECT} WHERE c.slug = ?`).get(slug) as CoffeeRow | undefined;
}

export function getRedirectSlug(db: DatabaseSync, oldSlug: string): string | undefined {
  const row = db
    .prepare(`SELECT c.slug FROM slug_redirects r JOIN coffees c ON c.id = r.coffee_id WHERE r.old_slug = ?`)
    .get(oldSlug) as { slug: string } | undefined;
  return row?.slug;
}

export function createCoffee(db: DatabaseSync, input: NewCoffeeInput): { id: number; slug: string } {
  const now = new Date().toISOString();
  const status = input.status ?? 'backlog';
  const drank = status === 'archive' ? 1 : 0;
  const movedDate = status === 'archive' ? (input.moved_date ?? now) : null;
  const decaf = input.decaf ? 1 : 0;
  const slug = uniqueSlug(
    db,
    generateBaseSlug({
      roaster: input.roaster,
      coffeeName: input.coffee_name,
      roastDate: input.roast_date,
      createdAt: now
    })
  );

  const result = db
    .prepare(
      `INSERT INTO coffees (
        roaster, coffee_name, origin, roast_level, processing,
        amount_g, cost, roast_date, frozen_start_date, frozen_end_date,
        rest_days_low, rest_days_high, image_url, product_url, slug, drank, status, moved_date, decaf, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.roaster,
      input.coffee_name,
      input.origin,
      input.roast_level,
      input.processing,
      input.amount_g,
      input.cost,
      input.roast_date,
      input.frozen_start_date,
      input.frozen_end_date,
      input.rest_days_low,
      input.rest_days_high,
      input.image_url,
      input.product_url ?? null,
      slug,
      drank,
      status,
      movedDate,
      decaf,
      now,
      now
    );

  return { id: Number(result.lastInsertRowid), slug };
}

export function updateCoffee(db: DatabaseSync, id: number, input: NewCoffeeInput, slug: string): void {
  const oldSlug = (db.prepare(`SELECT slug FROM coffees WHERE id = ?`).get(id) as { slug: string } | undefined)?.slug;
  const now = new Date().toISOString();
  const decaf = input.decaf ? 1 : 0;
  db.prepare(
    `UPDATE coffees SET
      roaster = ?, coffee_name = ?, origin = ?, roast_level = ?, processing = ?,
      amount_g = ?, cost = ?, roast_date = ?, frozen_start_date = ?, frozen_end_date = ?,
      rest_days_low = ?, rest_days_high = ?, image_url = ?, product_url = ?, slug = ?, decaf = ?, updated_at = ?
    WHERE id = ?`
  ).run(
    input.roaster,
    input.coffee_name,
    input.origin,
    input.roast_level,
    input.processing,
    input.amount_g,
    input.cost,
    input.roast_date,
    input.frozen_start_date,
    input.frozen_end_date,
    input.rest_days_low,
    input.rest_days_high,
    input.image_url,
    input.product_url ?? null,
    slug,
    decaf,
    now,
    id
  );
  if (oldSlug && oldSlug !== slug) {
    // Renaming back to one of this coffee's own old slugs reclaims it.
    db.prepare(`DELETE FROM slug_redirects WHERE old_slug = ? AND coffee_id = ?`).run(slug, id);
    db.prepare(`INSERT INTO slug_redirects (old_slug, coffee_id) VALUES (?, ?)`).run(oldSlug, id);
  }
}

// A one-field correction, applied only while the field still holds `from`.
export type CoffeeFix = { coffee_id: number; field: 'roast_date' | 'coffee_name'; from: string; to: string };

// Same as a UI edit (coffeeBatchActions' nextSlug + updateCoffee): an
// auto-generated slug follows a base-slug change, the old one redirects; a
// custom slug is kept. Returns why it was skipped, or null when applied.
export function applyCoffeeFix(db: DatabaseSync, f: CoffeeFix): string | null {
  const c = getCoffeeById(db, f.coffee_id);
  if (!c) return 'coffee not found';
  if (c[f.field] !== f.from) return `${f.field} is '${c[f.field]}', expected '${f.from}'`;
  const next = { ...c, [f.field]: f.to, decaf: c.decaf === 1 };
  const base = (x: { roaster: string; coffee_name: string; roast_date: string | null }) =>
    generateBaseSlug({ roaster: x.roaster, coffeeName: x.coffee_name, roastDate: x.roast_date, createdAt: c.created_at });
  const regen = base(next) !== base(c) && isAutoSlug(c.slug, base(c));
  updateCoffee(db, c.id, next, regen ? uniqueSlug(db, base(next), c.id) : c.slug);
  return null;
}

export function openCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const coffee = getCoffeeById(db, id);
  const needsThaw = coffee?.frozen_start_date != null && coffee?.frozen_end_date == null;
  if (needsThaw) {
    db.prepare(
      `UPDATE coffees SET status = 'open', opened_date = ?, frozen_end_date = ?, updated_at = ?
       WHERE id = ? AND status = 'backlog'`
    ).run(now, today, now, id);
  } else {
    db.prepare(
      `UPDATE coffees SET status = 'open', opened_date = ?, updated_at = ?
       WHERE id = ? AND status = 'backlog'`
    ).run(now, now, id);
  }
}

export function unopenCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET status = 'backlog', opened_date = NULL, updated_at = ?
     WHERE id = ? AND status = 'open'`
  ).run(now, id);
}

export function freezeCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE coffees SET frozen_start_date = ?, frozen_end_date = NULL, updated_at = ?
     WHERE id = ? AND status = 'backlog'`
  ).run(today, now, id);
}

export function thawCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE coffees SET frozen_end_date = ?, updated_at = ?
     WHERE id = ? AND status = 'backlog'`
  ).run(today, now, id);
}

export function archiveCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET drank = 1, status = 'archive', moved_date = ?, updated_at = ?
     WHERE id = ? AND status != 'archive'`
  ).run(now, now, id);
}

export function restoreCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET drank = 0, status = 'backlog', moved_date = NULL, opened_date = NULL, updated_at = ?
     WHERE id = ?`
  ).run(now, id);
}

export function deleteCoffee(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM coffees WHERE id = ?`).run(id);
}
