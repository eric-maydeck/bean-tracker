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

describe('validateSubscriptionBatch: subscription URL and partial fields', () => {
  it('rejects a non-http(s) subscription URL', () => {
    const errors = validateSubscriptionBatch([{ id: 1, fields: { roaster_service: 'Sey', subscription_url: 'javascript:x' } }]);
    expect(errors).toEqual([{ id: 1, error: 'Subscription page must be an http(s) URL' }]);
  });
  it('accepts an empty or valid URL, and a pause-only change', () => {
    expect(validateSubscriptionBatch([{ id: 1, fields: { roaster_service: 'Sey', subscription_url: '' } }])).toEqual([]);
    expect(validateSubscriptionBatch([{ id: 1, fields: { roaster_service: 'Sey', subscription_url: 'https://sey.coffee' } }])).toEqual([]);
    expect(validateSubscriptionBatch([{ id: 1, fields: { paused: '1' } }])).toEqual([]);
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

  it('round-trips subscription_url and paused; a pause-only change keeps other fields', () => {
    const id = createSubscription(db, {
      roaster_service: 'Ceto', subscription_name: 'Monthly', price: 20, bag_count: 1, amount_per_bag_g: 250, renewal_day: 5
    });
    commitSubscriptionBatch(db, [{ id, fields: { roaster_service: 'Ceto', subscription_url: ' https://ceto.coffee/sub ' } }]);
    expect(getSubscriptionById(db, id)).toMatchObject({ subscription_url: 'https://ceto.coffee/sub', paused: 0 });
    commitSubscriptionBatch(db, [{ id, fields: { paused: '1' } }]);
    expect(getSubscriptionById(db, id)).toMatchObject({
      roaster_service: 'Ceto', subscription_name: 'Monthly', price: 20, renewal_day: 5,
      subscription_url: 'https://ceto.coffee/sub', paused: 1
    });
    commitSubscriptionBatch(db, [{ id, fields: { roaster_service: 'Ceto', subscription_url: '', paused: '0' } }]);
    expect(getSubscriptionById(db, id)).toMatchObject({ subscription_url: null, paused: 0 });
  });

  it('refuses a bad URL at commit too', () => {
    const id = createSubscription(db, {
      roaster_service: 'Ceto', subscription_name: null, price: null, bag_count: null, amount_per_bag_g: null, renewal_day: null
    });
    expect(() => commitSubscriptionBatch(db, [{ id, fields: { subscription_url: 'ftp://x' } }])).toThrow(/http/);
    expect(getSubscriptionById(db, id)?.subscription_url).toBeNull();
  });
});
