import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { applySubscriptionLinks, type SubscriptionLink } from './subscriptionLinks';

const M = 'test_marker';
function setup() {
  const db = createDb(':memory:');
  const plan = (id: number, svc: string) =>
    db.prepare(`INSERT INTO subscriptions (id, roaster_service) VALUES (?, ?)`).run(id, svc);
  const bag = (slug: string, roaster: string, sub: number | null = null) =>
    db.prepare(
      `INSERT INTO coffees (roaster, coffee_name, slug, subscription_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')`
    ).run(roaster, slug, slug, sub);
  const sub = (slug: string) =>
    (db.prepare(`SELECT subscription_id s FROM coffees WHERE slug = ?`).get(slug) as { s: number | null }).s;
  return { db, plan, bag, sub };
}
const L = (slug: string, roaster: string, planId: number, planRoaster: string): SubscriptionLink => ({ slug, roaster, planId, planRoaster });

describe('applySubscriptionLinks', () => {
  it('links matching rows (bag roaster may differ from plan roaster) and returns the count', () => {
    const { db, plan, bag, sub } = setup();
    plan(901, 'Airworks');
    bag('a', 'Big Sur');
    bag('b', 'Airworks');
    expect(applySubscriptionLinks(db, [L('a', 'Big Sur', 901, 'Airworks'), L('b', 'Airworks', 901, 'Airworks')], M)).toBe(2);
    expect(sub('a')).toBe(901);
    expect(sub('b')).toBe(901);
  });

  it('skips bag-roaster mismatch, already linked, missing plan, plan-roaster mismatch', () => {
    const { db, plan, bag, sub } = setup();
    plan(901, 'Airworks');
    plan(902, 'Other');
    bag('r', 'Real');
    bag('l', 'Real', 902);
    bag('p', 'Real');
    bag('q', 'Real');
    const n = applySubscriptionLinks(db, [
      L('r', 'Wrong', 901, 'Airworks'),
      L('l', 'Real', 901, 'Airworks'),
      L('p', 'Real', 999, 'Airworks'),
      L('q', 'Real', 901, 'Other'),
    ], M);
    expect(n).toBe(0);
    expect([sub('r'), sub('l'), sub('p'), sub('q')]).toEqual([null, 902, null, null]);
  });

  it('is a no-op on a second call (marker)', () => {
    const { db, plan, bag, sub } = setup();
    plan(901, 'Airworks');
    bag('a', 'Big Sur');
    expect(applySubscriptionLinks(db, [L('a', 'Big Sur', 901, 'Airworks')], M)).toBe(1);
    db.prepare(`UPDATE coffees SET subscription_id = NULL`).run();
    expect(applySubscriptionLinks(db, [L('a', 'Big Sur', 901, 'Airworks')], M)).toBe(0);
    expect(sub('a')).toBeNull();
  });

  it('empty list returns 0 and writes no marker', () => {
    const { db } = setup();
    expect(applySubscriptionLinks(db, [], M)).toBe(0);
    expect(db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M)).toBeUndefined();
  });
});
