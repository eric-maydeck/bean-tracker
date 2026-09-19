import type { DatabaseSync } from 'node:sqlite';
import type { SubscriptionRow } from '../types';

export interface NewSubscriptionInput {
  roaster_service: string;
  subscription_name: string | null;
  price: number | null;
  bag_count: number | null;
  amount_per_bag_g: number | null;
  renewal_day: number | null;
}

export function getSubscriptions(db: DatabaseSync): SubscriptionRow[] {
  return db
    .prepare(`SELECT * FROM subscriptions ORDER BY roaster_service COLLATE NOCASE ASC`)
    .all() as SubscriptionRow[];
}

export function getSubscriptionById(db: DatabaseSync, id: number): SubscriptionRow | undefined {
  return db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(id) as SubscriptionRow | undefined;
}

export function createSubscription(db: DatabaseSync, input: NewSubscriptionInput): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO subscriptions
        (roaster_service, subscription_name, price, bag_count, amount_per_bag_g, renewal_day, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.roaster_service,
      input.subscription_name,
      input.price,
      input.bag_count,
      input.amount_per_bag_g,
      input.renewal_day,
      now
    );
  return Number(result.lastInsertRowid);
}

export function updateSubscription(db: DatabaseSync, id: number, input: NewSubscriptionInput): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE subscriptions SET roaster_service = ?, subscription_name = ?, price = ?, bag_count = ?,
      amount_per_bag_g = ?, renewal_day = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.roaster_service,
    input.subscription_name,
    input.price,
    input.bag_count,
    input.amount_per_bag_g,
    input.renewal_day,
    now,
    id
  );
}

export function deleteSubscription(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(id);
}

export function withTotalGrams(
  sub: Omit<SubscriptionRow, 'id'> & { id?: number }
): SubscriptionRow & { total_grams: number | null } {
  const total_grams =
    sub.bag_count != null && sub.amount_per_bag_g != null ? sub.bag_count * sub.amount_per_bag_g : null;
  return { ...sub, id: sub.id ?? 0, total_grams };
}

function daysInMonth(year: number, monthIndex0: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function clampedUTCDate(year: number, monthIndex0: number, day: number): Date {
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, clampedDay));
}

// Renewal day (1-31) is a day-of-month, not a stored date, so "next renewal"
// always has to be computed relative to "today." If today's day-of-month has
// already passed the renewal day, the next renewal is next month; otherwise
// it's this month. A renewal day past the end of a shorter month (e.g. 31 in
// February) clamps to that month's actual last day.
export function computeNextRenewalDate(renewalDay: number | null, today: Date): string | null {
  if (renewalDay == null) return null;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const todayDay = today.getUTCDate();
  const candidate =
    todayDay <= renewalDay ? clampedUTCDate(year, month, renewalDay) : clampedUTCDate(year, month + 1, renewalDay);
  return candidate.toISOString().slice(0, 10);
}

export function withNextRenewalDate<T extends { renewal_day: number | null }>(
  sub: T,
  today: Date
): T & { next_renewal_date: string | null } {
  return { ...sub, next_renewal_date: computeNextRenewalDate(sub.renewal_day, today) };
}
