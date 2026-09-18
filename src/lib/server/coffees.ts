import type { DatabaseSync } from 'node:sqlite';
import type { CoffeeRow } from '../types';

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
  status?: 'active' | 'finished';
}

export function getActiveCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status = 'active'`).all() as CoffeeRow[];
}

export function getFinishedCoffees(db: DatabaseSync): CoffeeRow[] {
  return db.prepare(`SELECT * FROM coffees WHERE status = 'finished'`).all() as CoffeeRow[];
}

export function getCoffeeById(db: DatabaseSync, id: number): CoffeeRow | undefined {
  return db.prepare(`SELECT * FROM coffees WHERE id = ?`).get(id) as CoffeeRow | undefined;
}

export function createCoffee(db: DatabaseSync, input: NewCoffeeInput): number {
  const now = new Date().toISOString();
  const status = input.status ?? 'active';
  const drank = status === 'finished' ? 1 : 0;
  const movedDate = status === 'finished' ? now : null;

  const result = db
    .prepare(
      `INSERT INTO coffees (
        roaster, coffee_name, origin, roast_level, processing,
        amount_g, cost, roast_date, frozen_start_date, frozen_end_date,
        rest_days_low, rest_days_high, image_url, drank, status, moved_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      drank,
      status,
      movedDate,
      now,
      now
    );

  return Number(result.lastInsertRowid);
}

export function updateCoffee(db: DatabaseSync, id: number, input: NewCoffeeInput): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET
      roaster = ?, coffee_name = ?, origin = ?, roast_level = ?, processing = ?,
      amount_g = ?, cost = ?, roast_date = ?, frozen_start_date = ?, frozen_end_date = ?,
      rest_days_low = ?, rest_days_high = ?, image_url = ?, updated_at = ?
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
    now,
    id
  );
}

export function markAsDrank(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET drank = 1, status = 'finished', moved_date = ?, updated_at = ? WHERE id = ?`
  ).run(now, now, id);
}

export function restoreCoffee(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE coffees SET drank = 0, status = 'active', moved_date = NULL, updated_at = ? WHERE id = ?`
  ).run(now, id);
}
