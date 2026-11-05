import { describe, it, expect, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb, getHouseholdSize, setHouseholdSize } from '$lib/server/db';
import ExcelJS from 'exceljs';
import { fixtureZip } from '$lib/server/fixtures/beanconqueror/fixture';
import { MAX_UPLOAD_BYTES } from '$lib/server/beanConquerorJson';
import { linkMarks } from '$lib/server/brewNow/outcome';
import type { ImportChanges } from '$lib/server/beanconqueror';
import { createCoffee } from '$lib/server/coffees';
import { brewingZone, localDate } from '$lib/localDate';
import { localToday } from '$lib/server/localToday';
import { actions, load } from './+page.server';

vi.mock('$lib/server/brewNow/outcome', () => ({ linkMarks: vi.fn(() => 0) }));

const event = (isAdmin: boolean) =>
  ({ locals: { isAdmin }, url: new URL('https://beans.example/account'), request: new Request('http://localhost/account', { method: 'POST', body: new FormData() }) }) as never;

describe('account load', () => {
  it('redirects a signed-out visitor to sign in', () => {
    try {
      load(event(false));
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ status: 303, location: '/login?redirectTo=%2Faccount' });
    }
  });

  it('returns the upload status and this request\'s origin for an admin', () => {
    const db = getDb();
    db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, has_flow_profile, bc_created_at, imported_at) VALUES ('11111111-1111-1111-1111-111111111111', 1, '2026-10-01T00:00:00Z', 'x')`).run();
    db.prepare(`INSERT INTO beanconqueror_brew_flows (bc_uuid, format, step_ms, points, weights, uploaded_at) VALUES ('11111111-1111-1111-1111-111111111111', 1, 100, 1, '[1]', 'x'), ('22222222-2222-2222-2222-222222222222', 1, 100, 1, '[1]', 'x')`).run();
    const data = load(event(true)) as { status: Record<string, unknown>; uploadUrl: string; lastImportedAt: string | null };
    expect(data.status).toMatchObject({ flows: 2, joined: 1, waiting: 1, brewsWithFlow: 1 });
    expect(data.uploadUrl).toBe('https://beans.example/');
    expect(data.lastImportedAt).toBeNull();
    db.prepare(`DELETE FROM beanconqueror_brews`).run(); // the import test below counts rows
  });
});

describe('account actions: auth', () => {
  it('rejects a signed-out import with 401', async () => {
    await expect(actions.importBeanConqueror(event(false))).rejects.toMatchObject({ status: 401 });
  });
});

function upload(bytes: Uint8Array, name = 'Beanconqueror.zip') {
  const body = new FormData();
  body.set('file', new File([bytes as BlobPart], name));
  return { request: new Request('http://localhost/account', { method: 'POST', body }), locals: { isAdmin: true } } as never;
}
function failure(result: unknown) {
  expect(isActionFailure(result)).toBe(true);
  return isActionFailure(result) ? { status: result.status, data: result.data } : null;
}

describe('?/importBeanConqueror', () => {
  it('rejects an .xlsx export with a clear message', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Beans').addRow(['Name']);
    const xlsx = new Uint8Array(await wb.xlsx.writeBuffer());
    const f = failure(await actions.importBeanConqueror(upload(xlsx, 'export.xlsx')));
    expect(f?.status).toBe(400);
    expect((f?.data as unknown as { importError: string }).importError).toMatch(/isn't a Bean Conqueror export/);
  });

  it('imports the .zip export and reports what it read', async () => {
    const r = (await actions.importBeanConqueror(upload(await fixtureZip()))) as { success: true; changes: ImportChanges };
    expect(r.success).toBe(true);
    expect(r.changes).toMatchObject({ beans: { new: 10 }, brews: { new: 68 }, waters: { new: 17 } });
    const n = getDb().prepare(`SELECT COUNT(*) n FROM beanconqueror_brews WHERE bc_uuid IS NOT NULL`).get() as { n: number };
    expect(n.n).toBe(68);
    expect(linkMarks).toHaveBeenCalledTimes(1); // Brew now marks link to the brews just imported
  });

  it('400s on a file that is not a zip', async () => {
    expect(failure(await actions.importBeanConqueror(upload(new TextEncoder().encode('hi'), 'x.txt')))).toEqual({
      status: 400, data: { importError: 'Could not read that file as a .zip' }
    });
  });

  it('400s on an upload over 20 MB without reading it', async () => {
    const f = failure(await actions.importBeanConqueror(upload(new Uint8Array(MAX_UPLOAD_BYTES + 1))));
    expect(f?.status).toBe(400);
    expect((f?.data as unknown as { importError: string }).importError).toMatch(/over 20 MB/);
  });
});

describe('brew now dose and ratio lists', () => {
  const post = (value: string, isAdmin = true) => {
    const body = new FormData();
    body.set('value', value);
    return { request: new Request('http://localhost/account', { method: 'POST', body }), locals: { isAdmin } } as never;
  };
  const data = () => load(event(true)) as unknown as { doses: number[]; ratios: { ratios: number[]; derived: boolean } };
  it('adds and removes doses; load returns them', async () => {
    await expect(actions.addDose(post('22'))).resolves.toEqual({ listSaved: true });
    expect(data().doses).toEqual([15, 18, 20, 22]);
    await actions.removeDose(post('15'));
    expect(data().doses).toEqual([18, 20, 22]);
  });
  it('ratios are derived until the first edit stores them', async () => {
    getDb().prepare(`DELETE FROM beanconqueror_brews`).run(); // the import test above left fixture brews
    expect(data().ratios).toEqual({ ratios: [15, 16, 17], derived: true });
    await actions.addRatio(post('16.5'));
    expect(data().ratios).toEqual({ ratios: [15, 16, 16.5, 17], derived: false });
    await actions.removeRatio(post('15'));
    expect(data().ratios.ratios).toEqual([16, 16.5, 17]);
  });
  it('rejects bad input with listError', async () => {
    expect(failure(await actions.addDose(post('3')))).toEqual({ status: 400, data: { listError: 'Each dose must be 5–40g', list: 'doses' } });
    expect(failure(await actions.addRatio(post('25')))).toEqual({ status: 400, data: { listError: 'Each ratio must be 10–20', list: 'ratios' } });
  });
  it('rejects a non-admin with 401', async () => {
    for (const a of ['addDose', 'removeDose', 'addRatio', 'removeRatio'] as const)
      await expect(actions[a](post('18', false))).rejects.toMatchObject({ status: 401 });
  });
});

function post(fields: Record<string, string>, isAdmin = true) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return { request: new Request('http://localhost/account', { method: 'POST', body }), locals: { isAdmin } } as never;
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

describe('not yet tracked: load', () => {
  it('lists unmatched beans with their total and the linkable coffees', () => {
    const db = getDb();
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('bean-u', 'Unmatched', '2026-10-01')`).run();
    const coffeeId = addBeanAndCoffee('Loadable');
    const d = load(event(true)) as { unmatchedBeans: { beans: { id: string }[]; total: number }; linkableCoffees: { id: number }[] };
    expect(d.unmatchedBeans.total).toBeGreaterThanOrEqual(1);
    expect(d.unmatchedBeans.beans.map((b) => b.id)).toContain('bean-u');
    expect(d.linkableCoffees.map((c) => c.id)).toContain(coffeeId);
  });
});

describe('not yet tracked: actions', () => {
  for (const name of ['linkBeanConqueror', 'dismissBeanConqueror', 'create'] as const) {
    it(`${name} rejects a signed-out request with 401`, async () => {
      await expect(actions[name](post({}, false))).rejects.toMatchObject({ status: 401 });
    });
  }

  it('links, then rejects a second link to the same coffee with a clean 400', async () => {
    const coffeeId = addBeanAndCoffee('Alpha');
    getDb().prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('bean-x', 'X', '2026-10-01')`).run();
    expect(await actions.linkBeanConqueror(post({ beanId: 'bean-Alpha', coffeeId: String(coffeeId) }))).toEqual({ success: true });
    const again = await actions.linkBeanConqueror(post({ beanId: 'bean-x', coffeeId: String(coffeeId) }));
    expect(failure(again)).toEqual({ status: 400, data: { error: 'Alpha is already linked to a Bean Conqueror bean' } });
  });

  it('400s on a missing or bad coffee id', async () => {
    expect(failure(await actions.linkBeanConqueror(post({ beanId: 'bean-x', coffeeId: 'abc' })))?.status).toBe(400);
  });

  it('dismiss removes the bean from the list; 400s without an id', async () => {
    getDb().prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at) VALUES ('bean-d', 'D', '2026-10-01')`).run();
    expect(await actions.dismissBeanConqueror(post({ id: 'bean-d' }))).toEqual({ success: true });
    const d = load(event(true)) as { unmatchedBeans: { beans: { id: string }[] } };
    expect(d.unmatchedBeans.beans.map((b) => b.id)).not.toContain('bean-d');
    expect(failure(await actions.dismissBeanConqueror(post({})))?.status).toBe(400);
  });
});

describe('?/updateHouseholdSize', () => {
  it('load returns the size; a signed-out request is 401', async () => {
    expect((load(event(true)) as { householdSize: number }).householdSize).toBe(2);
    await expect(actions.updateHouseholdSize(post({}, false))).rejects.toMatchObject({ status: 401 });
  });

  it('saves a whole number from 1 to 20', async () => {
    expect(await actions.updateHouseholdSize(post({ householdSize: '3' }))).toEqual({ success: true });
    expect(getHouseholdSize(getDb())).toBe(3);
    setHouseholdSize(getDb(), 2);
  });

  it('400s on anything else and keeps the old size', async () => {
    for (const v of ['0', '21', '1.5', 'x', '']) {
      expect(failure(await actions.updateHouseholdSize(post({ householdSize: v })))).toEqual({
        status: 400,
        data: { error: 'Household size must be a whole number from 1 to 20' }
      });
    }
    expect(getHouseholdSize(getDb())).toBe(2);
  });
});

describe('time and stats settings', () => {
  type Settings = { settings: { brewingZone: string; displayZone: string; dateFormat: string; defaultCaffeine: string }; zones: string[] };
  const settings = () => (load(event(true)) as unknown as Settings).settings;

  it('load returns the settings and a zone list that includes UTC', () => {
    const d = load(event(true)) as unknown as Settings;
    expect(d.settings).toMatchObject({ displayZone: 'browser', dateFormat: 'iso12', defaultCaffeine: 'caffeinated' });
    expect(d.zones).toContain('UTC');
    expect(d.zones).toContain('America/Denver');
  });

  it('signed out is 401', async () => {
    for (const a of ['setBrewingZone', 'setDisplayZone', 'setDateFormat', 'setDefaultCaffeine'] as const)
      await expect(actions[a](post({ value: 'UTC' }, false))).rejects.toMatchObject({ status: 401 });
  });

  it('a valid zone saves; setBrewingZone also moves the process zone (localToday follows)', async () => {
    expect(await actions.setBrewingZone(post({ value: 'Pacific/Kiritimati' }))).toEqual({ settingSaved: true });
    expect(settings().brewingZone).toBe('Pacific/Kiritimati');
    expect(brewingZone()).toBe('Pacific/Kiritimati');
    expect(localToday()).toBe(localDate(new Date().toISOString()));
    expect(await actions.setDisplayZone(post({ value: 'Asia/Tokyo' }))).toEqual({ settingSaved: true });
    expect(await actions.setDisplayZone(post({ value: 'browser' }))).toEqual({ settingSaved: true });
    expect(settings().displayZone).toBe('browser');
    await actions.setBrewingZone(post({ value: 'America/Denver' }));
  });

  it('an unknown zone is a 400 and changes nothing', async () => {
    expect(failure(await actions.setBrewingZone(post({ value: 'Mars/Base' })))?.status).toBe(400);
    expect(failure(await actions.setDisplayZone(post({ value: 'Mars/Base' })))?.status).toBe(400);
    expect(failure(await actions.setBrewingZone(post({ value: 'browser' })))?.status).toBe(400); // only Display has "browser"
    expect(settings().brewingZone).toBe('America/Denver');
    expect(brewingZone()).toBe('America/Denver');
  });

  it('date format and default caffeine save; junk is a 400', async () => {
    for (const v of ['iso24', 'us', 'eu', 'iso12']) expect(await actions.setDateFormat(post({ value: v }))).toEqual({ settingSaved: true });
    for (const v of ['decaf', 'all', 'caffeinated']) expect(await actions.setDefaultCaffeine(post({ value: v }))).toEqual({ settingSaved: true });
    await actions.setDateFormat(post({ value: 'eu' }));
    await actions.setDefaultCaffeine(post({ value: 'decaf' }));
    expect(settings()).toMatchObject({ dateFormat: 'eu', defaultCaffeine: 'decaf' });
    expect(failure(await actions.setDateFormat(post({ value: 'zz' })))?.status).toBe(400);
    expect(failure(await actions.setDefaultCaffeine(post({ value: '' })))?.status).toBe(400);
    expect(settings()).toMatchObject({ dateFormat: 'eu', defaultCaffeine: 'decaf' });
    await actions.setDateFormat(post({ value: 'iso12' }));
    await actions.setDefaultCaffeine(post({ value: 'caffeinated' }));
  });
});
