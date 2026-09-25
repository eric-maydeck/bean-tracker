import { describe, it, expect, vi, afterEach } from 'vitest';
import { isBlockedAddress, checkUrl, safeFetch, FillError, shopifyJsonUrl, sanitizeShopifyMeta } from './productFetch';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::5', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:192.168.0.1',
    '::7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', 'fec0::1',
    'not-an-ip'
  ])('blocks %s', (addr) => {
    expect(isBlockedAddress(addr)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '23.227.38.65', '2606:4700::1111', '2a00:1450:4001::200e', '::ffff:8.8.8.8'])(
    'allows public %s',
    (addr) => {
      expect(isBlockedAddress(addr)).toBe(false);
    }
  );
});

describe('checkUrl', () => {
  it('accepts http and https URLs with public or named hosts', () => {
    expect(checkUrl('https://shoebox.coffee/products/x').hostname).toBe('shoebox.coffee');
    expect(checkUrl('http://8.8.8.8/').hostname).toBe('8.8.8.8');
  });

  it.each(['ftp://example.com/x', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])('refuses %s', (url) => {
    expect(() => checkUrl(url)).toThrow(FillError);
  });

  it.each(['http://127.0.0.1/', 'http://[::1]:5173/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://192.168.1.1/admin'])(
    'refuses private/loopback literal %s',
    (url) => {
      expect(() => checkUrl(url)).toThrow(FillError);
    }
  );
});

describe('safeFetch', () => {
  it('refuses a hostname that resolves to loopback (checked in the socket lookup, no network needed)', async () => {
    await expect(safeFetch('http://localhost:1/')).rejects.toBeInstanceOf(FillError);
  });
});

describe('sanitizeShopifyMeta', () => {
  it('keeps name/currency only when they are strings, and null for a non-object', () => {
    expect(sanitizeShopifyMeta({ name: 'Shoebox', currency: 'USD' })).toEqual({ name: 'Shoebox', currency: 'USD' });
    expect(sanitizeShopifyMeta({ name: 123, currency: null })).toEqual({ name: undefined, currency: undefined });
    expect(sanitizeShopifyMeta('not an object')).toBeNull();
    expect(sanitizeShopifyMeta(null)).toBeNull();
  });
});

describe('shopifyJsonUrl', () => {
  it('builds <path>.json from the path only, dropping query/hash and trailing slash', () => {
    expect(shopifyJsonUrl(new URL('https://h.coffee/products/burundi-mikuba-8?variant=41634028912698#x'))).toBe(
      'https://h.coffee/products/burundi-mikuba-8.json'
    );
    expect(shopifyJsonUrl(new URL('https://h.coffee/collections/coffee/products/abc/'))).toBe(
      'https://h.coffee/collections/coffee/products/abc.json'
    );
    expect(shopifyJsonUrl(new URL('https://h.coffee/en-us/products/abc.json'))).toBe('https://h.coffee/en-us/products/abc.json');
  });

  it('returns null for non-Shopify product paths and listing pages', () => {
    expect(shopifyJsonUrl(new URL('https://xliiicoffee.com/en/product/kinini/'))).toBeNull();
    expect(shopifyJsonUrl(new URL('https://h.coffee/collections/all'))).toBeNull();
    expect(shopifyJsonUrl(new URL('https://h.coffee/products'))).toBeNull();
    expect(shopifyJsonUrl(new URL('https://h.coffee/'))).toBeNull();
  });
});

describe('getUsdRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const ok = { result: 'success', time_last_update_unix: 1790294400, rates: { USD: 1, GBP: 0.79 } };

  it('fetches open.er-api.com once and serves from cache for 24h', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ok)));
    vi.stubGlobal('fetch', fetchMock);
    const { getUsdRates } = await import('./productFetch');
    const first = await getUsdRates(0);
    expect(first.rates.GBP).toBe(0.79);
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.er-api.com/v6/latest/USD');
    await getUsdRates(23 * 3600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getUsdRates(25 * 3600_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on failure and does not cache the failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ result: 'error' }))));
    const { getUsdRates } = await import('./productFetch');
    await expect(getUsdRates(0)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ok))));
    await expect(getUsdRates(1)).resolves.toMatchObject({ rates: { GBP: 0.79 } });
  });
});
