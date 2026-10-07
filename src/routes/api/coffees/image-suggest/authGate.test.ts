import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// The server fetches pages of the caller's choosing here (like fill-from-url),
// so it must never be reachable anonymously; bad input is refused before any
// DB read or fetch.
const call = (body: unknown, isAdmin = true) =>
  POST({
    request: new Request('http://localhost/api/coffees/image-suggest', {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    locals: { isAdmin }
  } as Parameters<typeof POST>[0]);

describe('POST /api/coffees/image-suggest', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    await expect(call(undefined, false)).rejects.toMatchObject({ status: 401 });
  });

  it('400s a missing roaster or coffee name', async () => {
    for (const body of [undefined, {}, { roaster: 'Lume' }, { name: 'Kiambu' }, { roaster: ' ', name: 'Kiambu' }, { roaster: 1, name: 2 }]) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Roaster and coffee name are required' });
    }
  });

  it('400s a site that is not a web address', async () => {
    for (const site of ['javascript:alert(1)', 'ftp://x.example', 'http://']) {
      const res = await call({ roaster: 'Lume', name: 'Kiambu', site });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "That site isn't a web address" });
    }
  });
});
