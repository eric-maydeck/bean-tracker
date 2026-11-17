import { describe, it, expect } from 'vitest';
import { POST } from './+server';

type Event = Parameters<typeof POST>[0];
const post = (body: unknown) =>
  POST({
    request: new Request('http://localhost/api/coffees/standardize', { method: 'POST', body: JSON.stringify(body) }),
    locals: { isAdmin: true }
  } as Event);

describe('POST /api/coffees/standardize', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    const request = new Request('http://localhost/api/coffees/standardize', { method: 'POST' });
    await expect(POST({ request, locals: { isAdmin: false } } as Event)).rejects.toMatchObject({ status: 401 });
  });

  it('answers 400 for a malformed body', async () => {
    for (const body of [{ mode: 'x' }, { mode: 'save', values: {} }, { mode: 'fill', values: { a: 1 }, incoming: {} }]) {
      expect((await post(body)).status).toBe(400);
    }
  });
});
