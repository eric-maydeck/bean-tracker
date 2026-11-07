import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DB_PATH = ':memory:';
const dir = mkdtempSync(join(tmpdir(), 'layout-'));
const cfg = join(dir, 'c.yaml');
writeFileSync(cfg, `hosts:
  - domain: a.test
    contactName: A
    contactEmail: hi@a.test
  - domain: b.test
    contactName: B
`);
process.env.CONFIG_PATH = cfg;

const { load } = await import('./+layout.server');
const { resetSiteConfig } = await import('$lib/server/siteConfig');

const siteOf = async (host: string) => {
  const r = (await (load as any)({ locals: { isAdmin: false }, url: new URL(`https://${host}/`), cookies: { get: () => undefined } })) as { site: unknown };
  return r.site;
};

describe('root layout load: site', () => {
  beforeEach(resetSiteConfig);
  it('returns siteFor for the request host, including the email when listed', async () =>
    expect(await siteOf('a.test')).toEqual({ contactName: 'A', contactEmail: 'hi@a.test', canonical: 'https://a.test' }));
  it('a listed host without contactEmail yields null (no email line)', async () =>
    expect(await siteOf('b.test')).toEqual({ contactName: 'B', contactEmail: null, canonical: 'https://a.test' }));
});

describe('AiNote footer', () => {
  it('the separator before Contact lives inside the {#if email} block', () => {
    const src = readFileSync('src/lib/components/AiNote.svelte', 'utf8');
    expect(src).toMatch(/\{#if email\}<span class="d keep"[^>]*>[^<]*<\/span>\{\/if\}/);
    expect(src).toMatch(/\{#if email\}<span class="fi lk"><a href="mailto:/);
  });
});
