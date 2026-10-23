import { describe, it, expect } from 'vitest';
import { createDb } from '$lib/server/db';
import { getGearDetails, saveGearDetails } from './gearDetails';

const d = { kind: 'dripper' as const, name: 'V60', values: { brand: 'Hario', coneAngle: 60 }, imageUrl: 'https://x/v60.png' };

describe('gear details', () => {
  it('save → get round-trips values and image; created_at stays, updated_at moves', () => {
    const db = createDb(':memory:');
    saveGearDetails(db, d, new Date('2026-10-01T10:00:00Z'));
    saveGearDetails(db, { ...d, values: { brand: 'Hario' } }, new Date('2026-10-05T10:00:00Z'));
    expect(getGearDetails(db)).toEqual([{ kind: 'dripper', name: 'V60', values: { brand: 'Hario' }, imageUrl: 'https://x/v60.png',
      imageCopy: null, imageFill: null, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z' }]);
  });
  it('saving nothing deletes the row', () => {
    const db = createDb(':memory:');
    saveGearDetails(db, d);
    saveGearDetails(db, { ...d, values: {}, imageUrl: null });
    expect(getGearDetails(db)).toEqual([]);
  });
  it('image_copy and fill join by url', () => {
    const db = createDb(':memory:');
    saveGearDetails(db, d);
    db.prepare(`INSERT INTO image_copies (url, kind, file) VALUES (?, 'gear', 'a.webp')`).run(d.imageUrl);
    db.prepare(`INSERT INTO image_fills (url, fill) VALUES (?, '#112233')`).run(d.imageUrl);
    expect(getGearDetails(db)[0]).toMatchObject({ imageCopy: '/img/gear/a.webp', imageFill: '#112233' });
  });
});
