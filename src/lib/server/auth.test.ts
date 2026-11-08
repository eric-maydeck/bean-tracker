import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scryptSync } from 'node:crypto';
import { error } from '@sveltejs/kit';
import {
  hashPassword,
  verifyPassword,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  REMEMBERED_SESSION_DURATION_MS,
  signSessionExpiry,
  createSessionCookieValue,
  verifySessionCookieValue,
  requireAdmin,
  safeRedirectTarget
} from './auth';

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password against its own hash', async () => {
    const hash = hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different salt (and hash) each call', async () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});

describe('session cookie signing', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-session-secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('SESSION_COOKIE_NAME is bt_session', async () => {
    expect(SESSION_COOKIE_NAME).toBe('bt_session');
  });

  it('accepts a freshly created cookie value', async () => {
    const value = createSessionCookieValue();
    expect(verifySessionCookieValue(value)).toBe(true);
  });

  it('rejects a tampered HMAC', async () => {
    const value = createSessionCookieValue();
    const [expiresAt] = value.split('.');
    const tampered = `${expiresAt}.0000000000000000000000000000000000000000000000000000000000000000`;
    expect(verifySessionCookieValue(tampered)).toBe(false);
  });

  it('rejects an expired timestamp even with a valid signature', async () => {
    const expired = signSessionExpiry(new Date(Date.now() - 1000).toISOString());
    expect(verifySessionCookieValue(expired)).toBe(false);
  });

  it('rejects a value signed with a different secret', async () => {
    const value = createSessionCookieValue();
    vi.stubEnv('SESSION_SECRET', 'a-different-secret');
    expect(verifySessionCookieValue(value)).toBe(false);
  });

  it('rejects garbage input', async () => {
    expect(verifySessionCookieValue('not-a-real-cookie-value')).toBe(false);
  });

  it('defaults to the standard session duration', async () => {
    const before = Date.now();
    const value = createSessionCookieValue();
    const after = Date.now();
    // Split on the LAST '.' — the ISO timestamp itself contains one before
    // the milliseconds, so split('.')[0] truncates off "Z" and parses as
    // local time instead of UTC. See verifySessionCookieValue's own comment.
    const expiresAt = value.slice(0, value.lastIndexOf('.'));
    const expiresAtMs = Date.parse(expiresAt);
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + SESSION_DURATION_MS);
    expect(expiresAtMs).toBeLessThanOrEqual(after + SESSION_DURATION_MS);
  });

  it('accepts a custom duration for a "remembered" session', async () => {
    const before = Date.now();
    const value = createSessionCookieValue(REMEMBERED_SESSION_DURATION_MS);
    const after = Date.now();
    const expiresAt = value.slice(0, value.lastIndexOf('.'));
    const expiresAtMs = Date.parse(expiresAt);
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + REMEMBERED_SESSION_DURATION_MS);
    expect(expiresAtMs).toBeLessThanOrEqual(after + REMEMBERED_SESSION_DURATION_MS);
    expect(verifySessionCookieValue(value)).toBe(true);
  });
});

describe('requireAdmin', () => {
  it('does not throw when isAdmin is true', async () => {
    expect(() => requireAdmin({ isAdmin: true })).not.toThrow();
  });

  it('throws a 401 HttpError when isAdmin is false', async () => {
    try {
      requireAdmin({ isAdmin: false });
      expect.unreachable('requireAdmin should have thrown');
    } catch (err) {
      expect((err as { status: number }).status).toBe(401);
    }
  });
});

describe('safeRedirectTarget', () => {
  it('keeps a same-site path with its query and hash', async () => {
    expect(safeRedirectTarget('/coffees/ethiopia-guji?tab=bc#notes')).toBe('/coffees/ethiopia-guji?tab=bc#notes');
    expect(safeRedirectTarget('/stats')).toBe('/stats');
  });

  it('falls back to /coffees for anything off-site, empty or malformed', async () => {
    for (const bad of [
      null, '', 'coffees', '//evil.com', '///evil.com', 'https://evil.com', '/\\evil.com',
      '\\evil.com', 'javascript:alert(1)', ' /stats', '/%0a/evil.com'.replace('%0a', '\n')
    ]) {
      expect(safeRedirectTarget(bad), String(bad)).toBe('/coffees');
    }
  });

  it('never sends you back to /login', async () => {
    expect(safeRedirectTarget('/login')).toBe('/coffees');
    expect(safeRedirectTarget('/login?redirectTo=/stats')).toBe('/coffees');
  });
});

describe('verifyPassword compatibility', () => {
  it('still verifies a hash in the stored salt:scrypt(64) format made by the sync implementation', async () => {
    // Same construction hashPassword has always used; ADMIN_PASSWORD_HASH values in the wild look like this.
    const salt = '00112233445566778899aabbccddeeff';
    const stored = `${salt}:${scryptSync('legacy-pw', salt, 64).toString('hex')}`;
    expect(await verifyPassword('legacy-pw', stored)).toBe(true);
    expect(await verifyPassword('other', stored)).toBe(false);
  });
});
