import type { DatabaseSync } from 'node:sqlite';
import type { SubscriptionRow } from '../types';

export interface NewSubscriptionInput {
  roaster_service: string;
  subscription_name: string | null;
  price: number | null;
  bag_count: number | null;
  amount_per_bag_g: number | null;
}

export function getSubscriptions(db: DatabaseSync): SubscriptionRow[] {
  return db.prepare(`SELECT * FROM subscriptions ORDER BY roaster_service ASC`).all() as SubscriptionRow[];
}

export function getSubscriptionById(db: DatabaseSync, id: number): SubscriptionRow | undefined {
  return db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(id) as SubscriptionRow | undefined;
}

export function createSubscription(db: DatabaseSync, input: NewSubscriptionInput): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO subscriptions
        (roaster_service, subscription_name, price, bag_count, amount_per_bag_g, purchased, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      input.roaster_service,
      input.subscription_name,
      input.price,
      input.bag_count,
      input.amount_per_bag_g,
      now
    );
  return Number(result.lastInsertRowid);
}

export function updateSubscription(db: DatabaseSync, id: number, input: NewSubscriptionInput): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE subscriptions SET roaster_service = ?, subscription_name = ?, price = ?, bag_count = ?,
      amount_per_bag_g = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.roaster_service,
    input.subscription_name,
    input.price,
    input.bag_count,
    input.amount_per_bag_g,
    now,
    id
  );
}

export function deleteSubscription(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(id);
}

export function toggleSubscriptionPurchased(db: DatabaseSync, id: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE subscriptions SET purchased = CASE purchased WHEN 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`
  ).run(now, id);
}

export function withTotalGrams(
  sub: Omit<SubscriptionRow, 'id'> & { id?: number }
): SubscriptionRow & { total_grams: number | null } {
  const total_grams =
    sub.bag_count != null && sub.amount_per_bag_g != null ? sub.bag_count * sub.amount_per_bag_g : null;
  return { ...sub, id: sub.id ?? 0, total_grams };
}
