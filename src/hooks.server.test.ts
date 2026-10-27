import { describe, it, expect, vi } from 'vitest';

process.env.DB_PATH = ':memory:';

import { handle } from './hooks.server';

// svelte.config.js turns SvelteKit's own form-origin check off (trustedOrigins), so this pins the hook that replaces it.
const run = (path: string) => {
  const resolve = vi.fn(async () => new Response('ok'));
  const url = new URL(path, 'http://localhost');
  const request = new Request(url, { method: 'POST', body: new FormData() });
  const event = { request, url, cookies: { get: () => undefined }, locals: {} };
  return { resolve, res: handle({ event, resolve } as never) };
};

describe('handle: form origin check', () => {
  it('403s a multipart POST with no Origin', async () => {
    const { res, resolve } = run('/stats');
    expect((await res).status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets the Bean Conqueror upload through without an Origin', async () => {
    const { res, resolve } = run('/api/shots/upload');
    expect((await res).status).toBe(200);
    expect(resolve).toHaveBeenCalledOnce();
  });
});
