import { describe, it, expect } from 'vitest';
import { filterLinkGroups, linkPickerGroups, type LinkableCoffee } from './linkPicker';

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
    expect(g[0].options).toEqual([{ id: likely.id, label: 'Sey · Likely · 2026-09-01 · backlog', roaster: 'Sey',
      name: 'Likely', meta: 'Roasted 2026-09-01 · Backlog', search: 'sey · likely · 2026-09-01 · backlog' }]);
    expect(g[1].options.map((o) => o.label)).toEqual(['sey · Same · 2026-09-01 · backlog']);
    expect(g[2].options.map((o) => o.label)).toEqual(['Onyx · Other · no date · open']);
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
      'Sey · Kiambu · 2026-09-01 · backlog · added 2026-08-01',
      'Sey · Kiambu · 2026-09-01 · backlog · added 2026-09-15'
    ]);
  });

  it('twin of the top match appears under Top match, once, with disambiguated labels', () => {
    const t1 = c({ created_at: '2026-08-01T09:00:00.000Z' });
    const t2 = c({ created_at: '2026-09-15T09:00:00.000Z' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: t1.id }, [t1, t2]);
    expect(g.map((x) => x.label)).toEqual(['Top match']);
    expect(g[0].options.map((o) => [o.id, o.label, o.meta, o.twin])).toEqual([
      [t1.id, 'Sey · Kiambu · 2026-09-01 · backlog · added 2026-08-01', 'Roasted 2026-09-01 · Backlog', 'Added 2026-08-01'],
      [t2.id, 'Sey · Kiambu · 2026-09-01 · backlog · added 2026-09-15', 'Roasted 2026-09-01 · Backlog', 'Added 2026-09-15']
    ]);
  });

  it('same-day twins get unique labels (Bag N by ascending id)', () => {
    const a = c({}), b = c({});
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: null }, [b, a]);
    const labels = g.flatMap((x) => x.options.map((o) => o.label));
    expect(new Set(labels).size).toBe(2);
    expect(g[0].options.find((o) => o.id === a.id)!.label).toMatch(/Bag 1$/);
    expect(g[0].options.find((o) => o.id === b.id)!.label).toMatch(/Bag 2$/);
    const bOpt = g[0].options.find((o) => o.id === b.id)!;
    expect([bOpt.meta, bOpt.twin]).toEqual(['Roasted 2026-09-01 · Backlog', 'Added 2026-09-02 · Bag 2']);
    expect(bOpt.search).toContain('bag 2');
  });

  it('twins of the top match all go under Top match, the top match stays first/preselected', () => {
    const t1 = c({}), t2 = c({}), t3 = c({});
    const nodate1 = c({ roast_date: null }), nodate2 = c({ roast_date: null });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: t2.id }, [t3, nodate1, t1, t2, nodate2]);
    expect(g.map((x) => x.label)).toEqual(['Top match', 'Same roaster']);
    expect(g[0].top).toBe(true);
    expect(g[0].options.map((o) => o.id)).toEqual([t2.id, t1.id, t3.id]);
    expect(g[1].options.map((o) => o.id)).toEqual([nodate1.id, nodate2.id]);
    const labels = g.flatMap((x) => x.options.map((o) => o.label));
    expect(new Set(labels).size).toBe(5);
  });

  it('omits an empty roaster segment instead of a leading separator', () => {
    const a = c({ roaster: '' });
    const g = linkPickerGroups({ roaster: null, likelyMatchId: null }, [a]);
    expect(g[0].options[0].label).toBe('Kiambu · 2026-09-01 · backlog');
    expect(g[0].options[0]).toMatchObject({ roaster: '', name: 'Kiambu', meta: 'Roasted 2026-09-01 · Backlog' });
  });

  it('a missing roast date reads "No roast date" in the meta line', () => {
    const a = c({ roast_date: null, status: 'open' });
    const g = linkPickerGroups({ roaster: null, likelyMatchId: null }, [a]);
    expect(g[0].options[0].meta).toBe('No roast date · Open');
  });

  it('non-top groups keep the input order (not id order)', () => {
    const likely = c({ coffee_name: 'Likely' });
    const s2 = c({ coffee_name: 'B' }), s1 = c({ coffee_name: 'A' });
    const o2 = c({ roaster: 'Zed' }), o1 = c({ roaster: 'Abe' });
    const g = linkPickerGroups({ roaster: 'Sey', likelyMatchId: likely.id }, [likely, s1, o1, s2, o2]);
    expect(g[1].options.map((o) => o.id)).toEqual([s1.id, s2.id]);
    expect(g[2].options.map((o) => o.id)).toEqual([o1.id, o2.id]);
  });
});

describe('linkPickerGroups date format', () => {
  it('writes roast and added dates in the format', () => {
    const a = c({ created_at: '2026-10-22T10:00:00Z' });
    const opt = (f?: 'eu' | 'us') => linkPickerGroups({ roaster: null, likelyMatchId: null }, [a], f).flatMap((g) => g.options)[0];
    expect(opt().meta).toContain('Roasted 2026-09-01');
    expect(opt('eu').meta).toContain('Roasted 01/09/2026');
    expect(opt('us').label).toContain('09/01/2026');
  });
});

describe('filterLinkGroups', () => {
  const likely = c({ roaster: 'Big Sur', coffee_name: 'Pink Bourbon' });
  const same = c({ roaster: 'Big Sur', coffee_name: 'Kamoko', status: 'archive' });
  const other = c({ roaster: 'Onyx', coffee_name: 'Geometry', roast_date: '2026-07-04' });
  const groups = linkPickerGroups({ roaster: 'Big Sur', likelyMatchId: likely.id }, [likely, same, other]);
  const ids = (q: string) => filterLinkGroups(groups, q).map((g) => [g.label, g.options.map((o) => o.id)]);

  it('blank query keeps everything', () => {
    expect(filterLinkGroups(groups, '  ')).toBe(groups);
  });
  it('matches roaster, name and meta case-insensitively, dropping empty groups', () => {
    expect(ids('BIG sur')).toEqual([['Top match', [likely.id]], ['Same roaster', [same.id]]]);
    expect(ids('geometry')).toEqual([['Other coffees', [other.id]]]);
    expect(ids('archive')).toEqual([['Same roaster', [same.id]]]);
    expect(ids('2026-07')).toEqual([['Other coffees', [other.id]]]);
    expect(ids('nothing like this')).toEqual([]);
  });
  it('keeps the Top match flag on a filtered Top match group', () => {
    expect(filterLinkGroups(groups, 'pink')[0].top).toBe(true);
  });
});
