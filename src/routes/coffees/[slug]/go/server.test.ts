import { describe, it, expect, vi } from 'vitest';
import { createDb } from '#lib/server/db.ts';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('#lib/server/db.ts', async (orig) => ({ ...(await orig<object>()), getDb: () => h.db }));
const { GET } = await import('./+server');

const db = createDb(':memory:');
h.db = db;
db.prepare(
  `INSERT INTO coffees (roaster, coffee_name, slug, product_url, created_at, updated_at)
   VALUES ('Sey', 'X', 'sey-x', 'https://sey.example/products/x', 'x', 'x')`
).run();

const call = async (slug: string, to: string) => {
  try {
    await GET({ params: { slug }, url: new URL(`http://localhost/coffees/${slug}/go?to=${to}`) } as Parameters<typeof GET>[0]);
  } catch (e) {
    return e as { status: number; location?: string };
  }
  throw new Error('no redirect');
};

describe('GET /coffees/[slug]/go', () => {
  it('redirects to the stored external product URL (kit 3 needs external: true)', async () => {
    expect(await call('sey-x', 'product')).toMatchObject({ status: 302, location: 'https://sey.example/products/x' });
  });
  it('404s an unknown coffee, a missing link and an unknown target', async () => {
    expect(await call('nope', 'product')).toMatchObject({ status: 404 });
    expect(await call('sey-x', 'credit')).toMatchObject({ status: 404 });
    expect(await call('sey-x', 'other')).toMatchObject({ status: 404 });
  });
});
