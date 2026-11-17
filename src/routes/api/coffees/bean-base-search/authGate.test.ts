import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// Reaches a paid third-party API, so it must never be reachable anonymously; bad input is refused
// before any DB read or fetch.
const call = (body: unknown, isAdmin = true) =>
  POST({
    request: new Request('http://localhost/api/coffees/bean-base-search', {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    locals: { isAdmin }
  } as Parameters<typeof POST>[0]);

describe('POST /api/coffees/bean-base-search', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    await expect(call(undefined, false)).rejects.toMatchObject({ status: 401 });
  });

  it('400s a missing roaster', async () => {
    for (const body of [undefined, {}, { coffee_name: 'Kiambu' }, { roaster: ' ' }, { roaster: 1 }]) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Roaster is required' });
    }
  });

  it('400s a roast date that is not YYYY-MM-DD', async () => {
    for (const roast_date of ['11/16/2026', '2026-13-45', 'soon', 5]) {
      const res = await call({ roaster: 'Lume', roast_date });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Roast date must be YYYY-MM-DD' });
    }
  });

  it('400s an over-long roaster or name', async () => {
    expect((await call({ roaster: 'x'.repeat(201) })).status).toBe(400);
    expect((await call({ roaster: 'Lume', coffee_name: 'x'.repeat(201) })).status).toBe(400);
  });
});
