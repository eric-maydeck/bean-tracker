import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createDb } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';
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

const PW = 'sign-in-pw';
const savedHash = process.env.ADMIN_PASSWORD_HASH;
afterAll(() => {
  if (savedHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = savedHash;
});

describe('GET /api/me', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH = hashPassword(PW);
    h.db = createDb(':memory:');
    _resetForTests();
  });

  it('401s with no header, a wrong password, or no sign-in password configured', async () => {
    expect((await call()).status).toBe(401);
    expect((await call(basic('nope'))).status).toBe(401);
    delete process.env.ADMIN_PASSWORD_HASH;
    expect((await call(basic(PW))).status).toBe(401);
  });

  it('answers the identity for the right password', async () => {
    const res = await call(basic(PW));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'bean-tracker', name: 'Bean Tracker' });
  });
});
