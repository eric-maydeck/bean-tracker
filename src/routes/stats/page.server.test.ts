import { describe, it, expect } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import { createCoffee } from '$lib/server/coffees';
import ExcelJS from 'exceljs';
import { fixtureZip } from '$lib/server/fixtures/beanconqueror/fixture';
import { MAX_UPLOAD_BYTES } from '$lib/server/beanConquerorJson';
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
  for (const name of ['linkBeanConqueror', 'create', 'importBeanConqueror'] as const) {
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

function upload(bytes: Uint8Array, name = 'Beanconqueror.zip') {
  const body = new FormData();
  body.set('file', new File([bytes as BlobPart], name));
  return { request: new Request('http://localhost/stats', { method: 'POST', body }), locals: { isAdmin: true } } as never;
}
function failure(result: unknown) {
  expect(isActionFailure(result)).toBe(true);
  return isActionFailure(result) ? { status: result.status, data: result.data } : null;
}

describe('?/importBeanConqueror', () => {
  it('still accepts an .xlsx export before the .zip import has run', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Beans').addRow(['Name']);
    const xlsx = new Uint8Array(await wb.xlsx.writeBuffer());
    expect(await actions.importBeanConqueror(upload(xlsx, 'export.xlsx'))).toEqual({
      success: true, imported: { beans: 0, brews: 0, waters: 0 }
    });
  });

  it('imports the .zip export and reports what it read', async () => {
    expect(await actions.importBeanConqueror(upload(await fixtureZip()))).toEqual({
      success: true, imported: { beans: 10, brews: 68, waters: 17 }
    });
    const n = getDb().prepare(`SELECT COUNT(*) n FROM beanconqueror_brews WHERE bc_uuid IS NOT NULL`).get() as { n: number };
    expect(n.n).toBe(68);
  });

  it('400s on a file that is not a zip', async () => {
    expect(failure(await actions.importBeanConqueror(upload(new TextEncoder().encode('hi'), 'x.txt')))).toEqual({
      status: 400, data: { error: 'Could not read that file as a .zip' }
    });
  });

  it('400s on an upload over 20 MB without reading it', async () => {
    const f = failure(await actions.importBeanConqueror(upload(new Uint8Array(MAX_UPLOAD_BYTES + 1))));
    expect(f?.status).toBe(400);
    expect((f?.data as unknown as { error: string }).error).toMatch(/over 20 MB/);
  });
});
