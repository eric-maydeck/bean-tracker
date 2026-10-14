import { describe, it, expect, vi } from 'vitest';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createSubscription } from '$lib/server/subscriptions';
import { load } from './+page.server';

describe("subscriptions load: next renewal counts from the local date", () => {
  it('at 21:00 local (UTC already the 14th) a renewal on the 13th is still today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T03:00:00Z')); // 2026-10-13 21:00 MDT
    try {
      createSubscription(getDb(), { roaster_service: 'R', subscription_name: null, price: 20, bag_count: 1,
        amount_per_bag_g: 250, renewal_day: 13 });
      const data = (await load({} as never)) as { subscriptions: { next_renewal_date: string | null }[] };
      expect(data.subscriptions[0].next_renewal_date).toBe('2026-10-13');
    } finally {
      vi.useRealTimers();
    }
  });
});
