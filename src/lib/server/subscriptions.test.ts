import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDb, applySchema } from './db';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  withTotalGrams,
  computeNextRenewalDate,
  withNextRenewalDate,
  applySubscriptionUrls,
  SUBSCRIPTION_URLS_2026_10_08,
  type NewSubscriptionInput
} from './subscriptions';

function sampleInput(overrides: Partial<NewSubscriptionInput> = {}): NewSubscriptionInput {
  return {
    roaster_service: 'Airworks',
    subscription_name: 'Ultralight Subscription',
    price: 66,
    bag_count: 3,
    amount_per_bag_g: 200,
    renewal_day: null,
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

  it('stores and updates renewal_day', () => {
    const id = createSubscription(db, sampleInput({ renewal_day: 15 }));
    expect(getSubscriptions(db)[0].renewal_day).toBe(15);
    updateSubscription(db, id, sampleInput({ renewal_day: 3 }));
    expect(getSubscriptions(db)[0].renewal_day).toBe(3);
  });

  it('defaults to not paused and no URL, and stores both', () => {
    const id = createSubscription(db, sampleInput());
    expect(getSubscriptionById(db, id)).toMatchObject({ paused: 0, subscription_url: null });
    updateSubscription(db, id, sampleInput({ paused: 1, subscription_url: 'https://airworks.coffee/sub' }));
    expect(getSubscriptionById(db, id)).toMatchObject({ paused: 1, subscription_url: 'https://airworks.coffee/sub' });
  });

  it('adds the new columns to an old subscriptions table', () => {
    const old = new DatabaseSync(':memory:');
    old.exec(`CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, roaster_service TEXT NOT NULL, subscription_name TEXT,
      price REAL, bag_count REAL, amount_per_bag_g REAL)`);
    old.exec(`INSERT INTO subscriptions (roaster_service) VALUES ('Old')`);
    applySchema(old);
    expect(old.prepare('SELECT paused, subscription_url FROM subscriptions').get()).toEqual({ paused: 0, subscription_url: null });
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

  it('orders results by roaster/service, case-insensitively', () => {
    createSubscription(db, sampleInput({ roaster_service: 'zephyr coffee' }));
    createSubscription(db, sampleInput({ roaster_service: 'Airworks' }));
    createSubscription(db, sampleInput({ roaster_service: 'Bloom Roasters' }));
    const names = getSubscriptions(db).map((s) => s.roaster_service);
    expect(names).toEqual(['Airworks', 'Bloom Roasters', 'zephyr coffee']);
  });
});

describe('withTotalGrams', () => {
  it('multiplies bag count by amount per bag', () => {
    const sub = { ...sampleInput(), id: 1, subscription_url: null, paused: 0, updated_at: '' };
    expect(withTotalGrams(sub).total_grams).toBe(600);
  });

  it('returns null when either input is missing', () => {
    const sub = { ...sampleInput({ bag_count: null }), id: 1, subscription_url: null, paused: 0, updated_at: '' };
    expect(withTotalGrams(sub).total_grams).toBeNull();
  });
});

describe('computeNextRenewalDate', () => {
  it('returns null when no renewal day is set', () => {
    expect(computeNextRenewalDate(null, new Date('2026-03-10T00:00:00.000Z'))).toBeNull();
  });

  it('returns this month when today is on or before the renewal day', () => {
    expect(computeNextRenewalDate(15, new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03-15');
    expect(computeNextRenewalDate(15, new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03-15');
  });

  it('returns next month when today is past the renewal day', () => {
    expect(computeNextRenewalDate(15, new Date('2026-03-20T00:00:00.000Z'))).toBe('2026-04-15');
  });

  it('rolls over into next year in December', () => {
    expect(computeNextRenewalDate(5, new Date('2026-12-20T00:00:00.000Z'))).toBe('2027-01-05');
  });

  it('clamps to the last real day of a shorter month', () => {
    // 2026 is not a leap year — February has 28 days.
    expect(computeNextRenewalDate(31, new Date('2026-02-10T00:00:00.000Z'))).toBe('2026-02-28');
    // April has 30 days.
    expect(computeNextRenewalDate(31, new Date('2026-04-15T00:00:00.000Z'))).toBe('2026-04-30');
  });
});

describe('withNextRenewalDate', () => {
  it('adds next_renewal_date while preserving other fields', () => {
    const sub = { ...sampleInput({ renewal_day: 10 }), id: 1, subscription_url: null, paused: 0, updated_at: '' };
    const result = withNextRenewalDate(sub, new Date('2026-03-01T00:00:00.000Z'));
    expect(result.next_renewal_date).toBe('2026-03-10');
    expect(result.roaster_service).toBe('Airworks');
  });
});

describe('applySubscriptionUrls', () => {
  const fixes = [
    { id: 1, roaster_service: 'Airworks', url: 'https://a.example/products/sub' },
    { id: 2, roaster_service: 'H&S Coffee Roasters', url: 'https://hs.example/products/sub' },
    { id: 3, roaster_service: 'Shoebox Coffee Roaster', url: 'https://sb.example/products/sub' }
  ];

  it('sets empty URLs on matching rows only, once', () => {
    createSubscription(db, sampleInput()); // 1 Airworks, no URL
    createSubscription(db, sampleInput({ roaster_service: 'Someone Else' })); // 2: roaster mismatch
    createSubscription(db, sampleInput({ roaster_service: 'Shoebox Coffee Roaster', subscription_url: 'https://kept.example' }));
    expect(applySubscriptionUrls(db, fixes, 'm1')).toEqual({ applied: 1, skipped: 2 });
    expect(getSubscriptionById(db, 1)?.subscription_url).toBe('https://a.example/products/sub');
    expect(getSubscriptionById(db, 2)?.subscription_url).toBeNull();
    expect(getSubscriptionById(db, 3)?.subscription_url).toBe('https://kept.example');

    updateSubscription(db, 1, sampleInput({ subscription_url: '' }));
    expect(applySubscriptionUrls(db, fixes, 'm1')).toBeNull();
    expect(getSubscriptionById(db, 1)?.subscription_url).toBe('');
  });

  it('treats an empty-string URL as missing, and leaves no marker on an empty table', () => {
    expect(applySubscriptionUrls(db, fixes, 'm2')).toBeNull();
    createSubscription(db, sampleInput({ subscription_url: '' }));
    expect(applySubscriptionUrls(db, fixes, 'm2')).toEqual({ applied: 1, skipped: 2 });
  });

  it('lists the six live subscriptions', () => {
    expect(SUBSCRIPTION_URLS_2026_10_08.map((f) => [f.id, f.roaster_service])).toEqual([
      [1, 'Airworks'], [2, 'H&S Coffee Roasters'], [3, 'Shoebox Coffee Roaster'], [4, 'norml'], [5, 'Scenery'], [6, 'Ceto']
    ]);
  });
});
