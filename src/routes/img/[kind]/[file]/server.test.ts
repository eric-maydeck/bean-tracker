import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET } from './+server';

const FILE = `${'a'.repeat(64)}.webp`;
let dir: string;
let prevDbPath: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bt-img-route-'));
  prevDbPath = process.env.DB_PATH;
  process.env.DB_PATH = join(dir, 'bean-tracker.db');
  mkdirSync(join(dir, 'images', 'coffees'), { recursive: true });
  writeFileSync(join(dir, 'images', 'coffees', FILE), Buffer.from('webp-bytes'));
  writeFileSync(join(dir, 'secret.txt'), 'nope');
});
afterEach(() => {
  if (prevDbPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = prevDbPath;
  rmSync(dir, { recursive: true, force: true });
});

const get = (kind: string, file: string) => GET({ params: { kind, file } } as never);
const status = async (kind: string, file: string) => {
  try {
    return (await get(kind, file)).status;
  } catch (e) {
    return (e as { status: number }).status;
  }
};

describe('GET /img/[kind]/[file]', () => {
  it('serves a stored copy with immutable caching', async () => {
    const res = await get('coffees', FILE);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('webp-bytes');
  });

  it('404s a valid name with no file', async () => {
    expect(await status('roasters', FILE)).toBe(404);
  });

  it.each([
    ['other', FILE],
    ['coffees', '../secret.txt'],
    ['coffees', '..%2Fsecret.txt'],
    ['coffees', `${'A'.repeat(64)}.webp`],
    ['coffees', `${'a'.repeat(64)}.png`],
    ['coffees', `${'a'.repeat(63)}.webp`],
    ['..', 'secret.txt']
  ])('404s invalid input %s/%s', async (kind, file) => {
    expect(await status(kind, file)).toBe(404);
  });
});
