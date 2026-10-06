import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// The server fetches a caller-chosen URL here (like fill-from-url), so it must
// never be reachable anonymously; and bad input is refused before any fetch.
const call = (body: unknown, isAdmin = true) =>
  POST({
    request: new Request('http://localhost/api/coffees/image-fill', {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    locals: { isAdmin }
  } as Parameters<typeof POST>[0]);

describe('POST /api/coffees/image-fill', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    await expect(call(undefined, false)).rejects.toMatchObject({ status: 401 });
  });

  it('400s a missing URL', async () => {
    for (const body of [undefined, {}, { url: '  ' }, { url: 42 }]) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'No image URL' });
    }
  });

  it('400s a non-http(s) URL without fetching it', async () => {
    for (const url of ['ftp://img.example/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'img.example/a.png']) {
      const res = await call({ url });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Only http:// and https:// images' });
    }
  });
});
