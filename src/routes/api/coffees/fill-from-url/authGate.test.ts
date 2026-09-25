import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// Guards against a refactor dropping requireAdmin(locals): this route makes
// the server fetch arbitrary URLs, so it must never be reachable anonymously.
describe('POST /api/coffees/fill-from-url', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    const request = new Request('http://localhost/api/coffees/fill-from-url', { method: 'POST' });
    await expect(POST({ request, locals: { isAdmin: false } } as Parameters<typeof POST>[0])).rejects.toMatchObject({
      status: 401
    });
  });
});
