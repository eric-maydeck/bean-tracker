import { verifyPassword } from './auth';

// Trustworthy only because bean-tracker's container has no host port
// mapping — the proxy is the only thing that can reach it directly, and
// The proxy sets this header reliably on proxied traffic (see
// docs/superpowers/specs/2026-09-19-public-access-design.md,
// Decision 7/8). Falls back to the direct socket address for local dev
// (`npm run dev`), where there is no proxy hop at all, and for the
// (theoretical) case of an empty/whitespace-only header value.
export function resolveClientIp(request: Request, getClientAddress: () => string): string {
  const header = request.headers.get('cf-connecting-ip');
  if (header && header.trim() !== '') return header.trim();
  return getClientAddress();
}

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
