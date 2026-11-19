import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDb } from '#lib/server/db.ts';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('#lib/server/db.ts', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { GET, PUT } = await import('./+server');

const get = (key: string) =>
  GET({ url: new URL(`http://localhost/api/pick?key=${key}`), locals: { isAdmin: true } } as Parameters<typeof GET>[0]);
const put = (body: unknown) =>
  PUT({
    request: new Request('http://localhost/api/pick', { method: 'PUT', body: JSON.stringify(body) }),
    locals: { isAdmin: true }
  } as Parameters<typeof PUT>[0]);

describe('/api/pick', () => {
  beforeEach(() => {
    h.db = createDb(':memory:');
  });

  it('round-trips a value; an unset key reads null', async () => {
    expect(await (await get('pick.rules.saved')).json()).toEqual({ value: null });
    expect((await put({ key: 'pick.rules.saved', value: { v: 1, a: [2] } })).status).toBe(204);
    expect(await (await get('pick.rules.saved')).json()).toEqual({ value: { v: 1, a: [2] } });
  });

  it('stores named profiles under pick.profiles', async () => {
    const profiles = { Morning: { v: 1, sort: 'name' }, Weekend: { v: 1, repeats: true } };
    expect((await put({ key: 'pick.profiles', value: profiles })).status).toBe(204);
    expect(await (await get('pick.profiles')).json()).toEqual({ value: profiles });
  });

  it('stores the selected profile name; only a short string is accepted', async () => {
    expect((await put({ key: 'pick.profile.selected', value: 'Morning' })).status).toBe(204);
    expect(await (await get('pick.profile.selected')).json()).toEqual({ value: 'Morning' });
    expect((await put({ key: 'pick.profile.selected', value: '' })).status).toBe(204);
    for (const value of [1, null, { a: 1 }, ['x'], 'x'.repeat(41)]) expect((await put({ key: 'pick.profile.selected', value })).status).toBe(400);
    expect(await (await get('pick.profile.selected')).json()).toEqual({ value: '' });
  });

  it('400s an unknown key, 413s a body over 64KB', async () => {
    expect((await get('nope')).status).toBe(400);
    expect((await put({ key: 'nope', value: 1 })).status).toBe(400);
    expect((await put({ key: 'pick.today', value: 'x'.repeat(64 * 1024) })).status).toBe(413);
  });
});
