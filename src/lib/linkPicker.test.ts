import { describe, it, expect } from 'vitest';
import { linkPickerGroups, type LinkableCoffee } from './linkPicker';

let id = 0;
const c = (over: Partial<LinkableCoffee>): LinkableCoffee => ({
  id: ++id, slug: `s${id}`, roaster: 'Sey', coffee_name: 'Kiambu', roast_date: '2026-09-01', status: 'backlog',
  created_at: '2026-09-02T10:00:00.000Z', ...over
});

describe('linkPickerGroups', () => {
  it('top match first, then same roaster (case-insensitive), then the rest, each with a header', () => {
    const likely = c({ coffee_name: 'Likely' });
    const same = c({ roaster: ' sey ', coffee_name: 'Same' });
    const other = c({ roaster: 'Onyx', coffee_name: 'Other', roast_date: null, status: 'open' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: likely.id }, [same, other, likely]);
    expect(g.map((x) => x.label)).toEqual(['Top match', 'Same roaster', 'Other coffees']);
    expect(g[0].options).toEqual([{ id: likely.id, label: 'Likely · 2026-09-01 · backlog' }]);
    expect(g[1].options.map((o) => o.label)).toEqual(['Same · 2026-09-01 · backlog']);
    expect(g[2].options.map((o) => o.label)).toEqual(['Other · no date · open']);
  });

  it('no likely match and no roaster: only "Other coffees", no "Top match"', () => {
    const a = c({});
    const g = linkPickerGroups({ roaster: null, likelyMatchId: null }, [a]);
    expect(g.map((x) => x.label)).toEqual(['Other coffees']);
    expect(g[0].options.map((o) => o.id)).toEqual([a.id]);
  });

  it('tells twins apart by the date they were added', () => {
    const t1 = c({ created_at: '2026-08-01T09:00:00.000Z' });
    const t2 = c({ created_at: '2026-09-15T09:00:00.000Z' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: null }, [t1, t2]);
    expect(g[0].options.map((o) => o.label)).toEqual([
      'Kiambu · 2026-09-01 · backlog · added 2026-08-01',
      'Kiambu · 2026-09-01 · backlog · added 2026-09-15'
    ]);
  });

  it('twin of the top match still appears, once, with disambiguated labels', () => {
    const t1 = c({ created_at: '2026-08-01T09:00:00.000Z' });
    const t2 = c({ created_at: '2026-09-15T09:00:00.000Z' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: t1.id }, [t1, t2]);
    expect(g.map((x) => x.label)).toEqual(['Top match', 'Same roaster']);
    expect(g[0].options).toEqual([{ id: t1.id, label: 'Kiambu · 2026-09-01 · backlog · added 2026-08-01' }]);
    expect(g[1].options).toEqual([{ id: t2.id, label: 'Kiambu · 2026-09-01 · backlog · added 2026-09-15' }]);
  });

  it('same-day twins get unique labels (bag N by ascending id)', () => {
    const a = c({}), b = c({});
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: null }, [b, a]);
    const labels = g.flatMap((x) => x.options.map((o) => o.label));
    expect(new Set(labels).size).toBe(2);
    expect(g[0].options.find((o) => o.id === a.id)!.label).toMatch(/bag 1$/);
    expect(g[0].options.find((o) => o.id === b.id)!.label).toMatch(/bag 2$/);
  });
});
