import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '$lib/server/db';
import { createUploadPassword } from '$lib/server/visualizerUpload';
import { _resetForTests } from '$lib/server/loginRateLimit';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { GET } = await import('./+server');

const basic = (pw: string) => 'Basic ' + Buffer.from(`bean-tracker:${pw}`).toString('base64');
const call = (authorization?: string) =>
  GET({
    request: new Request('http://localhost/api/me', { headers: authorization ? { authorization } : {} }),
    getClientAddress: () => '1.2.3.4'
  } as Parameters<typeof GET>[0]);

describe('GET /api/me', () => {
  beforeEach(() => {
    h.db = createDb(':memory:');
    _resetForTests();
  });

  it('401s with no header, a wrong password, or no password created', async () => {
    expect((await call()).status).toBe(401);
    expect((await call(basic('nope'))).status).toBe(401);
    createUploadPassword(h.db as never);
    expect((await call(basic('nope'))).status).toBe(401);
  });

  it('answers the identity for the right password', async () => {
    const pw = createUploadPassword(h.db as never);
    const res = await call(basic(pw));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'bean-tracker', name: 'Bean Tracker' });
  });
});
