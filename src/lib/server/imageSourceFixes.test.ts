import { describe, expect, it } from 'vitest';
import { createDb } from './db';
import { createCoffee } from './coffees';
import { applyImageSources } from './imageSourceFixes';
import { IMAGE_SOURCES_2026_10 } from './imageSourceData';

const input = (over: object) => ({
  roaster: 'R', coffee_name: 'C', origin: null, roast_level: null, processing: null, amount_g: null, cost: null,
  roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
  image_url: null, ...over
});
const source = (db: ReturnType<typeof createDb>, id: number) =>
  db.prepare(`SELECT image_source_url s, updated_at u FROM coffees WHERE id = ?`).get(id) as { s: string | null; u: string };

describe('applyImageSources', () => {
  it('fills only matching, empty sources; keeps updated_at; runs once', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, input({ image_url: 'https://x/a.jpg' })).id;
    const b = createCoffee(db, input({ image_url: 'https://x/NEW.jpg' })).id; // image changed since the check
    const c = createCoffee(db, input({ image_url: 'https://x/c.jpg', image_source_url: 'https://own/pick' })).id;
    const d = createCoffee(db, input({ roaster: 'Other', image_url: 'https://x/d.jpg' })).id; // other DB's coffee
    const before = source(db, a).u;
    const rows: [number, string, string, string][] = [
      [a, 'R', 'https://x/a.jpg', 'https://r/p/a'],
      [b, 'R', 'https://x/b.jpg', 'https://r/p/b'],
      [c, 'R', 'https://x/c.jpg', 'https://r/p/c'],
      [d, 'R', 'https://x/d.jpg', 'https://r/p/d']
    ];
    expect(applyImageSources(db, rows, 'm')).toBe(1);
    expect(source(db, a)).toEqual({ s: 'https://r/p/a', u: before });
    expect(source(db, b).s).toBeNull();
    expect(source(db, c).s).toBe('https://own/pick');
    expect(source(db, d).s).toBeNull();
    expect(applyImageSources(db, rows, 'm')).toBeNull();
  });
  it('does nothing on an empty DB and leaves no marker', () => {
    const db = createDb(':memory:');
    expect(applyImageSources(db, [[1, 'R', 'https://x/a.jpg', 'https://r/p']])).toBeNull();
  });
});

describe('IMAGE_SOURCES_2026_10', () => {
  it('has http(s) sources and unique ids', () => {
    expect(new Set(IMAGE_SOURCES_2026_10.map((r) => r[0])).size).toBe(IMAGE_SOURCES_2026_10.length);
    for (const [, , image, src] of IMAGE_SOURCES_2026_10) {
      expect(src).toMatch(/^https?:\/\//);
      expect(image).toMatch(/^https?:\/\//);
    }
  });
});
