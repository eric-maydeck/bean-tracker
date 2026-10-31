import { describe, expect, it } from 'vitest';
import { goTarget } from './goLink';

const url = 'https://shop.com/p';
const site = 'https://roaster.coffee';
const status = (n: number) => async () => n;

describe('goTarget', () => {
  it('200 goes to the url', async () => expect(await goTarget(url, site, status(200))).toBe(url));
  it('4xx goes to the roaster site', async () => {
    expect(await goTarget(url, site, status(404))).toBe(site);
    expect(await goTarget(url, site, status(410))).toBe(site);
  });
  it('4xx with no site still goes to the url', async () => expect(await goTarget(url, null, status(404))).toBe(url));
  it('5xx goes to the url', async () => expect(await goTarget(url, site, status(503))).toBe(url));
  it('a thrown error (timeout, network) goes to the url', async () => {
    expect(await goTarget(url, site, async () => { throw new Error('timeout'); })).toBe(url);
  });
  it('skips the check when the target is the site itself', async () => {
    expect(await goTarget(site, site, status(404))).toBe(site);
  });
});
