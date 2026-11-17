import { describe, expect, it } from 'vitest';
import { BEANS } from './beanBase.fixtures';
import { BEAN_BASE_BACKFILLS } from './beanBaseBackfill';
import { reconcileBean } from './beanBaseReconcile';

const ctx = { roastLevels: ['Light'], origins: ['Colombia'], processing: ['Washed'] };
const [huila, kenya] = BEANS; // huila: producer 'Juan Pena', variety Caturra, 1700-1900 masl

describe('BEAN_BASE_BACKFILLS data', () => {
  it('markers are unique and match ^bean_base_backfill_', () => {
    const markers = BEAN_BASE_BACKFILLS.map((b) => b.marker);
    expect(new Set(markers).size).toBe(markers.length);
    for (const m of markers) expect(m).toMatch(/^bean_base_backfill_[a-z0-9_]+$/);
  });
});

describe('reconcileBean', () => {
  it('site blank -> fill; Bean Base blank -> no row', () => {
    const r = reconcileBean({}, kenya, ctx);
    expect(r.fill.map((x) => x.field)).toEqual(['origin', 'elevation', 'harvest_time', 'tasting_notes']);
    expect(r.review).toEqual([]); // producer, variety, ... are blank in Bean Base
  });
  it('format-only differences -> no row', () => {
    const r = reconcileBean(
      { origin: 'Colombia', region: 'Acevedo, Huila', producer: 'Juan Peña', variety: 'caturra', processing: 'Washed', elevation: '1700-1900 masl', harvest_time: 'November 2025', tasting_notes: 'peach, jasmine, honey' },
      huila, ctx
    );
    expect(r).toEqual({ fill: [], review: [] });
  });
  it('Bean Base adds detail -> review; site more detailed -> no row', () => {
    const r = reconcileBean({ origin: 'Colombia', variety: 'Bourbon', region: 'Acevedo, Huila' }, { ...huila, variety: 'Yellow Bourbon', region: 'Huila' }, ctx);
    expect(r.review).toEqual([{ field: 'variety', site: 'Bourbon', value: 'Yellow Bourbon' }]);
  });
});
