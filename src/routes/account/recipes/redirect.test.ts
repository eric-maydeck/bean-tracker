import { describe, it, expect } from 'vitest';
import { GET } from './+server';

describe('/account/recipes redirect', () => {
  it('301s to /recipes keeping the query', () => {
    for (const [q, to] of [['', '/recipes'], ['?brews=r3&order=top', '/recipes?brews=r3&order=top']]) {
      try {
        GET({ url: new URL('https://x/account/recipes' + q) } as never);
        expect.unreachable();
      } catch (e) {
        expect(e).toMatchObject({ status: 301, location: to });
      }
    }
  });
});
