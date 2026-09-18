import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { error } from '@sveltejs/kit';
import {
  hashPassword,
  verifyPassword,
  SESSION_COOKIE_NAME,
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
