import { describe, it, expect } from 'vitest';
import { pickCreatedAt } from './backfillCreatedAt';

const coffee = { slug: 'x', coffee_name: 'Kenya Kiambu', roaster: 'Sey', roast_date: '2026-03-01', status: 'finished' };
const bean = (over: Partial<{ name: string; roaster: string | null; roast_date: string | null; bc_created_at: string | null }>) => ({
  name: 'Kenya Kiambu',
  roaster: 'Sey',
  roast_date: '2026-03-01',
  bc_created_at: '2026-03-05T10:00:00.000Z',
  ...over
});

describe('pickCreatedAt', () => {
  it('prefers an exact match over an earlier fuzzy one', () => {
    const beans = [
      bean({ name: 'Kenya Kiambu AA', bc_created_at: '2026-03-02T00:00:00.000Z' }),
      bean({ bc_created_at: '2026-03-05T10:00:00.000Z' })
    ];
    expect(pickCreatedAt(coffee, beans)).toEqual({ createdAt: '2026-03-05T10:00:00.000Z', source: 'exact' });
  });

  it('takes the earliest of several exact matches', () => {
    const beans = [bean({ bc_created_at: '2026-03-09T00:00:00.000Z' }), bean({ bc_created_at: '2026-03-04T00:00:00.000Z' })];
    expect(pickCreatedAt(coffee, beans)?.createdAt).toBe('2026-03-04T00:00:00.000Z');
  });

  it('uses the earliest fuzzy match when there is no exact one', () => {
    const beans = [
      bean({ name: 'Kenya Kiambu AA', bc_created_at: '2026-03-08T00:00:00.000Z' }),
      bean({ roast_date: '2026-03-03', bc_created_at: '2026-03-06T00:00:00.000Z' }),
      bean({ roaster: 'Other', bc_created_at: '2026-01-01T00:00:00.000Z' })
    ];
    expect(pickCreatedAt(coffee, beans)).toEqual({ createdAt: '2026-03-06T00:00:00.000Z', source: 'fuzzy' });
  });

  it('falls back to the roast date', () => {
    expect(pickCreatedAt(coffee, [bean({ roaster: 'Other' })])).toEqual({
      createdAt: '2026-03-01T00:00:00.000Z',
      source: 'roast'
    });
  });

  it('returns null with no match and no roast date', () => {
    expect(pickCreatedAt({ ...coffee, roast_date: null }, [])).toBeNull();
  });
});
