import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createDb } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';
import { _resetForTests } from '$lib/server/loginRateLimit';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { POST } = await import('./+server');

const basic = (pw: string) => 'Basic ' + Buffer.from(`bean-tracker:${pw}`).toString('base64');
// The csrf exemption for this path relies on these refusals happening before the body is read.
const call = (authorization?: string) => {
  const request = new Request('http://localhost/api/shots/upload', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body: 'not multipart'
  });
  const formData = vi.spyOn(request, 'formData');
  return POST({ request, getClientAddress: () => '1.2.3.4' } as Parameters<typeof POST>[0]).then((res) => ({
    res,
    read: formData.mock.calls.length > 0 || request.bodyUsed
  }));
};

const savedHash = process.env.ADMIN_PASSWORD_HASH;
afterAll(() => {
  if (savedHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = savedHash;
});

describe('POST /api/shots/upload', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH = hashPassword('sign-in-pw');
    h.db = createDb(':memory:');
    _resetForTests();
  });

  it('401s with no header, a wrong password, or no sign-in password configured, without reading the body', async () => {
    for (const auth of [undefined, basic('nope')]) {
      const { res, read } = await call(auth);
      expect(res.status).toBe(401);
      expect(read).toBe(false);
    }
    delete process.env.ADMIN_PASSWORD_HASH;
    const { res, read } = await call(basic('sign-in-pw'));
    expect(res.status).toBe(401);
    expect(read).toBe(false);
  });
});
