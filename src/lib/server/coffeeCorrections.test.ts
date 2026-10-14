import { describe, it, expect } from 'vitest';
import { COFFEE_CORRECTIONS } from './coffeeCorrections';
import { PRODUCT_PAGE_BACKFILLS } from './productPageBackfill';
import { createDb } from './db';
import { getRoastLevels } from './roastLevels';
import { applyCoffeeFixes, createCoffee, getCoffeeById } from './coffees';

describe('COFFEE_CORRECTIONS data', () => {
  it('every batch has its own coffee_corrections_ marker, distinct from the backfills', () => {
    const markers = COFFEE_CORRECTIONS.map((b) => b.marker);
    expect(new Set(markers).size).toBe(markers.length);
    for (const m of markers) expect(m).toMatch(/^coffee_corrections_[a-z0-9_]+$/);
    const backfills = new Set(PRODUCT_PAGE_BACKFILLS.map((b) => b.marker));
    for (const m of markers) expect(backfills.has(m)).toBe(false);
  });

  it('every fix is guarded by roaster and an exact from value', () => {
    for (const b of COFFEE_CORRECTIONS) {
      for (const f of b.fixes) {
        expect(f.roaster).toBeTruthy();
        expect(f.from).not.toBeNull();
        expect(f.to).not.toBe(f.from);
      }
    }
  });

  it('every roast_level fix lands on a roast_levels label', () => {
    const levels = new Set(getRoastLevels(createDb(':memory:')).map((l) => l.roast_level));
    const fixes = COFFEE_CORRECTIONS.flatMap((b) => b.fixes).filter((f) => f.field === 'roast_level');
    expect(fixes.map((f) => f.to).sort()).toEqual(['Light/Medium', 'Medium/Light']);
    for (const f of fixes) expect(levels.has(f.to)).toBe(true);
  });
});

describe('coffee_corrections_2026_10_c: the thaw date the UTC "today" bug wrote a day late', () => {
  const batch = () => COFFEE_CORRECTIONS.find((b) => b.marker === 'coffee_corrections_2026_10_c')!;
  const seed = (roaster: string, frozenEnd: string) => {
    const db = createDb(':memory:');
    for (let i = 1; i <= 6; i++) {
      createCoffee(db, { roaster: i === 6 ? roaster : 'Other', coffee_name: `C${i}`, origin: null, roast_level: null,
        processing: null, amount_g: null, cost: null, roast_date: null, frozen_start_date: i === 6 ? '2026-07-29' : null,
        frozen_end_date: i === 6 ? frozenEnd : null, rest_days_low: null, rest_days_high: null, image_url: null });
    }
    return db;
  };

  it('moves coffee 6 (Still) from 2026-10-05 to 2026-10-04, once', () => {
    const db = seed('Still', '2026-10-05');
    expect(applyCoffeeFixes(db, batch())).toMatchObject({ fixed: 1, skipped: [] });
    expect(getCoffeeById(db, 6)?.frozen_end_date).toBe('2026-10-04');
    expect(applyCoffeeFixes(db, batch())).toBeNull(); // marker set: never re-runs
  });

  it('leaves it alone when the date was already changed or id 6 is another roaster', () => {
    for (const db of [seed('Still', '2026-10-07'), seed('Other', '2026-10-05')]) {
      expect(applyCoffeeFixes(db, batch())).toMatchObject({ fixed: 0 });
      expect(getCoffeeById(db, 6)?.frozen_end_date).not.toBe('2026-10-04');
    }
  });
});
