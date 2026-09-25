import { describe, it, expect } from 'vitest';
import { isBlockedAddress, checkUrl, safeFetch, FillError } from './productFetch';

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
