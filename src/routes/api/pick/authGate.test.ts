import { describe, it, expect } from 'vitest';
import { GET, PUT } from './+server';

// Admin-only storage for Pick; refused before the db or the body is touched.
describe('/api/pick', () => {
  it('401s GET and PUT without the session', async () => {
    await expect(
      GET({ url: new URL('http://localhost/api/pick?key=pick.today'), locals: { isAdmin: false } } as Parameters<typeof GET>[0])
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      PUT({
        request: new Request('http://localhost/api/pick', { method: 'PUT', body: '{}' }),
        locals: { isAdmin: false }
      } as Parameters<typeof PUT>[0])
    ).rejects.toMatchObject({ status: 401 });
  });
});
