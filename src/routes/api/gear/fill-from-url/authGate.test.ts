import { describe, it, expect } from 'vitest';
import { POST } from './+server';

type Ev = Parameters<typeof POST>[0];
const call = (admin: boolean, body?: unknown) =>
  POST({ request: new Request('http://localhost/api/gear/fill-from-url', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }), locals: { isAdmin: admin } } as Ev);

describe('POST /api/gear/fill-from-url', () => {
  it('rejects an unauthenticated request with a 401 first', async () => {
    await expect(call(false)).rejects.toMatchObject({ status: 401 });
  });
  it('400s a blank url', async () => {
    expect((await call(true, { url: ' ', kind: 'dripper' })).status).toBe(400);
  });
  it('400s a bad kind', async () => {
    expect((await call(true, { url: 'https://example.com/p', kind: 'kettle' })).status).toBe(400);
  });
});
