import { describe, it, expect, vi } from 'vitest';
import { isActionFailure } from '@sveltejs/kit';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '$lib/server/db';
import ExcelJS from 'exceljs';
import { fixtureZip } from '$lib/server/fixtures/beanconqueror/fixture';
import { MAX_UPLOAD_BYTES } from '$lib/server/beanConquerorJson';
import { linkMarks } from '$lib/server/brewNow/outcome';
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
    expect((f?.data as unknown as { error: string }).error).toMatch(/isn't a Bean Conqueror export/);
  });

  it('imports the .zip export and reports what it read', async () => {
    expect(await actions.importBeanConqueror(upload(await fixtureZip()))).toEqual({
      success: true, imported: { beans: 10, brews: 68, waters: 17 }
    });
    const n = getDb().prepare(`SELECT COUNT(*) n FROM beanconqueror_brews WHERE bc_uuid IS NOT NULL`).get() as { n: number };
    expect(n.n).toBe(68);
    expect(linkMarks).toHaveBeenCalledTimes(1); // Brew now marks link to the brews just imported
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
