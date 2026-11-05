import { describe, it, expect } from 'vitest';
import { resolveDisplayZone } from './displayZone';

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
