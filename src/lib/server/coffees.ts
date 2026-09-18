import type { DatabaseSync } from 'node:sqlite';
import type { CoffeeRow } from '../types';
import { generateBaseSlug, uniqueSlug } from './slug.ts';

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
  status?: 'backlog' | 'open' | 'archive';
}

export function getBacklogCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status = 'backlog'`).all() as CoffeeRow[];
}

export function getOpenCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status = 'open'`).all() as CoffeeRow[];
}

export function getArchivedCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status = 'archive'`).all() as CoffeeRow[];
}

export function getNonArchivedCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status != 'archive'`).all() as CoffeeRow[];
}

export function getCoffeeById(db: DatabaseSync, id: number): CoffeeRow | undefined {
  return db.prepare(`SELECT * FROM coffees WHERE id = ?`).get(id) as CoffeeRow | undefined;
}

export function getCoffeeBySlug(db: DatabaseSync, slug: string): CoffeeRow | undefined {
  return db.prepare(`SELECT * FROM coffees WHERE slug = ?`).get(slug) as CoffeeRow | undefined;
}

export function createCoffee(db: DatabaseSync, input: NewCoffeeInput): { id: number; slug: string } {
  const now = new Date().toISOString();
  const status = input.status ?? 'backlog';
  const drank = status === 'archive' ? 1 : 0;
  const movedDate = status === 'archive' ? now : null;
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
        rest_days_low, rest_days_high, image_url, slug, drank, status, moved_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      slug,
      drank,
      status,
      movedDate,
      now,
      now
    );

  return { id: Number(result.lastInsertRowid), slug };
}

export function updateCoffee(db: DatabaseSync, id: number, input: NewCoffeeInput, slug: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET
      roaster = ?, coffee_name = ?, origin = ?, roast_level = ?, processing = ?,
      amount_g = ?, cost = ?, roast_date = ?, frozen_start_date = ?, frozen_end_date = ?,
      rest_days_low = ?, rest_days_high = ?, image_url = ?, slug = ?, updated_at = ?
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
    slug,
    now,
    id
  );
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
