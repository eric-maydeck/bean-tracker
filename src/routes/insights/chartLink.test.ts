import { describe, expect, it } from 'vitest';
import { insightsPreview, recordAnchor } from './chartLink';
import type { RecordsTab } from '$lib/server/insights/records';
import type { BoardRow } from '$lib/server/insights/leaderboards';

const rows = (vals: [string, number][]) => vals.map(([label, value]) => ({ key: label, label, value }) as unknown as BoardRow);
const ORIGINS = rows([['Ethiopia', 8.42], ['Kenya', 8.1], ['Colombia', 7.94], ['Rwanda', 7.5], ['Burundi', 7.0], ['Peru', 6.9]]);
const none = { roasters: [], coffees: [], origins: ORIGINS, process: [], roast: [], water: rows([['Lab Water B', 12]]), dripper: [], filter: [], grinder: [] };
const base = {
  tabLabel: 'Leaderboards', period: 'All time', brews: 412, avgRating: 7.94, filters: ['Kenya', 'Washed'],
  rank: 'rating' as const, perPerson: false, boards: none, records: null
};
const PAGE = { title: 'Insights: Leaderboards', description: 'All time · 412 brews · Avg rating 7.9 · Kenya · Washed' };

describe('insightsPreview', () => {
  it('Origins board under rating', () => {
    expect(insightsPreview({ ...base, chart: 'leaderboard-origins' })).toEqual({
      title: 'Insights: Origins',
      description: 'Avg rating · All time\n🥇 8.4 · 🇪🇹 Ethiopia\n🥈 8.1 · 🇰🇪 Kenya\n🥉 7.9 · 🇨🇴 Colombia\n4. 7.5 · 🇷🇼 Rwanda\n5. 7.0 · 🇧🇮 Burundi'
    });
  });
  it('Origins board under brews', () => {
    const boards = { ...none, origins: rows([['Ethiopia', 34], ['Kenya', 21], ['Colombia', 12]]) };
    expect(insightsPreview({ ...base, boards, rank: 'brews', chart: 'leaderboard-origins' }).description).toBe(
      'Brews · All time\n🥇 34 · 🇪🇹 Ethiopia\n🥈 21 · 🇰🇪 Kenya\n🥉 12 · 🇨🇴 Colombia'
    );
  });
  it('falls back to the page level', () => {
    expect(insightsPreview({ ...base, rank: 'like', chart: 'leaderboard-origins' })).toEqual(PAGE);
    expect(insightsPreview({ ...base, rank: 'spend', chart: 'leaderboard-water' })).toEqual(PAGE);
    expect(insightsPreview({ ...base, chart: 'leaderboard-dripper' })).toEqual(PAGE);
    expect(insightsPreview({ ...base, boards: null, chart: 'leaderboard-origins' })).toEqual(PAGE);
    expect(insightsPreview({ ...base, chart: 'nope' })).toEqual(PAGE);
    expect(insightsPreview(base)).toEqual(PAGE);
  });
  it('skips Avg rating when there is none', () => {
    expect(insightsPreview({ ...base, avgRating: null }).description).toBe('All time · 412 brews · Kenya · Washed');
  });
  const records = {
    sections: [{ key: 'taste', tiles: [
      { key: 'bestBag', label: 'Best bag', fmt: 'rating', value: 9.2, holder: { label: 'Lab Bag 3', sub: 'Test Roaster', date: '2026-08-01' }, ties: [{}, {}] },
      { key: 'bestDay', label: 'Best day', fmt: 'rating', value: 9.0, holder: { label: '2026-10-03', date: '2026-10-03' }, ties: [] }
    ] }],
    topCoffees: [
      { mean: 8.94, brews: 5, holder: { label: 'Lab Bag 3', sub: 'Test Roaster', date: '2026-08-01' } },
      { mean: 8.5, brews: 4, holder: { label: 'Orphan', date: '2026-08-02' } }
    ],
    topBrews: [{ rating: 10, holder: { label: 'Lab Bag 3', sub: 'Test Roaster', date: '2026-08-01' }, brewer: 'V60' }]
  } as unknown as RecordsTab;
  const v = { ...base, tabLabel: 'Records', period: 'Last 3 months', boards: null, records };
  it('Records section', () => {
    expect(insightsPreview({ ...v, chart: 'records-taste' })).toEqual({
      title: 'Insights: Taste', description: 'Last 3 months\nBest bag · 9.2\nBest day · 9.0'
    });
    expect(insightsPreview({ ...v, chart: 'records-money' }).title).toBe('Insights: Records');
  });
  it('Top coffees and Top brews', () => {
    expect(insightsPreview({ ...v, chart: 'records-top-coffees' })).toEqual({
      title: 'Insights: Top coffees', description: 'Avg rating · Last 3 months\n🥇 8.9 · Test Roaster · Lab Bag 3\n🥈 8.5 · Orphan'
    });
    expect(insightsPreview({ ...v, chart: 'records-top-brews' })).toEqual({
      title: 'Insights: Top brews', description: 'Rating · Last 3 months\n🥇 10.0 · Test Roaster · Lab Bag 3'
    });
  });
  it('Records tile', () => {
    expect(insightsPreview({ ...v, chart: 'record-bestBag' })).toEqual({
      title: 'Insights: Best bag', description: 'Last 3 months\n9.2\nTest Roaster · Lab Bag 3\n2026-08-01\nTied with 2 more'
    });
    expect(insightsPreview({ ...v, chart: 'record-bestDay' })).toEqual({
      title: 'Insights: Best day', description: 'Last 3 months\n9.0\n2026-10-03'
    });
    expect(recordAnchor('grindFine:A4Z (Femobook)')).toBe('record-grindFine-A4Z-Femobook');
  });
  it('keeps long lists within 300', () => {
    const long = rows([1, 2, 3, 4, 5].map((i) => ['x'.repeat(120) + i, 8] as [string, number]));
    const d = insightsPreview({ ...base, boards: { ...none, roasters: long }, chart: 'leaderboard-roasters' }).description;
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d.startsWith('Avg rating · All time\n🥇 8.0 · x')).toBe(true);
  });
});
