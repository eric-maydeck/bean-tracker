import { verifyPassword } from './auth';

// Trustworthy only when the app is reachable solely through a proxy that sets
// cf-connecting-ip (no direct host port). Falls back to the direct socket
// address for local dev (`npm run dev`), where there is no proxy hop, and for
// the (theoretical) case of an empty/whitespace-only header value.
export function resolveClientIp(request: Request, getClientAddress: () => string): string {
  const header = request.headers.get('cf-connecting-ip');
  if (header && header.trim() !== '') return header.trim();
  return getClientAddress();
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
// A burst of failures only counts toward a lockout if they land within this
// window of the first one; an isolated failure long after a prior burst
// shouldn't carry that burst's count into a fresh one.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
  firstFailureAt: number;
}

const attempts = new Map<string, AttemptRecord>();

// All password checks (login, /api/me, upload) share this cap on top of the per-IP
// lockouts, so rotating IPs cannot grind scrypt forever. Fixed window.
// ponytail: an attacker can trip it to lock the admin out for the window; fine for one admin.
const GLOBAL_MAX_FAILURES = 50;
const GLOBAL_WINDOW_MS = 15 * 60 * 1000;
let globalFailures = 0;
let globalWindowStart = 0;

function globallyLocked(now: number): boolean {
  if (now - globalWindowStart >= GLOBAL_WINDOW_MS) {
    globalFailures = 0;
    return false;
  }
  return globalFailures >= GLOBAL_MAX_FAILURES;
}

export function isLockedOut(ip: string): boolean {
  if (globallyLocked(Date.now())) return true;
  const record = attempts.get(ip);
  if (!record?.lockedUntil) return false;
  if (Date.now() >= record.lockedUntil) {
    attempts.delete(ip);
    return false;
  }
  return true;
}

// ponytail: O(n) sweep over every tracked IP on each failed attempt. Fine
// at this app's scale (a single admin login endpoint); switch to a
// scheduled sweep or an LRU cap if this map's cardinality ever grows large.
function pruneExpired(now: number): void {
  for (const [ip, record] of attempts) {
    const lockoutExpired = record.lockedUntil !== null && now >= record.lockedUntil;
    const windowElapsed = record.lockedUntil === null && now - record.firstFailureAt > FAILURE_WINDOW_MS;
    if (lockoutExpired || windowElapsed) attempts.delete(ip);
  }
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  if (globalFailures === 0 || now - globalWindowStart >= GLOBAL_WINDOW_MS) {
    globalFailures = 0;
    globalWindowStart = now;
  }
  globalFailures += 1;
  pruneExpired(now);
  const record = attempts.get(ip);
  if (record) {
    record.failures += 1;
    if (record.failures >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
    }
    attempts.set(ip, record);
  } else {
    attempts.set(ip, { failures: 1, lockedUntil: null, firstFailureAt: now });
  }
}

export function recordSuccessfulAttempt(ip: string): void {
  attempts.delete(ip);
}

export type LoginAttemptResult = { ok: true } | { ok: false; reason: 'locked' | 'invalid' };

// scrypt runs on the libuv pool; more than this many at once would starve everything else.
const MAX_IN_FLIGHT = 4;
let inFlight = 0;

// The one place a password check is rate-limited. The attempt is counted as a failure
// BEFORE the await (so a parallel burst cannot all pass the lock check) and rolled back on
// success; checks beyond MAX_IN_FLIGHT are refused as locked without hashing.
export async function guardedCheck(key: string, check: () => Promise<boolean>): Promise<LoginAttemptResult> {
  if (isLockedOut(key) || inFlight >= MAX_IN_FLIGHT) return { ok: false, reason: 'locked' };
  recordFailedAttempt(key);
  inFlight++;
  let ok = false;
  try {
    ok = await check();
  } finally {
    inFlight--;
  }
  if (!ok) return { ok: false, reason: 'invalid' };
  recordSuccessfulAttempt(key);
  globalFailures = Math.max(0, globalFailures - 1);
  return { ok: true };
}

export const attemptLogin = (ip: string, password: string, storedHash: string | undefined) =>
  guardedCheck(ip, async () => !!storedHash && !!password && (await verifyPassword(password, storedHash)));

// Test-only: clears all rate-limit state so cases in loginRateLimit.test.ts
// don't bleed into each other via this shared module-level Map.
export function _resetForTests(): void {
  attempts.clear();
  globalFailures = 0;
  globalWindowStart = 0;
  inFlight = 0;
}
