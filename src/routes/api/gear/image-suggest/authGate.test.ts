import { describe, it, expect } from 'vitest';
import { POST } from './+server';

type Ev = Parameters<typeof POST>[0];
const call = (admin: boolean, body?: unknown) =>
  POST({ request: new Request('http://localhost/api/gear/image-suggest', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }), locals: { isAdmin: admin } } as Ev);

describe('POST /api/gear/image-suggest', () => {
  it('rejects an unauthenticated request with a 401 first', async () => {
    await expect(call(false)).rejects.toMatchObject({ status: 401 });
  });
  it('400s a bad kind', async () => {
    expect((await call(true, { kind: 'kettle', name: 'V60' })).status).toBe(400);
  });
  it('400s a blank name', async () => {
    expect((await call(true, { kind: 'dripper', name: ' ' })).status).toBe(400);
  });
  it('400s a site that is not a web address', async () => {
    expect((await call(true, { kind: 'dripper', name: 'V60', site: 'not a site' })).status).toBe(400);
  });
});
