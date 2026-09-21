import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  requireAdmin
} from './auth';

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password against its own hash', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different salt (and hash) each call', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(verifyPassword('same-password', a)).toBe(true);
    expect(verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});

describe('session cookie signing', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-session-secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('SESSION_COOKIE_NAME is bt_session', () => {
    expect(SESSION_COOKIE_NAME).toBe('bt_session');
  });

  it('accepts a freshly created cookie value', () => {
    const value = createSessionCookieValue();
    expect(verifySessionCookieValue(value)).toBe(true);
  });

  it('rejects a tampered HMAC', () => {
    const value = createSessionCookieValue();
    const [expiresAt] = value.split('.');
    const tampered = `${expiresAt}.0000000000000000000000000000000000000000000000000000000000000000`;
    expect(verifySessionCookieValue(tampered)).toBe(false);
  });

  it('rejects an expired timestamp even with a valid signature', () => {
    const expired = signSessionExpiry(new Date(Date.now() - 1000).toISOString());
    expect(verifySessionCookieValue(expired)).toBe(false);
  });

  it('rejects a value signed with a different secret', () => {
    const value = createSessionCookieValue();
    vi.stubEnv('SESSION_SECRET', 'a-different-secret');
    expect(verifySessionCookieValue(value)).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(verifySessionCookieValue('not-a-real-cookie-value')).toBe(false);
  });

  it('defaults to the standard session duration', () => {
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

  it('accepts a custom duration for a "remembered" session', () => {
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
  it('does not throw when isAdmin is true', () => {
    expect(() => requireAdmin({ isAdmin: true })).not.toThrow();
  });

  it('throws a 401 HttpError when isAdmin is false', () => {
    try {
      requireAdmin({ isAdmin: false });
      expect.unreachable('requireAdmin should have thrown');
    } catch (err) {
      expect((err as { status: number }).status).toBe(401);
    }
  });
});
