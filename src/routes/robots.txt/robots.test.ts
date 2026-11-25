import { describe, it, expect } from 'vitest';
import { GET } from './+server';

describe('robots.txt', () => {
  it('serves text/plain disallowing query URLs and the API', async () => {
    const res = GET();
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    const body = await res.text();
    expect(body).toContain('Disallow: /*?');
    expect(body).toContain('Disallow: /api/');
  });
});
