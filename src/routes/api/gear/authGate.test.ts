import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// Admin-only save of a piece of gear's details; refused before the body is read.
const call = (body: unknown, isAdmin = true) =>
  POST({
    request: new Request('http://localhost/api/gear', {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    locals: { isAdmin }
  } as Parameters<typeof POST>[0]);

describe('POST /api/gear', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    await expect(call(undefined, false)).rejects.toMatchObject({ status: 401 });
  });

  it('400s a bad kind, a blank name, bad values and a non-web image address', async () => {
    const ok = { kind: 'grinder', name: 'Niche Zero', values: {}, image_url: '' };
    for (const [body, error] of [
      [undefined, 'Unknown kind'],
      [{ ...ok, kind: 'toaster' }, 'Unknown kind'],
      [{ ...ok, name: '  ' }, 'Name is required'],
      [{ ...ok, name: 'x'.repeat(201) }, 'Name is required'],
      [{ ...ok, values: [] }, 'Details must be an object'],
      [{ ...ok, image_url: 'javascript:x' }, "That image isn't a web address"]
    ] as const) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
  });
});
