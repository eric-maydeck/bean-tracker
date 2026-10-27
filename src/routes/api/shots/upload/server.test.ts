import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDb } from '$lib/server/db';
import { createUploadPassword, MAX_SHOT_BYTES } from '$lib/server/visualizerUpload';
import { _resetForTests, isLockedOut } from '$lib/server/loginRateLimit';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { POST } = await import('./+server');

const UUID = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0';
const bbs = JSON.parse(readFileSync('src/lib/server/fixtures/bcflow/bbs.json', 'utf8'));
const payload = (over: Record<string, unknown> = {}) => ({
  application: 'BEANCONQUEROR',
  brew: { config: { uuid: UUID } },
  brewFlow: bbs,
  ...over
});
const basic = (pw: string) => 'Basic ' + Buffer.from(`bean-tracker:${pw}`).toString('base64');
let pw = '';
const call = (body: unknown, { auth = basic(pw), ip = '1.1.1.1', headers = {} as Record<string, string> } = {}) => {
  const form = new FormData();
  form.set('file', new Blob([typeof body === 'string' ? body : JSON.stringify(body)]), 'visualizer.json');
  return POST({
    request: new Request('http://localhost/api/shots/upload', {
      method: 'POST',
      headers: { authorization: auth, 'cf-connecting-ip': ip, ...headers },
      body: form
    }),
    getClientAddress: () => '9.9.9.9'
  } as Parameters<typeof POST>[0]);
};
const rows = () => (h.db as ReturnType<typeof createDb>).prepare(`SELECT COUNT(*) n FROM beanconqueror_brew_flows`).get() as { n: number };

describe('POST /api/shots/upload', () => {
  beforeEach(() => {
    h.db = createDb(':memory:');
    pw = createUploadPassword(h.db as never);
    _resetForTests();
  });

  it('stores a shot and is idempotent on the brew uuid', async () => {
    const a = await call(payload());
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ id: UUID });
    expect(rows().n).toBe(1);
    const b = await call(payload());
    expect(await b.json()).toEqual({ id: UUID });
    expect(rows().n).toBe(1);
  });

  it('ignores a visualizerId we never issued and keys on the brew uuid', async () => {
    const res = await call(payload({ visualizerId: '7f3c9a52-1d4e-4b86-9a0f-2e5d8c1b6a37' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: UUID });
    expect(rows().n).toBe(1);
  });

  it('413s an oversized file even when content-length does not say so', async () => {
    const res = await call(payload({ pad: 'x'.repeat(MAX_SHOT_BYTES) }), { headers: { 'content-length': '10' } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Upload is too large' });
  });

  it('400s other applications, missing flow, and bad JSON', async () => {
    for (const [body, error] of [
      [payload({ application: 'VISUALIZER' }), 'Not a Bean Conqueror upload'],
      [payload({ brewFlow: {} }), 'This brew has no flow data'],
      ['{nope', 'visualizer.json is not valid JSON']
    ] as const) {
      const res = await call(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
    }
  });

  it('400s a request with no file', async () => {
    const res = await POST({
      request: new Request('http://localhost/api/shots/upload', {
        method: 'POST',
        headers: { authorization: basic(pw) },
        body: new FormData()
      }),
      getClientAddress: () => '9.9.9.9'
    } as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it('413s a declared 6 MB upload', async () => {
    const res = await call(payload(), { headers: { 'content-length': String(6 * 1024 * 1024) } });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Upload is too large' });
  });

  it('locks an IP after repeated bad passwords, without locking others or /login', async () => {
    for (let i = 0; i < 5; i++) expect((await call(payload(), { auth: basic('bad') })).status).toBe(401);
    const sixth = await call(payload(), { auth: basic('bad') });
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: 'Too many failed uploads; try again later' });
    expect((await call(payload(), { ip: '2.2.2.2' })).status).toBe(200);
    expect(isLockedOut('upload:1.1.1.1')).toBe(true);
    expect(isLockedOut('1.1.1.1')).toBe(false);
  });
});
