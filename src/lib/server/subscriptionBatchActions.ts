import type { DatabaseSync } from 'node:sqlite';
import { updateSubscription, deleteSubscription } from './subscriptions';
import { parseSubscriptionUrl } from '../subscriptionView';
import type { SubscriptionRow } from '../types';

export interface SubscriptionBatchChange {
  id: number;
  fields?: Record<string, string>;
  statusAction?: 'delete';
}

export interface BatchFieldError {
  id: number;
  error: string;
}

// `fields` may be partial (a staged Pause carries only `paused`): absent
// keys keep the row's current value.
function readSubscriptionFields(fields: Record<string, string>, row: SubscriptionRow) {
  const has = (k: string) => k in fields;
  const num = (k: keyof SubscriptionRow) => (has(k) ? (fields[k] ? Number(fields[k]) : null) : (row[k] as number | null));
  const url = has('subscription_url') ? parseSubscriptionUrl(fields.subscription_url) : { url: row.subscription_url };
  if ('error' in url) throw new Error(url.error);
  return {
    roaster_service: has('roaster_service') ? fields.roaster_service.trim() : row.roaster_service,
    subscription_name: has('subscription_name') ? fields.subscription_name || null : row.subscription_name,
    price: num('price'),
    bag_count: num('bag_count'),
    amount_per_bag_g: num('amount_per_bag_g'),
    renewal_day: num('renewal_day'),
    subscription_url: url.url,
    paused: has('paused') ? (fields.paused === '1' ? 1 : 0) : row.paused
  };
}

export function validateSubscriptionBatch(changes: SubscriptionBatchChange[]): BatchFieldError[] {
  const errors: BatchFieldError[] = [];
  for (const change of changes) {
    if (!change.fields) continue;
    if ('roaster_service' in change.fields && !change.fields.roaster_service.trim()) {
      errors.push({ id: change.id, error: 'Roaster/service is required' });
      continue;
    }
    const url = parseSubscriptionUrl(change.fields.subscription_url);
    if ('error' in url) errors.push({ id: change.id, error: url.error });
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
      const before = db.prepare(`SELECT * FROM subscriptions WHERE id = ?`).get(change.id) as SubscriptionRow | undefined;
      if (!before) throw new Error(`Subscription ${change.id} does not exist`);
      if (change.fields) {
        const merged = readSubscriptionFields(change.fields, before);
        if (!merged.roaster_service) throw new Error('Roaster/service is required');
        updateSubscription(db, change.id, merged);
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
