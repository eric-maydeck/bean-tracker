import { describe, it, expect } from 'vitest';
import { canonicalZone, resolveDisplayZone } from './displayZone';

describe('resolveDisplayZone', () => {
  it("signed out ignores the owner's setting", () =>
    expect(resolveDisplayZone({ signedIn: false, setting: 'Asia/Tokyo', cookie: 'Europe/Paris' })).toEqual({ zone: 'Europe/Paris', browser: true }));
  it("'browser' with no cookie is UTC, resolved by the browser", () =>
    expect(resolveDisplayZone({ signedIn: true, setting: 'browser', cookie: null })).toEqual({ zone: 'UTC', browser: true }));
  it("'browser' with a cookie uses it", () =>
    expect(resolveDisplayZone({ signedIn: true, setting: 'browser', cookie: 'Asia/Tokyo' })).toEqual({ zone: 'Asia/Tokyo', browser: true }));
  it('a fixed setting wins for the signed-in owner', () =>
    expect(resolveDisplayZone({ signedIn: true, setting: 'Asia/Tokyo', cookie: 'Europe/Paris' })).toEqual({ zone: 'Asia/Tokyo', browser: false }));
  it('a bad cookie is UTC', () =>
    expect(resolveDisplayZone({ signedIn: false, setting: 'browser', cookie: 'Mars/Base' })).toEqual({ zone: 'UTC', browser: true }));
  it('a bad stored setting falls back like browser', () =>
    expect(resolveDisplayZone({ signedIn: true, setting: 'Mars/Base', cookie: null })).toEqual({ zone: 'UTC', browser: true }));
});

describe('canonicalZone', () => {
  it('accepts IANA aliases and canonicalizes them', () => {
    for (const z of ['Asia/Kolkata', 'Europe/Kyiv', 'Etc/UTC', 'asia/tokyo', 'UTC']) expect(canonicalZone(z), z).toEqual(expect.any(String));
    expect(canonicalZone('asia/tokyo')).toBe('Asia/Tokyo');
    expect(['Asia/Kolkata', 'Asia/Calcutta']).toContain(canonicalZone('Asia/Kolkata'));
  });
  it('rejects junk and fixed offsets', () => {
    for (const z of ['Mars/Base', '', 'browser', '+09:00']) expect(canonicalZone(z), z).toBeNull();
  });
  it('an alias works as a cookie or a fixed setting', () => {
    expect(resolveDisplayZone({ signedIn: false, setting: 'browser', cookie: 'Europe/Kyiv' }).zone).toBe(canonicalZone('Europe/Kyiv'));
    expect(resolveDisplayZone({ signedIn: true, setting: 'Asia/Kolkata', cookie: null })).toEqual({ zone: canonicalZone('Asia/Kolkata'), browser: false });
  });
});
