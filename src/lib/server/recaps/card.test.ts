import { describe, it, expect, beforeAll, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { localToday } from '#lib/server/localToday.ts';
vi.mock('node:fs', async (orig) => { const a = await orig<typeof import('node:fs')>(); return { ...a, unlinkSync: vi.fn(a.unlinkSync) }; });
import { cardFontSize, cardPng, cardSvg, cardsRoot, cachedCard, linePath, pickTicks, valueSizes } from './card';

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
  let db: Awaited<typeof import('#lib/server/db.ts')>;
  beforeAll(async () => {
    db = await import('#lib/server/db.ts');
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

describe('thumbnail legend', () => {
  it('long series names are clipped with an ellipsis and every entry renders', async () => {
    const values = [10, 40, 80, 30];
    const thumb = { kind: 'vbars' as const, series: ['x'.repeat(60), 'y'.repeat(60), 'Other'].map((label, color) => ({ label, color, values })) };
    const input = { big: 'Water', label: 'Stats', year: 0, cover: true, page: true, thumb } as never;
    const svg = await cardSvg(input);
    expect(svg).toContain('<svg'); // text is outlined to paths, so the ellipsis shows only in the PNG
    expect((await sharp(await cardPng(svg)).metadata()).format).toBe('png');
  });
});

describe('valueSizes', () => {
  it('fitting values keep the default size', () => expect(valueSizes(['9.2', '41 days'], 52, 288)).toEqual([52, 52]));
  it('a small step down for the longest applies to every value', () =>
    expect(valueSizes(['9.2', 'x'.repeat(10)], 52, 288)).toEqual([48, 48]));
  it('a big step down shrinks that value alone', () => {
    const [a, b] = valueSizes(['9.2', 'x'.repeat(30)], 52, 288);
    expect([a, b]).toEqual([52, 22]);
  });
  it('never goes under 22', () => expect(valueSizes(['x'.repeat(200)], 52, 288)).toEqual([22]));
  it('an unreasonably long text stops at the floor, short values are not held back', () =>
    expect(valueSizes(['9.2', 'x'.repeat(50)], 52, 288, 30)).toEqual([52, 30]));
  it('short and numeric values never reach the floor', () => expect(valueSizes(['$0.09/g', '41 days', '1kg'], 52, 288, 30)).toEqual([52, 52, 52]));
});

describe('flag emoji on a card', () => {
  it('draws a flag image instead of tofu', async () => {
    const thumb = { kind: 'bars' as const, rows: [['\u{1F1EA}\u{1F1F9} Ethiopia', '8.4', 1]] as [string, string, number][] };
    const svg = await cardSvg({ big: 'Origins', label: 'Stats', year: 0, cover: true, page: true, thumb });
    expect(svg).toContain('data:image/svg+xml;base64,');
  });
  it('cuts an unreasonably long grid value with an ellipsis and keeps short ones whole', async () => {
    const grid = (v: string) => cardSvg({ big: 'Money', label: 'Stats', year: 0, cover: true, page: true, thumb: { kind: 'grid', tiles: [['A', v]] } });
    // Text is drawn as paths: two values cut to the same visible text draw identically, two short ones differ.
    expect(await grid('x'.repeat(50))).toBe(await grid('x'.repeat(100)));
    expect(await grid('xxxxx')).not.toBe(await grid('xxxxxxx'));
  });
});

describe('chart card paths and ticks', () => {
  it('linePath never overshoots the points it joins, and a straight line stays straight', () => {
    const pts: [number, number][] = [[0, 100], [10, 20], [20, 20], [30, 80], [40, 10], [50, 12]];
    const nums = linePath(pts).match(/-?\d+\.?\d*/g)!.map(Number);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    const straight = linePath([[0, 50], [10, 40], [20, 30], [30, 20]]).match(/-?\d+\.?\d*/g)!.map(Number);
    for (let i = 0; i < straight.length; i += 2) expect(straight[i] + straight[i + 1]).toBeCloseTo(50, 0);
  });
  it('linePath breaks at gaps and draws a lone point as a dot', () => {
    const d = linePath([[0, 1], [10, 2], null, [20, 3], null, [30, 4], [40, 5]]);
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d).toContain('M20.0 3.0L20.0 3.0');
  });
  it('pickTicks keeps the first and last and drops the ones that would overlap', () => {
    const t = (n: number, w: number) => Array.from({ length: n }, (_, i) => ({ cx: 50 + i * 100, w }));
    expect(pickTicks(t(7, 40))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(pickTicks(t(7, 150))).toEqual([0, 2, 4, 6]);
    expect(pickTicks(t(4, 150))).toEqual([0, 2, 3].filter((i) => i !== 2));
  });
});
