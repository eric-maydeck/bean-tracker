import { describe, it, expect, beforeAll, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { localToday } from '$lib/server/localToday';
vi.mock('node:fs', async (orig) => { const a = await orig<typeof import('node:fs')>(); return { ...a, unlinkSync: vi.fn(a.unlinkSync) }; });
import { cardFontSize, cardPng, cardSvg, cardsRoot, cachedCard } from './card';

const dir = mkdtempSync(join(tmpdir(), 'card-'));
process.env.DB_PATH = join(dir, 't.db');
const cur = Number(localToday().slice(0, 4));

describe('card', () => {
  it('cardFontSize: steps down with length', () => {
    expect(cardFontSize('124', 'big')).toBe(220);
    expect(cardFontSize('The patient washed purist', 'big')).toBe(88);
    expect(cardFontSize('x'.repeat(40), 'big')).toBe(64);
    expect(cardFontSize('x'.repeat(31), 'label')).toBe(40);
    expect(cardFontSize('x'.repeat(61), 'label')).toBe(32);
  });
  it('cardSvg: text is paths (no system fonts needed)', async () => {
    const svg = await cardSvg({ big: '1,489', label: 'brews in 2026', year: 2026, tone: 'espresso' });
    expect(svg).not.toMatch(/<text/);
    expect(svg).toMatch(/<path/);
  });
  it('cardPng: 1200×630 PNG with ink on the background', async () => {
    const png = await cardPng(await cardSvg({ big: '$1,234.56', label: 'A Roaster With A Forty Character Name Co', year: 2026, tone: 'sun' }));
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
    const { channels } = await sharp(png).stats();
    expect(channels[0].stdev).toBeGreaterThan(5);
  });
  it('cardsRoot: next to the DB; :memory: falls back to data/', () => {
    expect(cardsRoot('/x/y/a.db')).toBe('/x/y/recap-cards');
    expect(cardsRoot(':memory:')).toBe('data/recap-cards');
  });
  it('cachedCard: builds once per key; a new stamp replaces the old file', async () => {
    const make = vi.fn(async () => Buffer.from('png'));
    const k = { year: 2025, slide: 'total', stamp: 'a' };
    await cachedCard(k, make); await cachedCard(k, make);
    expect(make).toHaveBeenCalledTimes(1);
    await cachedCard({ ...k, stamp: 'b' }, make);
    await cachedCard({ ...k, slide: 'streak', stamp: 'a' }, make);
    expect(make).toHaveBeenCalledTimes(3);
    expect(readdirSync(cardsRoot()).sort()).toEqual(['2025_streak_a_v2.png', '2025_total_b_v2.png']);
  });
});

describe('cachedCard robustness', () => {
  it('leaves no temp files, keeps a slide whose id extends another, tolerates a vanished stale file', async () => {
    const make = async () => Buffer.from('x');
    await cachedCard({ year: 2024, slide: 'x', stamp: 'a' }, make);
    await cachedCard({ year: 2024, slide: 'x-more', stamp: 'a' }, make);
    await cachedCard({ year: 2024, slide: 'x', stamp: 'b' }, make);
    const files = readdirSync(cardsRoot()).filter((f) => f.startsWith('2024_'));
    expect(files.sort()).toEqual(['2024_x-more_a_v2.png', '2024_x_b_v2.png']);
    expect(readdirSync(cardsRoot()).some((f) => f.startsWith('.tmp-'))).toBe(false);
    // a stale file listed but deleted underneath us (ENOENT) must not fail the request
    const fs = await import('node:fs');
    const real = vi.mocked(fs.unlinkSync).getMockImplementation()!;
    vi.mocked(fs.unlinkSync).mockImplementation(((p: string) => { real(p); throw Object.assign(new Error('gone'), { code: 'ENOENT' }); }) as never);
    await expect(cachedCard({ year: 2024, slide: 'x', stamp: 'c' }, make)).resolves.toEqual(Buffer.from('x'));
    vi.mocked(fs.unlinkSync).mockImplementation(real);
  });
});

describe('endpoint', () => {
  let GET: (a: unknown) => Promise<Response>;
  let db: Awaited<typeof import('$lib/server/db')>;
  beforeAll(async () => {
    db = await import('$lib/server/db');
    const d = db.getDb(), now = '2026-10-09T00:00:00.000Z';
    ['A', 'B'].forEach((r, k) => {
      const id = d.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, origin, created_at, updated_at) VALUES (?, ?, ?, ?, '2020-01-01', '2020-01-01')`).run(r, `Bag ${r}`, `bag-${r}`, k ? 'Colombia' : 'Ethiopia').lastInsertRowid;
      d.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES (?, ?, ?, ?, ?)`).run(`b${k}`, `Bag ${r}`, r, now, id);
    });
    const ins = d.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, brew_temperature, water_amount_g, rating, imported_at) VALUES (?, ?, 18, 93, 290, 8, ?)`);
    for (const y of [cur - 1, cur]) for (let i = 0; i < 20; i++) ins.run(`${y}-06-${String(1 + (i % 8)).padStart(2, '0')}T${String(7 + (i % 14)).padStart(2, '0')}:10:00.000Z`, `b${i % 2}`, now);
    GET = (await import('../../../routes/recaps/[year]/card/[slide].png/+server')).GET as never;
  });
  const call = async (year: number, slide: string, q = '', isAdmin = false) => {
    try { return await GET({ params: { year: String(year), slide }, url: new URL(`http://x/recaps/${year}/card/${slide}.png${q}`), locals: { isAdmin } }); } catch (e) { return e as { status: number }; }
  };
  it('public 404 for preview and unknown slides; cover, poster and total render', async () => {
    expect(await call(cur, 'cover', '?preview=1')).toMatchObject({ status: 404 });
    expect(await call(cur - 1, 'nope')).toMatchObject({ status: 404 });
    for (const s of ['cover', 'poster', 'total']) {
      const r = (await call(cur - 1, s)) as Response;
      expect(r.headers.get('content-type')).toBe('image/png');
      expect(r.headers.get('cache-control')).toBe('public, max-age=3600');
      expect((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).width).toBe(1200);
    }
    expect(((await call(cur, 'cover', '?preview=1', true)) as Response).status).toBe(200);
  });
  it('a stale people=person is ignored: the household card', async () => {
    const a = Buffer.from(await ((await call(cur - 1, 'total')) as Response).arrayBuffer());
    const b = Buffer.from(await ((await call(cur - 1, 'total', '?people=person')) as Response).arrayBuffer());
    expect(b.equals(a)).toBe(true);
    expect(existsSync(cardsRoot())).toBe(true);
  });
});
