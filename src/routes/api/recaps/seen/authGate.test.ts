import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '$lib/server/db';
import { recapSeen } from '$lib/server/recaps/store';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { POST } = await import('./+server');

const call = (isAdmin: boolean, body: unknown) =>
  POST({
    request: new Request('http://localhost/api/recaps/seen', { method: 'POST', body: JSON.stringify(body) }),
    locals: { isAdmin }
  } as Parameters<typeof POST>[0]);

describe('POST /api/recaps/seen', () => {
  beforeEach(() => {
    const db = createDb(':memory:');
    db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, imported_at) VALUES ('2020-03-01T10:00:00.000Z', 'x')`).run();
    h.db = db;
  });

  it('rejects a signed-out request with a 401 before touching the body', async () => {
    await expect(call(false, { year: 2020 })).rejects.toMatchObject({ status: 401 });
  });
  it('admin: an open year is marked seen (204)', async () => {
    expect((await call(true, { year: 2020 })).status).toBe(204);
    expect(recapSeen(h.db as never, 2020)).toBe(true);
  });
  it('admin: a year that is not open is a 400', async () => {
    expect((await call(true, { year: 2099 })).status).toBe(400);
    expect((await call(true, {})).status).toBe(400);
  });
});
