import { describe, it, expect } from 'vitest';
import { POST } from './+server';

// Guards against a future refactor silently dropping the requireAdmin(locals)
// call from this route — the unit tests for validateSubscriptionBatch itself
// don't exercise the route handler, so nothing else would catch that
// regression.
describe('POST /api/subscriptions/validate-batch', () => {
  it('rejects an unauthenticated request with a 401 before touching the request body', async () => {
    const request = new Request('http://localhost/api/subscriptions/validate-batch', { method: 'POST' });
    await expect(
      POST({ request, locals: { isAdmin: false } } as Parameters<typeof POST>[0])
    ).rejects.toMatchObject({ status: 401 });
  });
});
