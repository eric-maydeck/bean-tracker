import { scryptSync, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;
  const stored = Buffer.from(hashHex, 'hex');
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export const SESSION_COOKIE_NAME = 'bt_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return secret;
}

// Exported so tests can build a validly-signed cookie with an arbitrary
// (e.g. already-expired) timestamp without duplicating the HMAC logic.
export function signSessionExpiry(expiresAtIso: string): string {
  const hmac = createHmac('sha256', getSessionSecret()).update(expiresAtIso).digest('hex');
  return `${expiresAtIso}.${hmac}`;
}

export function createSessionCookieValue(): string {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  return signSessionExpiry(expiresAt);
}

export function verifySessionCookieValue(value: string): boolean {
  // The ISO timestamp itself contains a '.' (before the milliseconds), so
  // split on the LAST '.' — the hex HMAC never contains one, making it the
  // one reliable separator.
  const separatorIndex = value.lastIndexOf('.');
  if (separatorIndex === -1) return false;
  const expiresAt = value.slice(0, separatorIndex);
  const hmac = value.slice(separatorIndex + 1);

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(createHmac('sha256', getSessionSecret()).update(expiresAt).digest('hex'), 'hex');
    actual = Buffer.from(hmac, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== actual.length || expected.length === 0) return false;
  if (!timingSafeEqual(expected, actual)) return false;

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) return false;
  return Date.now() < expiresAtMs;
}

export function requireAdmin(locals: App.Locals): void {
  if (!locals.isAdmin) {
    error(401, 'Unauthorized');
  }
}
