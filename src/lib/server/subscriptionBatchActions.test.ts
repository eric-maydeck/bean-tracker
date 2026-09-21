import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { createSubscription, getSubscriptionById } from './subscriptions';
import {
  validateSubscriptionBatch,
  commitSubscriptionBatch,
  type SubscriptionBatchChange
} from './subscriptionBatchActions';

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('validateSubscriptionBatch', () => {
  it('returns no errors for a valid field edit', () => {
    const changes: SubscriptionBatchChange[] = [{ id: 1, fields: { roaster_service: 'Sey' } }];
    expect(validateSubscriptionBatch(changes)).toEqual([]);
  });

  it('returns no errors for a status-action-only entry', () => {
    const changes: SubscriptionBatchChange[] = [{ id: 1, statusAction: 'delete' }];
    expect(validateSubscriptionBatch(changes)).toEqual([]);
  });

  it('flags a blank roaster_service', () => {
    const changes: SubscriptionBatchChange[] = [{ id: 1, fields: { roaster_service: '   ' } }];
    const errors = validateSubscriptionBatch(changes);
    expect(errors).toEqual([{ id: 1, error: 'Roaster/service is required' }]);
  });
});

describe('commitSubscriptionBatch', () => {
  it('applies a field edit', () => {
    const id = createSubscription(db, {
      roaster_service: 'Original',
      subscription_name: null,
      price: null,
      bag_count: null,
      amount_per_bag_g: null,
      renewal_day: null
    });
    commitSubscriptionBatch(db, [{ id, fields: { roaster_service: 'Renamed', price: '12.5' } }]);
    const row = getSubscriptionById(db, id);
    expect(row?.roaster_service).toBe('Renamed');
    expect(row?.price).toBe(12.5);
  });

  it('applies a delete', () => {
    const id = createSubscription(db, {
      roaster_service: 'Gone Soon',
      subscription_name: null,
      price: null,
      bag_count: null,
      amount_per_bag_g: null,
      renewal_day: null
    });
    commitSubscriptionBatch(db, [{ id, statusAction: 'delete' }]);
    expect(getSubscriptionById(db, id)).toBeUndefined();
  });

  it('rolls back the entire batch if one entry fails — atomicity', () => {
    const good = createSubscription(db, {
      roaster_service: 'Good',
      subscription_name: null,
      price: null,
      bag_count: null,
      amount_per_bag_g: null,
      renewal_day: null
    });
    expect(() =>
      commitSubscriptionBatch(db, [
        { id: good, fields: { roaster_service: 'Renamed' } },
        { id: 999999, statusAction: 'delete' }
      ])
    ).toThrow();
    expect(getSubscriptionById(db, good)?.roaster_service).toBe('Good');
  });
});
