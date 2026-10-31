import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGoCache, goTarget } from './goLink';

const url = 'https://shop.com/p';
const site = 'https://roaster.coffee';
const status = (n: number) => async () => n;
beforeEach(() => {
  clearGoCache();
  vi.useRealTimers();
});

describe('goTarget', () => {
  it('200 goes to the url', async () => expect(await goTarget(url, site, status(200))).toBe(url));
  it('404 and 410 go to the roaster site', async () => {
    expect(await goTarget(url, site, status(404))).toBe(site);
    clearGoCache();
    expect(await goTarget(url, site, status(410))).toBe(site);
  });
  it('bot-protection and other 4xx still go to the url', async () => {
    for (const n of [401, 403, 429, 451]) {
      clearGoCache();
      expect(await goTarget(url, site, status(n))).toBe(url);
    }
  });
  it('404 with no site still goes to the url', async () => expect(await goTarget(url, null, status(404))).toBe(url));
  it('5xx goes to the url', async () => expect(await goTarget(url, site, status(503))).toBe(url));
  it('a thrown error (timeout, network) goes to the url and is not cached', async () => {
    const check = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(404);
    expect(await goTarget(url, site, check)).toBe(url);
    expect(await goTarget(url, site, check)).toBe(site);
  });
  it('skips the check when the target is the site itself', async () => {
    expect(await goTarget(site, site, status(404))).toBe(site);
  });
  it('caches the verdict per url for 10 minutes', async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValue(404);
    expect(await goTarget(url, site, check)).toBe(site);
    expect(await goTarget(url, site, check)).toBe(site);
    expect(check).toHaveBeenCalledTimes(1);
    expect(await goTarget('https://shop.com/other', site, check)).toBe(site);
    expect(check).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10 * 60_000 + 1);
    await goTarget(url, site, check);
    expect(check).toHaveBeenCalledTimes(3);
  });
});
