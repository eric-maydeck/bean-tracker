import { describe, it, expect, vi } from 'vitest';
import { isRedirect, isActionFailure } from '@sveltejs/kit';

// getDb() is a lazily-created singleton keyed off DB_PATH — set before the
// first import touches it so this file gets its own in-memory database
// (vitest isolates modules per test file, so this doesn't leak elsewhere).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee, updateCoffee, getRedirectSlug, type NewCoffeeInput } from '$lib/server/coffees';
import { load, actions } from './+page.server';
import { load as insightsLoad } from '../../insights/+page.server';

function sampleInput(overrides: Partial<NewCoffeeInput> = {}): NewCoffeeInput {
  return {
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 200,
    cost: 18,
    roast_date: '2026-01-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 20,
    image_url: null,
    ...overrides
  };
}

describe('getRedirectSlug (pure helper)', () => {
  it('finds the current slug for a renamed coffee\'s old slug', () => {
    const db = getDb();
    const { id, slug: oldSlug } = createCoffee(db, sampleInput({ coffee_name: 'Redirect Helper Test' }));
    updateCoffee(db, id, sampleInput({ coffee_name: 'Redirect Helper Test' }), 'redirect-helper-new-slug');
    expect(getRedirectSlug(db, oldSlug)).toBe('redirect-helper-new-slug');
  });
});

describe('load (coffee detail page)', () => {
  it('redirects 301, no-store, to the current slug for an old one', async () => {
    const db = getDb();
    const { id, slug: oldSlug } = createCoffee(db, sampleInput({ coffee_name: 'Redirect Load Test' }));
    updateCoffee(db, id, sampleInput({ coffee_name: 'Redirect Load Test' }), 'redirect-load-new-slug');

    const headers: Record<string, string> = {};
    const fakeEvent = {
      params: { slug: oldSlug },
      setHeaders: (h: Record<string, string>) => Object.assign(headers, h),
      locals: { isAdmin: false }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    try {
      await load(fakeEvent);
      expect.unreachable('load should have thrown a redirect');
    } catch (err) {
      if (!isRedirect(err)) throw err;
      expect(err.status).toBe(301);
      expect(err.location).toBe('/coffees/redirect-load-new-slug');
      expect(headers['cache-control']).toBe('no-store');
    }
  });
});

describe('coffee page Bean Conqueror link', () => {
  it('load includes the linked bean; Unlink is admin-only and returns the bean to the list', async () => {
    const db = getDb();
    const { id, slug } = createCoffee(db, sampleInput({ coffee_name: 'Linked Page Test' }));
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('pb1', 'BC Name', '2026-10-01', ?)`).run(id);
    const event = (isAdmin: boolean) => ({ params: { slug }, setHeaders: () => {}, locals: { isAdmin } }) as never;

    const data = (await load(event(false))) as { beanConqueror: unknown };
    expect(data.beanConqueror).toEqual({ id: 'pb1', name: 'BC Name', brewCount: 0 });

    await expect(actions.unlinkBeanConqueror(event(false))).rejects.toMatchObject({ status: 401 });
    expect(await actions.unlinkBeanConqueror(event(true))).toEqual({ success: true });
    const again = await actions.unlinkBeanConqueror(event(true));
    expect(isActionFailure(again) && again.status).toBe(400);
  });
});

describe("coffee page counts days on the local date", () => {
  it('at 21:00 local (UTC already the next day) days since roast is local-today minus roast', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T03:00:00Z')); // 2026-10-13 21:00 MDT
    try {
      const { slug } = createCoffee(getDb(), sampleInput({ coffee_name: 'local Day Test', roast_date: '2026-10-01' }));
      const data = (await load({ params: { slug }, setHeaders: () => {}, locals: { isAdmin: false } } as never)) as {
        coffee: { days_since_roast: number };
      };
      expect(data.coffee.days_since_roast).toBe(12);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('coffee page vs like coffees', () => {
  it('ranks a bag among like coffees; none without rated brews', () => {
    const db = getDb();
    const ev = (slug: string) => ({ params: { slug }, setHeaders: () => {}, locals: { isAdmin: false } }) as never;
    const ratings = [9, 8, 8, 7];
    const made = ratings.map((r, k) => {
      const c = createCoffee(db, sampleInput({ coffee_name: `Like ${k}`, roaster: `Roaster ${k}`, origin: ['Kenya', 'Peru', 'Brazil', 'Ethiopia'][k], roast_level: 'Light', processing: 'Washed' }));
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, 'C', '2026-10-01', ?)`).run(`lk${k}`, c.id);
      // 6 brews: Once dialed drops the first 2, leaving the 3 other bags 4 each (the pooled 10+).
      for (let j = 0; j < 6; j++)
        db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, ?, 15, ?, '2026-10-01')`)
          .run(`2026-09-0${j + 1}T08:00:00`, `lk${k}`, r);
      return c;
    });
    // A decaf Washed Light bag (rated 1) must not move the panel: decaf ratings are left out, as in Leaderboards' default.
    const dec = createCoffee(db, sampleInput({ coffee_name: 'Like Decaf', roaster: 'Roaster 9', origin: 'Colombia', roast_level: 'Light', processing: 'Washed', decaf: true }));
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('lkd', 'C', '2026-10-01', ?)`).run(dec.id);
    for (let j = 0; j < 6; j++)
      db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, rating, imported_at) VALUES (?, 'lkd', 15, 1, '2026-10-01')`).run(`2026-09-0${j + 1}T08:00:00`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const like = (load(ev(made[1].slug)) as any).like;
    expect(like).toMatchObject({ label: 'Washed Light coffees', rank: 2, of: 4 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((load(ev(dec.slug)) as any).like).toBeNull();
    // The panel's gap equals the Leaderboards vs-like row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = ((insightsLoad({ url: new URL('http://localhost/insights?tab=leaderboards&rank=like&range=all') } as never) as any).boards.coffees) as { key: string; value: number }[];
    expect(rows.find((r) => r.key === String(made[1].id))!.value).toBeCloseTo(like.gap, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((load(ev(made[0].slug)) as any).like).toMatchObject({ label: 'Washed Light coffees', rank: 1, of: 4, place: '1st of 4' });
    const bare = createCoffee(db, sampleInput({ coffee_name: 'Like None' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((load(ev(bare.slug)) as any).like).toBeNull();
  });
});
