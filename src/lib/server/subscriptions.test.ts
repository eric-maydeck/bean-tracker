import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  toggleSubscriptionPurchased,
  withTotalGrams,
  type NewSubscriptionInput
} from './subscriptions';

function sampleInput(overrides: Partial<NewSubscriptionInput> = {}): NewSubscriptionInput {
  return {
    roaster_service: 'Airworks',
    subscription_name: 'Ultralight Subscription',
    price: 66,
    bag_count: 3,
    amount_per_bag_g: 200,
    ...overrides
  };
}

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('subscriptions CRUD', () => {
  it('creates and lists subscriptions', () => {
    createSubscription(db, sampleInput());
    expect(getSubscriptions(db)).toHaveLength(1);
  });

  it('updates a subscription', () => {
    const id = createSubscription(db, sampleInput());
    updateSubscription(db, id, sampleInput({ price: 70 }));
    expect(getSubscriptions(db)[0].price).toBe(70);
  });

  it('toggles purchased', () => {
    const id = createSubscription(db, sampleInput());
    expect(getSubscriptions(db)[0].purchased).toBe(0);
    toggleSubscriptionPurchased(db, id);
    expect(getSubscriptions(db)[0].purchased).toBe(1);
    toggleSubscriptionPurchased(db, id);
    expect(getSubscriptions(db)[0].purchased).toBe(0);
  });

  it('deletes a subscription', () => {
    const id = createSubscription(db, sampleInput());
    deleteSubscription(db, id);
    expect(getSubscriptions(db)).toHaveLength(0);
  });

  it('gets a subscription by id', () => {
    const id = createSubscription(db, sampleInput());
    expect(getSubscriptionById(db, id)?.roaster_service).toBe('Airworks');
    expect(getSubscriptionById(db, id + 1000)).toBeUndefined();
  });
});

describe('withTotalGrams', () => {
  it('multiplies bag count by amount per bag', () => {
    const sub = { ...sampleInput(), id: 1, purchased: 0 };
    expect(withTotalGrams(sub).total_grams).toBe(600);
  });

  it('returns null when either input is missing', () => {
    const sub = { ...sampleInput({ bag_count: null }), id: 1, purchased: 0 };
    expect(withTotalGrams(sub).total_grams).toBeNull();
  });
});
