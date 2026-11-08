import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hashPassword } from './auth';
import {
  isLockedOut,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  attemptLogin,
  guardedCheck,
  resolveClientIp,
  _resetForTests
} from './loginRateLimit';

beforeEach(() => {
  _resetForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isLockedOut / recordFailedAttempt / recordSuccessfulAttempt', () => {
  it('is not locked out with no prior attempts', async () => {
    expect(isLockedOut('1.2.3.4')).toBe(false);
  });

  it('locks out after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('1.2.3.4')).toBe(true);
  });

  it('does not lock out after only 4 failed attempts', async () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('1.2.3.4')).toBe(false);
  });

  it('tracks IPs independently', async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('5.6.7.8')).toBe(false);
  });

  it('a successful attempt resets the failure count', async () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt('1.2.3.4');
    recordSuccessfulAttempt('1.2.3.4');
    recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('1.2.3.4')).toBe(false);
  });

  it('lifts the lockout once the 15-minute backoff window elapses', async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('1.2.3.4')).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isLockedOut('1.2.3.4')).toBe(false);
  });

  it('restarts the failure count once the failure window elapses without reaching lockout', async () => {
    for (let i = 0; i < 3; i++) recordFailedAttempt('1.2.3.4');
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    recordFailedAttempt('1.2.3.4'); // count restarts at 1, not 4
    for (let i = 0; i < 3; i++) recordFailedAttempt('1.2.3.4'); // 4 total since restart
    expect(isLockedOut('1.2.3.4')).toBe(false);
    recordFailedAttempt('1.2.3.4'); // 5th since restart
    expect(isLockedOut('1.2.3.4')).toBe(true);
  });

  it('does not immediately re-lock on one failure after an expired lockout, without a prior isLockedOut check', () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('1.2.3.4');
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    recordFailedAttempt('1.2.3.4');
    expect(isLockedOut('1.2.3.4')).toBe(false);
  });
});

describe('attemptLogin', () => {
  const hash = hashPassword('correct-password');

  it('succeeds with the correct password', async () => {
    expect(await attemptLogin('9.9.9.9', 'correct-password', hash)).toEqual({ ok: true });
  });

  it('fails with reason "invalid" on an incorrect password, and records a failure', async () => {
    expect(await attemptLogin('9.9.9.9', 'wrong-password', hash)).toEqual({
      ok: false,
      reason: 'invalid'
    });
    expect(await attemptLogin('9.9.9.9', 'wrong-password', hash)).toEqual({
      ok: false,
      reason: 'invalid'
    });
    for (let i = 0; i < 3; i++) await attemptLogin('9.9.9.9', 'wrong-password', hash);
    expect(isLockedOut('9.9.9.9')).toBe(true);
  });

  it('fails with reason "locked" once locked out, without needing a correct password check', async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt('9.9.9.9');
    expect(await attemptLogin('9.9.9.9', 'correct-password', hash)).toEqual({
      ok: false,
      reason: 'locked'
    });
  });

  it('treats a missing stored hash as invalid rather than throwing', async () => {
    expect(await attemptLogin('9.9.9.9', 'anything', undefined)).toEqual({
      ok: false,
      reason: 'invalid'
    });
  });

  it('a successful attempt resets the failure count for that IP', async () => {
    for (let i = 0; i < 4; i++) await attemptLogin('9.9.9.9', 'wrong-password', hash);
    expect(await attemptLogin('9.9.9.9', 'correct-password', hash)).toEqual({ ok: true });
    expect(isLockedOut('9.9.9.9')).toBe(false);
  });
});

describe('global failure cap', () => {
  const hash = hashPassword('correct-password');
  const fail = (n: number) => Array.from({ length: n }, (_, i) => recordFailedAttempt(`ip-${i}`));

  it('refuses every IP after 50 failures across IPs, then recovers when the window rolls', async () => {
    fail(49);
    expect(isLockedOut('fresh-ip')).toBe(false);
    fail(1);
    expect(isLockedOut('fresh-ip')).toBe(true);
    expect(await attemptLogin('fresh-ip', 'correct-password', hash)).toEqual({ ok: false, reason: 'locked' });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isLockedOut('fresh-ip')).toBe(false);
    expect(await attemptLogin('fresh-ip', 'correct-password', hash)).toEqual({ ok: true });
  });
});

describe('concurrent attempts', () => {
  it('20 parallel wrong attempts from one IP: at most 4 reach scrypt at once, at most 5 in total', async () => {
    let running = 0, peak = 0, calls = 0;
    const slow = async () => {
      calls++;
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return false;
    };
    const p = Array.from({ length: 20 }, () => guardedCheck('7.7.7.7', slow));
    await vi.advanceTimersByTimeAsync(50);
    const results = await Promise.all(p);
    expect(peak).toBeLessThanOrEqual(4);
    expect(calls).toBeLessThanOrEqual(4);
    expect(results.filter((r) => !r.ok && r.reason === 'locked').length).toBe(20 - calls);
  });

  it('a success rolls the reservation back', async () => {
    for (let i = 0; i < 4; i++) await guardedCheck('8.8.8.8', async () => false);
    expect(await guardedCheck('8.8.8.8', async () => true)).toEqual({ ok: true });
    for (let i = 0; i < 4; i++) await guardedCheck('8.8.8.8', async () => false);
    expect(isLockedOut('8.8.8.8')).toBe(false);
  });
});

describe('resolveClientIp', () => {
  const getClientAddress = () => '10.0.0.1';

  it('uses the cf-connecting-ip header when present', async () => {
    const request = new Request('http://localhost/login', {
      headers: { 'cf-connecting-ip': '1.2.3.4' }
    });
    expect(resolveClientIp(request, getClientAddress)).toBe('1.2.3.4');
  });

  it('falls back to getClientAddress() when the header is absent', async () => {
    const request = new Request('http://localhost/login');
    expect(resolveClientIp(request, getClientAddress)).toBe('10.0.0.1');
  });

  it('falls back to getClientAddress() when the header is empty or whitespace-only', async () => {
    const emptyHeaderRequest = new Request('http://localhost/login', {
      headers: { 'cf-connecting-ip': '' }
    });
    expect(resolveClientIp(emptyHeaderRequest, getClientAddress)).toBe('10.0.0.1');

    const whitespaceHeaderRequest = new Request('http://localhost/login', {
      headers: { 'cf-connecting-ip': '   ' }
    });
    expect(resolveClientIp(whitespaceHeaderRequest, getClientAddress)).toBe('10.0.0.1');
  });
});
