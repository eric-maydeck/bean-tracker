import { describe, it, expect } from 'vitest';
import { POST } from './+server';

describe('POST /api/alerts/mark-read', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    const request = new Request('http://localhost/api/alerts/mark-read', { method: 'POST' });
    await expect(
      POST({ request, locals: { isAdmin: false } } as Parameters<typeof POST>[0])
    ).rejects.toMatchObject({ status: 401 });
  });
});
