import { describe, it, expect, vi } from 'vitest';

process.env.DB_PATH = ':memory:';

import { handle } from './hooks.server';

// svelte.config.js turns SvelteKit's own form-origin check off (trustedOrigins), so this pins the hook that replaces it.
const run = (path: string, headers: Record<string, string> = {}) => {
  const resolve = vi.fn(async () => new Response('ok'));
  const url = new URL(path, 'http://localhost');
  const request = new Request(url, { method: 'POST', body: new FormData(), headers });
  const event = { request, url, cookies: { get: () => undefined }, locals: {} };
  return { resolve, res: handle({ event, resolve } as never) };
};

describe('handle: form origin check', () => {
  it('403s a multipart POST with no Origin', async () => {
    const { res, resolve } = run('/stats');
    expect((await res).status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers use:enhance forms with an action error, so the page shows it instead of doing nothing', async () => {
    const { res } = run('/login?/login', { 'x-sveltekit-action': 'true' });
    const r = await res;
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ type: 'error', error: { message: 'Cross-site POST form submissions are forbidden' } });
  });

  it('lets the Bean Conqueror upload through without an Origin', async () => {
    const { res, resolve } = run('/api/shots/upload');
    expect((await res).status).toBe(200);
    expect(resolve).toHaveBeenCalledOnce();
  });
});
