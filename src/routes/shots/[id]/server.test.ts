import { describe, it, expect, vi } from 'vitest';
import { createDb } from '$lib/server/db';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { GET } = await import('./+server');

const UUID = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0';
const db = createDb(':memory:');
h.db = db;
const coffee = db
  .prepare(`INSERT INTO coffees (roaster, coffee_name, slug, created_at, updated_at) VALUES ('Sey', 'X', 'sey-x', 'x', 'x')`)
  .run().lastInsertRowid;
db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b1', 'X', 'x', ?)`).run(coffee);
db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, bean_id, imported_at) VALUES (?, 'x', 'b1', 'x')`).run(UUID);

const call = async (id: string) => {
  try {
    await GET({ params: { id } } as Parameters<typeof GET>[0]);
  } catch (e) {
    return e as { status: number; location?: string };
  }
  throw new Error('no redirect');
};

describe('GET /shots/[id]', () => {
  it('redirects a linked brew to its coffee page', async () => {
    expect(await call(UUID)).toMatchObject({ status: 303, location: '/coffees/sey-x' });
  });
  it('redirects an unknown brew to /coffees', async () => {
    expect(await call('11111111-1111-1111-1111-111111111111')).toMatchObject({ status: 303, location: '/coffees' });
  });
  it('404s a non-uuid id', async () => {
    expect(await call('../x')).toMatchObject({ status: 404 });
  });
});
