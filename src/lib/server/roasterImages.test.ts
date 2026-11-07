import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { setRoasterImage, getRoasterImage, getRoasterImages, applyRoasterImageDefaults } from './roasterImages';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER, ROASTER_IMAGE_DEFAULTS_MARKER } from './roasterImageDefaults';

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

describe('applyRoasterImageDefaults', () => {
  const addCoffee = (d: DatabaseSync, over: Partial<NewCoffeeInput> = {}) =>
    createCoffee(d, {
      roaster: 'Sey', coffee_name: 'Kiambu', origin: null, roast_level: null, processing: null, amount_g: 250, cost: 20,
      roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
      image_url: null, ...over
    }).id;
  const M = 'test_marker';
  const DEFAULTS = [
    { roaster: 'Sey', image_url: 'https://img.example/sey.png' },
    { roaster: 'Still', image_url: 'https://img.example/still.png' }
  ];
  const coffee = (id: number) =>
    db.prepare(`SELECT roaster, slug, image_url FROM coffees WHERE id = ?`).get(id) as { roaster: string; slug: string; image_url: string | null };

  it('does nothing (and sets no marker) on a DB with no coffees', () => {
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).toBeNull();
    expect(getRoasterImages(db)).toEqual({});
    addCoffee(db);
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).not.toBeNull();
  });

  it('seeds defaults, skipping a roaster that already has one', () => {
    addCoffee(db);
    setRoasterImage(db, 'SEY', 'https://img.example/mine.png');
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).toMatchObject({ added: 1, skipped: 1 });
    expect(getRoasterImage(db, 'Sey')).toBe('https://img.example/mine.png');
    expect(getRoasterImage(db, 'Still')).toBe('https://img.example/still.png');
  });

  it("renames 'still' to 'Still' (slug unchanged) and leaves other roasters", () => {
    const s = addCoffee(db, { roaster: 'still' });
    const other = addCoffee(db, { roaster: 'sey' });
    const slug = coffee(s).slug;
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).toMatchObject({ renamed: 1 });
    expect(coffee(s)).toMatchObject({ roaster: 'Still', slug });
    expect(coffee(other).roaster).toBe('sey');
  });

  it("clears a coffee image equal to its roaster's default (ignoring case), keeps a different one", () => {
    const same = addCoffee(db, { roaster: 'sey', image_url: 'https://img.example/sey.png' });
    const diff = addCoffee(db, { image_url: 'https://img.example/bag.png' });
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).toMatchObject({ cleared: 1 });
    expect(coffee(same).image_url).toBeNull();
    expect(coffee(diff).image_url).toBe('https://img.example/bag.png');
  });

  it('runs once: a second run is a no-op', () => {
    const s = addCoffee(db);
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).not.toBeNull();
    db.prepare(`DELETE FROM roaster_images`).run();
    db.prepare(`UPDATE coffees SET roaster = 'still' WHERE id = ?`).run(s);
    expect(applyRoasterImageDefaults(db, DEFAULTS, M)).toBeNull();
    expect(getRoasterImages(db)).toEqual({});
    expect(coffee(s).roaster).toBe('still');
  });

  it('the 2026-10b batch has its own marker', () => {
    expect(ROASTER_IMAGE_DEFAULTS_2026_10B_MARKER).not.toBe(ROASTER_IMAGE_DEFAULTS_MARKER);
  });
});
