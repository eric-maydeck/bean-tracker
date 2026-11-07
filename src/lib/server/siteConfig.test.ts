import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSiteConfig, parseSiteConfig, resetSiteConfig, siteFor } from './siteConfig';

const CFG = parseSiteConfig(`hosts:
  - domain: first.test
    contactName: First
    contactEmail: hi@first.test
  - domain: second.example
    contactName: Second
`, 'test.yaml');

describe('siteFor', () => {
  it('matches host case-insensitively, ignoring port, trailing dot, subdomains', () => {
    for (const h of ['second.example', 'WWW.Second.Example:443', 'a.b.second.example.', 'second.example.:8080'])
      expect(siteFor(h, CFG)).toEqual({ contactName: 'Second', contactEmail: null, canonical: 'https://first.test' });
  });
  it('falls back to hosts[0] for unlisted hosts', () => {
    for (const h of ['notsecond.example', 'second.example.evil.com', '192.0.2.5:5199', 'localhost:5173', '[::1]:5173', ''])
      expect(siteFor(h, CFG).contactName).toBe('First');
  });
  it('no config: generic name, no email, no canonical', () =>
    expect(siteFor('x.test', { hosts: [], imageSuggest: {}, tavily: {} })).toEqual({ contactName: 'Bean Tracker', contactEmail: null, canonical: null }));
});

describe('parseSiteConfig', () => {
  it.each([['hosts: {}', 'hosts'], ['hosts:\n  - contactName: x', 'hosts[0].domain'], ['bogus: 1', 'bogus'], ['hosts: [', 'test.yaml'],
    ['tavily:\n  monthlyLimit: 0', 'tavily.monthlyLimit'], ['tavily:\n  monthlyLimit: 1.5', 'tavily.monthlyLimit']])(
    'rejects %j naming %s', (text, key) => expect(() => parseSiteConfig(text, 'test.yaml')).toThrow(key));
  it('empty text is an empty config; optional sections parse', () => {
    expect(parseSiteConfig('', 't')).toEqual({ hosts: [], imageSuggest: {}, tavily: {} });
    expect(parseSiteConfig('imageSuggest:\n  providers: a,b\ntavily:\n  monthlyLimit: 900', 't'))
      .toEqual({ hosts: [], imageSuggest: { providers: 'a,b' }, tavily: { monthlyLimit: 900 } });
  });
});

describe('loadSiteConfig', () => {
  beforeEach(resetSiteConfig);
  it('explicit missing CONFIG_PATH throws with the path', () =>
    expect(() => loadSiteConfig({ CONFIG_PATH: '/nope/x.yaml' })).toThrow('/nope/x.yaml'));
  it('default missing file gives empty config', () => {
    const cwd = process.cwd();
    process.chdir(mkdtempSync(join(tmpdir(), 'cfg-')));
    try {
      expect(loadSiteConfig({})).toEqual({ hosts: [], imageSuggest: {}, tavily: {} });
    } finally {
      process.chdir(cwd);
    }
  });
  it('reads a temp file and caches it', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'c.yaml');
    writeFileSync(p, 'hosts:\n  - domain: a.test\n');
    expect(loadSiteConfig({ CONFIG_PATH: p }).hosts).toEqual([{ domain: 'a.test' }]);
    expect(loadSiteConfig({})).toBe(loadSiteConfig({ CONFIG_PATH: p }));
  });
});
