import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRODUCT_PAGE_BACKFILLS } from './productPageBackfill';

describe('PRODUCT_PAGE_BACKFILLS data', () => {
  it('every batch has its own product_page_backfill_ marker', () => {
    const markers = PRODUCT_PAGE_BACKFILLS.map((b) => b.marker);
    expect(new Set(markers).size).toBe(markers.length);
    for (const m of markers) expect(m).toMatch(/^product_page_backfill_[a-z0-9_]+$/);
  });

  it('fixes only fill product_url / image_url with web addresses', () => {
    for (const b of PRODUCT_PAGE_BACKFILLS) {
      for (const f of b.fixes) {
        expect(['product_url', 'image_url']).toContain(f.field);
        expect(f.to).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('boot', () => {
  afterEach(() => {
    vi.doUnmock('./productPageBackfill.ts');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('createDb applies a batch once; the next boot logs and changes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ppb-'));
    try {
      const path = join(dir, 'test.db');
      const url = 'https://sey.coffee/products/kiambu';
      vi.resetModules();
      vi.doMock('./productPageBackfill.ts', () => ({
        PRODUCT_PAGE_BACKFILLS: [{
          marker: 'product_page_backfill_test',
          fixes: [{ coffee_id: 1, field: 'product_url', from: null, to: url }],
          websites: [],
          tavilyCalls: []
        }]
      }));
      const { createDb } = await import('./db');
      const { createCoffee } = await import('./coffees');
      const productUrl = (db: ReturnType<typeof createDb>) =>
        (db.prepare(`SELECT product_url FROM coffees WHERE id = 1`).get() as { product_url: string | null }).product_url;
      const marked = (db: ReturnType<typeof createDb>) =>
        db.prepare(`SELECT 1 FROM app_meta WHERE key = 'product_page_backfill_test'`).get();

      let db = createDb(path); // no coffees yet: nothing applied, no marker
      expect(marked(db)).toBeUndefined();
      createCoffee(db, {
        roaster: 'Sey', coffee_name: 'Kiambu', origin: null, roast_level: null, processing: null,
        amount_g: null, cost: null, roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null,
        rest_days_low: null, rest_days_high: null, image_url: null
      });
      db.close();

      db = createDb(path);
      expect(productUrl(db)).toBe(url);
      expect(marked(db)).toBeTruthy();
      db.prepare(`UPDATE coffees SET product_url = NULL WHERE id = 1`).run();
      db.close();

      const log = vi.spyOn(console, 'log');
      db = createDb(path);
      expect(log.mock.calls.flat().join('\n')).not.toContain('product_page_backfill_test');
      expect(productUrl(db)).toBeNull();
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
