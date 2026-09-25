import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { slugify, generateBaseSlug, uniqueSlug, slugExists, isAutoSlug } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Alo Bona Zuria Sidama')).toBe('alo-bona-zuria-sidama');
  });

  it('strips diacritics', () => {
    expect(slugify('Marlon Bolaños')).toBe('marlon-bolanos');
    expect(slugify('San Jerónimo Miramar')).toBe('san-jeronimo-miramar');
  });

  it('collapses punctuation and repeated separators into single hyphens', () => {
    expect(slugify('Ethiopia - Kebena Natural Decaf!!')).toBe('ethiopia-kebena-natural-decaf');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Test-  ')).toBe('test');
  });
});

describe('generateBaseSlug', () => {
  it('uses the roast date year when present', () => {
    const slug = generateBaseSlug({
      roaster: 'Lume',
      coffeeName: 'Alo Bona Zuria Sidama',
      roastDate: '2026-07-07',
      createdAt: '2027-01-01T00:00:00.000Z'
    });
    expect(slug).toBe('2026-lume-alo-bona-zuria-sidama');
  });

  it('falls back to the created-at year when there is no roast date', () => {
    const slug = generateBaseSlug({
      roaster: 'Lume',
      coffeeName: 'Alo Bona Zuria Sidama',
      roastDate: null,
      createdAt: '2027-03-15T00:00:00.000Z'
    });
    expect(slug).toBe('2027-lume-alo-bona-zuria-sidama');
  });
});

describe('uniqueSlug / slugExists', () => {
  it('returns the base slug when nothing collides', () => {
    const db = createDb(':memory:');
    expect(uniqueSlug(db, '2026-lume-alo-bona-zuria-sidama')).toBe('2026-lume-alo-bona-zuria-sidama');
  });

  it('appends -2, -3 on collisions', () => {
    const db = createDb(':memory:');
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
       VALUES ('Lume', 'A', '2026-lume-alo', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    db.exec(
      `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
       VALUES ('Lume', 'B', '2026-lume-alo-2', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
    );
    expect(uniqueSlug(db, '2026-lume-alo')).toBe('2026-lume-alo-3');
  });

  it('slugExists excludes the given id', () => {
    const db = createDb(':memory:');
    const result = db
      .prepare(
        `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
         VALUES ('Lume', 'A', 'taken-slug', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
      )
      .run();
    const id = Number(result.lastInsertRowid);
    expect(slugExists(db, 'taken-slug')).toBe(true);
    expect(slugExists(db, 'taken-slug', id)).toBe(false);
  });

  it("treats old (redirecting) slugs as taken, except for the coffee they belong to", () => {
    const db = createDb(':memory:');
    const id = Number(
      db
        .prepare(
          `INSERT INTO coffees (roaster, coffee_name, slug, status, created_at, updated_at)
           VALUES ('Lume', 'A', 'current', 'backlog', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
        )
        .run().lastInsertRowid
    );
    db.prepare(`INSERT INTO slug_redirects (old_slug, coffee_id) VALUES ('old', ?)`).run(id);
    expect(slugExists(db, 'old')).toBe(true);
    expect(slugExists(db, 'old', id)).toBe(false);
    expect(uniqueSlug(db, 'old')).toBe('old-2');
  });
});

describe('isAutoSlug', () => {
  it('is true for the exact base slug', () => {
    expect(isAutoSlug('2026-lume-alo', '2026-lume-alo')).toBe(true);
  });

  it('is true for the base slug with a numeric collision suffix >= 2 ("auto-2")', () => {
    expect(isAutoSlug('2026-lume-alo-2', '2026-lume-alo')).toBe(true);
    expect(isAutoSlug('2026-lume-alo-13', '2026-lume-alo')).toBe(true);
  });

  it('is false for a slug the user typed themselves ("custom")', () => {
    expect(isAutoSlug('my-favorite-kenya', '2026-lume-alo')).toBe(false);
    // Looks close to the base but isn't the auto-suffix pattern.
    expect(isAutoSlug('2026-lume-alo-decaf', '2026-lume-alo')).toBe(false);
    expect(isAutoSlug('2026-lume-alo-1', '2026-lume-alo')).toBe(false);
  });
});
