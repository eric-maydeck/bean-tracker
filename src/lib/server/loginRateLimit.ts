import { verifyPassword } from './auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

export function isLockedOut(ip: string): boolean {
  const record = attempts.get(ip);
  if (!record?.lockedUntil) return false;
  if (Date.now() >= record.lockedUntil) {
    attempts.delete(ip);
    return false;
  }
  return true;
}

export function recordFailedAttempt(ip: string): void {
  const record = attempts.get(ip) ?? { failures: 0, lockedUntil: null };
  record.failures += 1;
  if (record.failures >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  attempts.set(ip, record);
}

export function recordSuccessfulAttempt(ip: string): void {
  attempts.delete(ip);
}

export type LoginAttemptResult = { ok: true } | { ok: false; reason: 'locked' | 'invalid' };

export function attemptLogin(
  ip: string,
  password: string,
  storedHash: string | undefined
): LoginAttemptResult {
  if (isLockedOut(ip)) {
    return { ok: false, reason: 'locked' };
  }
  if (!storedHash || !password || !verifyPassword(password, storedHash)) {
    recordFailedAttempt(ip);
    return { ok: false, reason: 'invalid' };
  }
  recordSuccessfulAttempt(ip);
  return { ok: true };
}

// Test-only: clears all rate-limit state so cases in loginRateLimit.test.ts
// don't bleed into each other via this shared module-level Map.
export function _resetForTests(): void {
  attempts.clear();
}
