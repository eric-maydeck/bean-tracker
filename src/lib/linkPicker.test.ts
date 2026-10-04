import { describe, it, expect } from 'vitest';
import { linkPickerGroups, type LinkableCoffee } from './linkPicker';

let id = 0;
const c = (over: Partial<LinkableCoffee>): LinkableCoffee => ({
  id: ++id, slug: `s${id}`, roaster: 'Sey', coffee_name: 'Kiambu', roast_date: '2026-09-01', status: 'backlog',
  created_at: '2026-09-02T10:00:00.000Z', ...over
});

describe('linkPickerGroups', () => {
  it('likely match first, then same roaster (case-insensitive), then the rest', () => {
    const likely = c({ coffee_name: 'Likely' });
    const same = c({ roaster: ' sey ', coffee_name: 'Same' });
    const other = c({ roaster: 'Onyx', coffee_name: 'Other', roast_date: null, status: 'open' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: likely.id }, [same, other, likely]);
    expect(g.likely).toEqual({ id: likely.id, label: 'Likely · 2026-09-01 · backlog' });
    expect(g.sameRoaster.map((o) => o.label)).toEqual(['Same · 2026-09-01 · backlog']);
    expect(g.other.map((o) => o.label)).toEqual(['Other · no date · open']);
  });

  it('no likely match and no roaster: everything is "other"', () => {
    const a = c({});
    const g = linkPickerGroups({ roaster: null, likelyMatchId: null }, [a]);
    expect(g.likely).toBeNull();
    expect(g.sameRoaster).toEqual([]);
    expect(g.other.map((o) => o.id)).toEqual([a.id]);
  });

  it('tells twins apart by the date they were added', () => {
    const t1 = c({ created_at: '2026-08-01T09:00:00.000Z' });
    const t2 = c({ created_at: '2026-09-15T09:00:00.000Z' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: null }, [t1, t2]);
    expect(g.sameRoaster.map((o) => o.label)).toEqual([
      'Kiambu · 2026-09-01 · backlog · added 2026-08-01',
      'Kiambu · 2026-09-01 · backlog · added 2026-09-15'
    ]);
  });
});
