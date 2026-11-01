import { describe, it, expect } from 'vitest';
import { BEAN_DATA_BACKFILLS } from './beanDataBackfill';

describe('BEAN_DATA_BACKFILLS data', () => {
  it('data file markers are unique and match ^bean_data_backfill_', () => {
    const markers = BEAN_DATA_BACKFILLS.map((b) => b.marker);
    expect(new Set(markers).size).toBe(markers.length);
    for (const m of markers) expect(m).toMatch(/^bean_data_backfill_[a-z0-9_]+$/);
  });
});
