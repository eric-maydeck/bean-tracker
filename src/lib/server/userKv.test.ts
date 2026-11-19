import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { getUserKv, setUserKv } from './userKv';

describe('userKv', () => {
  it('round-trips an object and overwrites on a second set', () => {
    const db = createDb(':memory:');
    setUserKv(db, 'admin', 'k', { a: 1 });
    expect(getUserKv(db, 'admin', 'k')).toEqual({ a: 1 });
    setUserKv(db, 'admin', 'k', { a: 2 });
    expect(getUserKv(db, 'admin', 'k')).toEqual({ a: 2 });
  });
  it('keeps users separate', () => {
    const db = createDb(':memory:');
    setUserKv(db, 'admin', 'k', 1);
    setUserKv(db, 'other', 'k', 2);
    expect(getUserKv(db, 'admin', 'k')).toBe(1);
    expect(getUserKv(db, 'other', 'k')).toBe(2);
  });
  it('returns null for a missing key', () => {
    expect(getUserKv(createDb(':memory:'), 'admin', 'nope')).toBeNull();
  });
  it('returns null for a non-JSON value', () => {
    const db = createDb(':memory:');
    db.prepare(`INSERT INTO user_kv (user_id, key, value, updated_at) VALUES ('admin','k','{bad','x')`).run();
    expect(getUserKv(db, 'admin', 'k')).toBeNull();
  });
});
