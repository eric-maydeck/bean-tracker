import type { DatabaseSync } from 'node:sqlite';
import { updateSubscription, deleteSubscription } from './subscriptions';

export interface SubscriptionBatchChange {
  id: number;
  fields?: Record<string, string>;
  statusAction?: 'delete';
}

export interface BatchFieldError {
  id: number;
  error: string;
}

function readSubscriptionFields(fields: Record<string, string>) {
  return {
    roaster_service: (fields.roaster_service ?? '').trim(),
    subscription_name: fields.subscription_name || null,
    price: fields.price ? Number(fields.price) : null,
    bag_count: fields.bag_count ? Number(fields.bag_count) : null,
    amount_per_bag_g: fields.amount_per_bag_g ? Number(fields.amount_per_bag_g) : null,
    renewal_day: fields.renewal_day ? Number(fields.renewal_day) : null
  };
}

export function validateSubscriptionBatch(changes: SubscriptionBatchChange[]): BatchFieldError[] {
  const errors: BatchFieldError[] = [];
  for (const change of changes) {
    if (!change.fields) continue;
    const roasterService = (change.fields.roaster_service ?? '').trim();
    if (!roasterService) {
      errors.push({ id: change.id, error: 'Roaster/service is required' });
    }
  }
  return errors;
}

export function commitSubscriptionBatch(db: DatabaseSync, changes: SubscriptionBatchChange[]): void {
  db.exec('BEGIN');
  try {
    for (const change of changes) {
      // Checked unconditionally, before either branch below — a WHERE-guarded
      // UPDATE or DELETE against a nonexistent id is a silent no-op in SQLite,
      // not a throw, so a check scoped to only one branch (e.g. only inside
      // `if (change.fields)`) would let a delete-only entry against a bad id
      // slip through uncaught, defeating the whole point of the transaction
      // wrapper. (This exact gap was found and fixed in the equivalent coffee
      // batch action — same fix applied here up front.)
      const before = db.prepare(`SELECT id FROM subscriptions WHERE id = ?`).get(change.id);
      if (!before) throw new Error(`Subscription ${change.id} does not exist`);
      if (change.fields) {
        updateSubscription(db, change.id, readSubscriptionFields(change.fields));
      }
      if (change.statusAction === 'delete') {
        deleteSubscription(db, change.id);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
