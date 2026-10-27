import { describe, it, expect, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb, getHouseholdSize, setHouseholdSize } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import { actions, load } from './+page.server';

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
  for (const name of ['linkBeanConqueror', 'create', 'updateHouseholdSize'] as const) {
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

describe('?/updateHouseholdSize', () => {
  it('saves a whole number from 1 to 20', async () => {
    expect(await actions.updateHouseholdSize(post({ householdSize: '3' }))).toEqual({ success: true });
    expect(getHouseholdSize(getDb())).toBe(3);
    setHouseholdSize(getDb(), 2);
  });

  it('400s on anything else and keeps the old size', async () => {
    for (const v of ['0', '21', '1.5', 'x', '']) {
      const r = await actions.updateHouseholdSize(post({ householdSize: v }));
      expect(isActionFailure(r) && r.status).toBe(400);
    }
    expect(getHouseholdSize(getDb())).toBe(2);
  });
});

// Seeds one 300 g bag and its bean; brews are added by the caller.
function seedBag(beanId: string) {
  const db = getDb();
  db.exec('DELETE FROM beanconqueror_brews; DELETE FROM beanconqueror_bean_origins; DELETE FROM beanconqueror_beans; DELETE FROM coffees;');
  const { id } = createCoffee(db, {
    roaster: 'R', coffee_name: 'C', origin: null, roast_level: null, processing: null, amount_g: 300, cost: null,
    roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null, image_url: null
  });
  db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES (?, 'C', '2026-10-10', ?)`).run(beanId, id);
  return db.prepare(
    `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, imported_at) VALUES (?, '${beanId}', ?, '2026-10-10')`
  );
}

describe('/stats load: Time to Clear (temporary panel)', () => {
  it('measured rates for every Period, household and per person', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      const ins = seedBag('b1');
      ins.run('2026-10-04T08:00:00.000Z', 140);
      ins.run('2026-10-10T08:00:00.000Z', 70);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = load({ locals: { isAdmin: false } } as never) as any;
      expect(d.householdSize).toBe(2);
      expect(d.rates).toBeUndefined();
      expect(d.years).toEqual([2026]);
      // 210 g over 7 tracked days = 30 g/day; 300 g bag less the 210 logged = 90 g on hand -> 3 days.
      expect(d.consumption['1w'].household).toMatchObject({ perDay: 30, daysToClear: 3, clearBy: '2026-10-13' });
      expect(d.consumption['1w'].person).toMatchObject({ perDay: 15, daysToClear: 6, clearBy: '2026-10-16' });
      expect(d.consumption.all.household.perDay).toBe(30); // tracking began Oct 4
      expect(Object.keys(d.consumption).sort()).toEqual(['1m', '1w', '12m', '2026', '3m', '3y', '6m', 'all', 'ytd'].sort());
      expect(d.consumption['12m'].household.perDay).toBe(30);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a Period with no brews shows nothing, not Infinity', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-10T18:00:00Z'));
      seedBag('b2').run('2025-06-01T08:00:00.000Z', 15);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = load({ locals: { isAdmin: false } } as never) as any;
      expect(d.consumption['1w'].household).toEqual({ perDay: null, perWeek: null, perMonth: null, daysToClear: null, clearBy: null });
      expect(d.consumption['2025'].household.perDay).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
