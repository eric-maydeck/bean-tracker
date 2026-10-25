import { describe, expect, it } from 'vitest';
import { insightsPreview } from './chartLink';
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
      description: 'All time · Rating\n🇪🇹 Ethiopia · 8.4\n🇰🇪 Kenya · 8.1\n🇨🇴 Colombia · 7.9\n🇷🇼 Rwanda · 7.5\n🇧🇮 Burundi · 7.0'
    });
  });
  it('Origins board under brews', () => {
    const boards = { ...none, origins: rows([['Ethiopia', 34], ['Kenya', 21], ['Colombia', 12]]) };
    expect(insightsPreview({ ...base, boards, rank: 'brews', chart: 'leaderboard-origins' }).description).toBe(
      'All time · Brews\n🇪🇹 Ethiopia · 34\n🇰🇪 Kenya · 21\n🇨🇴 Colombia · 12'
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
      { label: 'Best bag', fmt: 'rating', value: 9.2, holder: { label: 'Lab Bag 3', sub: 'Test Roaster', date: '2026-08-01' }, ties: [] },
      { label: 'Best day', fmt: 'rating', value: 9.0, holder: { label: '2026-10-03', date: '2026-10-03' }, ties: [] }
    ] }]
  } as unknown as RecordsTab;
  it('Records section', () => {
    const v = { ...base, tabLabel: 'Records', period: 'Last 3 months', boards: null, records };
    expect(insightsPreview({ ...v, chart: 'records-taste' })).toEqual({
      title: 'Insights: Taste', description: 'Last 3 months\nBest bag: Test Roaster · Lab Bag 3 · 9.2\nBest day: 2026-10-03 · 9.0'
    });
    expect(insightsPreview({ ...v, chart: 'records-money' }).title).toBe('Insights: Records');
  });
  it('keeps long lists within 300', () => {
    const long = rows([1, 2, 3, 4, 5].map((i) => ['x'.repeat(120) + i, 8] as [string, number]));
    const d = insightsPreview({ ...base, boards: { ...none, roasters: long }, chart: 'leaderboard-roasters' }).description;
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d.startsWith('All time · Rating\nx')).toBe(true);
  });
});
