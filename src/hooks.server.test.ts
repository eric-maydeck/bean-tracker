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

describe('handle: origin check', () => {
  it('403s a multipart POST with no Origin', async () => {
    const { res, resolve } = run('/stats');
    expect((await res).status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers use:enhance forms with an action error, so the page shows it instead of doing nothing', async () => {
    const { res } = run('/login?/login', { 'x-sveltekit-action': 'true' });
    const r = await res;
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ type: 'error', error: { message: 'Cross-site POST requests are forbidden' } });
  });

  it('403s a JSON POST with no Origin, 413s an oversized anonymous body', async () => {
    const url = new URL('http://localhost/s');
    const json = (headers: Record<string, string>) => handle({ event: { request: new Request(url, { method: 'POST', body: '{}', headers }), url, cookies: { get: () => undefined }, locals: {} }, resolve: async () => new Response('ok') } as never);
    expect((await json({ 'content-type': 'application/json' })).status).toBe(403);
    expect((await json({ origin: 'http://localhost', 'content-length': '70000' })).status).toBe(413);
    expect((await json({ origin: 'http://localhost', 'content-length': '2' })).status).toBe(200);
  });

  it('answers an oversized anonymous form action with an ActionResult', async () => {
    const url = new URL('http://localhost/account?/upload');
    const request = new Request(url, { method: 'POST', body: 'x', headers: { origin: 'http://localhost', 'content-length': '70000', 'x-sveltekit-action': 'true' } });
    const r = await handle({ event: { request, url, cookies: { get: () => undefined }, locals: {} }, resolve: async () => new Response('ok') } as never);
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ type: 'error', error: { message: 'Sign in again to upload' } });
  });

  it('sets the security headers on resolved and refused responses', async () => {
    for (const r of [await run('/stats').res, await run('/api/shots/upload').res]) {
      expect(r.headers.get('strict-transport-security')).toBe('max-age=31536000');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
      expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    }
  });

  it('lets the Bean Conqueror upload through without an Origin', async () => {
    const { res, resolve } = run('/api/shots/upload');
    expect((await res).status).toBe(200);
    expect(resolve).toHaveBeenCalledOnce();
  });
});
