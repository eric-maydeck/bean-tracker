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

  it('lets link-preview bots read share links in their own group', async () => {
    const [previews, rest] = (await GET().text()).split('\n\n');
    expect(previews).toContain('User-agent: Twitterbot');
    expect(previews).toContain('User-agent: Slackbot');
    expect(previews).toMatch(/Allow: \/$/);
    expect(previews).not.toContain('Disallow');
    expect(rest).toMatch(/^User-agent: \*/);
  });
});
