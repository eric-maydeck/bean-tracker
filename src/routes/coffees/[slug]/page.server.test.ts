import { describe, it, expect } from 'vitest';
import { isRedirect, isActionFailure } from '@sveltejs/kit';

// getDb() is a lazily-created singleton keyed off DB_PATH — set before the
// first import touches it so this file gets its own in-memory database
// (vitest isolates modules per test file, so this doesn't leak elsewhere).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee, updateCoffee, getRedirectSlug, type NewCoffeeInput } from '$lib/server/coffees';
import { load, actions } from './+page.server';

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
