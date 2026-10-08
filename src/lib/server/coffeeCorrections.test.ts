import { describe, it, expect } from 'vitest';
import { COFFEE_CORRECTIONS } from './coffeeCorrections';
import { PRODUCT_PAGE_BACKFILLS } from './productPageBackfill';

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
});
