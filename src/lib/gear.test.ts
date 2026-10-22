import { describe, it, expect } from 'vitest';
import { shownTrophies, type GearKind } from './gear';

const t = (kind: GearKind, name: string, key: string, retired = false) => ({ kind, name, key, retired });
const list = [t('dripper', 'V60', 'dripper-v60'), t('dripper', 'Old', 'dripper-old', true), t('grinder', 'ZP6', 'grinder-zp6', true), t('filter', 'Abaca', 'filter-abaca')];

describe('shownTrophies', () => {
  it('no pick: retired cards go to the shelf', () => {
    const r = shownTrophies(list, {});
    expect(r.active.map((x) => x.key)).toEqual(['dripper-v60', 'filter-abaca']);
    expect(r.retired.map((x) => x.key)).toEqual(['dripper-old', 'grinder-zp6']);
  });
  it('picks show only the picked cards, retired included, no shelf', () => {
    const r = shownTrophies(list, { dripper: 'V60', grinder: 'zp6' });
    expect(r.active.map((x) => x.key)).toEqual(['dripper-v60', 'grinder-zp6']);
    expect(r.retired).toEqual([]);
  });
  it('a pick naming no card shows nothing', () => expect(shownTrophies(list, { filter: 'Nope' }).active).toEqual([]));
});
