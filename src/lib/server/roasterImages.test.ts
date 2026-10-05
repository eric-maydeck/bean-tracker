import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { setRoasterImage, getRoasterImage, getRoasterImages } from './roasterImages';

let db: DatabaseSync;
beforeEach(() => {
  db = createDb(':memory:');
});

describe('roaster images', () => {
  it('returns null for a roaster with no default', () => {
    expect(getRoasterImage(db, 'Norml')).toBeNull();
    expect(getRoasterImages(db)).toEqual({});
  });

  it('upserts: a second set replaces the first', () => {
    setRoasterImage(db, 'Norml', 'https://img.example/a.png');
    setRoasterImage(db, 'Norml', 'https://img.example/b.png');
    expect(getRoasterImage(db, 'Norml')).toBe('https://img.example/b.png');
    expect(getRoasterImages(db)).toEqual({ Norml: 'https://img.example/b.png' });
  });

  it('matches the roaster case-insensitively and keeps the first stored name', () => {
    setRoasterImage(db, 'Norml', 'https://img.example/a.png');
    setRoasterImage(db, 'NORML', 'https://img.example/b.png');
    expect(getRoasterImage(db, 'norml')).toBe('https://img.example/b.png');
    expect(getRoasterImages(db)).toEqual({ Norml: 'https://img.example/b.png' });
  });

  it('trims the roaster and the URL before writing and the roaster before reading', () => {
    setRoasterImage(db, '  Norml ', ' https://img.example/a.png  ');
    expect(getRoasterImages(db)).toEqual({ Norml: 'https://img.example/a.png' });
    expect(getRoasterImage(db, ' norml ')).toBe('https://img.example/a.png');
  });
});
