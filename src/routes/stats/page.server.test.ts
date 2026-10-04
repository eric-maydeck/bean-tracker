import { describe, it, expect } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { actions } from './+page.server';

function post(fields: Record<string, string>, isAdmin = true) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const request = new Request('http://localhost/stats', { method: 'POST', body });
  return { request, locals: { isAdmin } } as never;
}

function addBeanAndCoffee(name: string) {
  const db = getDb();
  const { id } = createCoffee(db, {
    roaster: 'R', coffee_name: name, origin: null, roast_level: null, processing: null, amount_g: null, cost: null,
    roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
  });
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES (?, ?, '2026-10-01')`).run(`bean-${name}`, name);
  return id;
}

describe('stats actions: auth', () => {
  for (const name of ['linkBeanConqueror', 'create'] as const) {
    it(`${name} rejects a signed-out request with 401`, async () => {
      await expect(actions[name](post({}, false))).rejects.toMatchObject({ status: 401 });
    });
  }
});

describe('?/linkBeanConqueror', () => {
  it('links, then rejects a second link to the same coffee with a clean 400', async () => {
    const coffeeId = addBeanAndCoffee('Alpha');
    getDb().prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('bean-x', 'X', '2026-10-01')`).run();
    expect(await actions.linkBeanConqueror(post({ beanId: 'bean-Alpha', coffeeId: String(coffeeId) }))).toEqual({ success: true });
    const again = await actions.linkBeanConqueror(post({ beanId: 'bean-x', coffeeId: String(coffeeId) }));
    expect(isActionFailure(again)).toBe(true);
    if (isActionFailure(again)) {
      expect(again.status).toBe(400);
      expect(again.data).toEqual({ error: 'Alpha is already linked to a Bean Conqueror bean' });
    }
  });

  it('400s on a missing or bad coffee id', async () => {
    const r = await actions.linkBeanConqueror(post({ beanId: 'bean-x', coffeeId: 'abc' }));
    expect(isActionFailure(r) && r.status).toBe(400);
  });
});
