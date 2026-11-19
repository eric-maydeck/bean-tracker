import { describe, expect, it } from 'vitest';
import { insightsPreview, recordAnchor } from './chartLink';
import type { RecordsTab } from '#lib/server/insights/records.ts';
import type { BoardRow } from '#lib/server/insights/leaderboards.ts';

const rows = (vals: [string, number][]) => vals.map(([label, value]) => ({ key: label, label, value }) as unknown as BoardRow);
const ORIGINS = rows([['Ethiopia', 8.42], ['Kenya', 8.1], ['Colombia', 7.94], ['Rwanda', 7.5], ['Burundi', 7.0], ['Peru', 6.9]]);
const none = { roasters: [], coffees: [], origins: ORIGINS, varieties: [], producers: [], process: [], roast: [], water: rows([['Lab Water B', 12]]), dripper: [], filter: [], grinder: [], caffeine: [] };
const base = {
  tab: 'leaderboards' as const, owner: 'Tester', tabLabel: 'Leaderboards', period: 'All time', brews: 412, avgRating: 7.94, filters: ['Kenya', 'Washed'],
  rank: 'rating' as const, perPerson: false, boards: none, records: null
};
const PAGE = { title: 'Stats: Leaderboards', description: "Tester's top roasters, coffees, origins and gear\nAll time · Kenya · Washed\n412 brews · Avg rating 7.9" };

describe('insightsPreview', () => {
  it('Origins board under rating', () => {
    expect(insightsPreview({ ...base, chart: 'leaderboard-origins' })).toMatchObject({
      title: 'Stats: Origins',
      description: 'Avg rating · All time\n🥇 8.4 · 🇪🇹 Ethiopia\n🥈 8.1 · 🇰🇪 Kenya\n🥉 7.9 · 🇨🇴 Colombia\n4. 7.5 · 🇷🇼 Rwanda\n5. 7.0 · 🇧🇮 Burundi'
    });
  });
  it('Origins board under brews', () => {
    const boards = { ...none, origins: rows([['Ethiopia', 34], ['Kenya', 21], ['Colombia', 12]]) };
    expect(insightsPreview({ ...base, boards, rank: 'brews', chart: 'leaderboard-origins' }).description).toBe(
      'Brews · All time\n🥇 34 · 🇪🇹 Ethiopia\n🥈 21 · 🇰🇪 Kenya\n🥉 12 · 🇨🇴 Colombia'
    );
  });
  it('Lowest first lists the lowest row first', () => {
    const roasters = [{ key: 'a', label: 'Sey', value: 8.5, bags: 4, brews: 9 }, { key: 'b', label: 'Onyx', value: 7.0, bags: 3, brews: 6 }, { key: 'c', label: 'One', value: 6, bags: 1, brews: 1 }] as BoardRow[];
    const d = insightsPreview({ ...base, boards: { ...none, roasters }, chart: 'leaderboard-roasters', low: ['roasters'] }).description;
    expect(d).toBe('Avg rating · All time · lowest first\n1. 7.0 · Onyx\n2. 8.5 · Sey');
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
    expect(insightsPreview({ ...base, avgRating: null }).description.split('\n')[2]).toBe('412 brews');
  });
  it('page level: a given line replaces the brews and rating line', () =>
    expect(insightsPreview({ ...base, tab: 'spend', tabLabel: 'Spend', filters: [], line: 'Spent $82.50 · 6 bags · $0.11/g avg' }).description.split('\n')[2])
      .toBe('Spent $82.50 · 6 bags · $0.11/g avg'));
  it('page level: On hand names the shelf', () =>
    expect(insightsPreview({ ...base, tab: 'onhand', tabLabel: 'On hand', filters: [], line: '4 bags waiting · 1.2kg · $52 tied up' }).description)
      .toBe("What's on Tester's shelf right now\nAll time\n4 bags waiting · 1.2kg · $52 tied up"));
  it('page level: summary per tab and owner, filters optional', () => {
    const d = insightsPreview({ ...base, owner: 'Other', tab: 'water', tabLabel: 'Water', filters: [], brews: 1436, avgRating: 7.5 });
    expect(d).toEqual({ title: 'Stats: Water', description: "How water affects Other's ratings\nAll time\n1,436 brews · Avg rating 7.5" });
    expect(insightsPreview({ ...base, tab: 'overview', tabLabel: 'Overview' }).description.split('\n')[0]).toBe("Tester's brewing at a glance");
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
    topBrews: [{ rating: 10, holder: { label: 'Lab Bag 3', sub: 'Test Roaster · V60 - Abaca', date: '2026-08-01' }, brewer: 'V60 - Abaca', roaster: 'Test Roaster' }]
  } as unknown as RecordsTab;
  const v = { ...base, tab: 'records' as const, tabLabel: 'Records', period: 'Last 3 months', boards: null, records };
  it('Records section', () => {
    expect(insightsPreview({ ...v, chart: 'records-taste' })).toMatchObject({
      title: 'Stats: Taste', description: 'Last 3 months\nBest bag · 9.2\nBest day · 9.0'
    });
    expect(insightsPreview({ ...v, chart: 'records-money' }).title).toBe('Stats: Records');
    expect(insightsPreview({ ...v, chart: 'records-money' }).description.split('\n')[0]).toBe("Tester's bests and extremes");
  });
  it('Top coffees and Top brews', () => {
    expect(insightsPreview({ ...v, chart: 'records-top-coffees' })).toMatchObject({
      title: 'Stats: Top coffees', description: 'Avg rating · Last 3 months\n🥇 8.9 · Test Roaster · Lab Bag 3\n🥈 8.5 · Orphan'
    });
    expect(insightsPreview({ ...v, chart: 'records-top-brews' })).toMatchObject({
      title: 'Stats: Top brews', description: 'Rating · Last 3 months\n🥇 10.0 · Test Roaster · Lab Bag 3'
    });
  });
  it('thumbnails: bars, tile and grid on card; none for a Chart.js chart', () => {
    expect(insightsPreview({ ...base, chart: 'leaderboard-origins' }).card).toEqual({
      big: 'Origins', label: 'Stats · All time',
      thumb: { kind: 'bars', rows: [['🇪🇹 Ethiopia', '8.4', 1], ['🇰🇪 Kenya', '8.1', 8.1 / 8.42], ['🇨🇴 Colombia', '7.9', 7.94 / 8.42], ['🇷🇼 Rwanda', '7.5', 7.5 / 8.42], ['🇧🇮 Burundi', '7.0', 7 / 8.42]] }
    });
    const roasters = [{ key: 'a', label: 'Sey', value: 8.5, bags: 4, brews: 9 }, { key: 'b', label: 'Onyx', value: 7.0, bags: 3, brews: 6 }] as BoardRow[];
    expect(insightsPreview({ ...base, boards: { ...none, roasters }, chart: 'leaderboard-roasters', low: ['roasters'] }).card!.thumb)
      .toEqual({ kind: 'bars', plain: true, rows: [['Onyx', '7.0', 7 / 8.5], ['Sey', '8.5', 1]] });
    expect(insightsPreview({ ...v, chart: 'records-top-coffees' }).card).toEqual({
      big: 'Top coffees', label: 'Stats · Last 3 months', thumb: { kind: 'bars', rows: [['Test Roaster · Lab Bag 3', '8.9', 1], ['Orphan', '8.5', 8.5 / 8.94]] }
    });
    expect(insightsPreview({ ...v, chart: 'records-top-brews' }).card!.thumb).toEqual({ kind: 'bars', rows: [['Test Roaster · Lab Bag 3', '10.0', 1]] });
    expect(insightsPreview({ ...v, chart: 'record-bestBag' }).card).toEqual({
      big: 'Best bag', label: 'Stats · Last 3 months', thumb: { kind: 'tile', value: '9.2', holder: 'Test Roaster · Lab Bag 3', date: '2026-08-01' }
    });
    expect(insightsPreview({ ...v, chart: 'record-bestDay' }).card!.thumb).toEqual({ kind: 'tile', value: '9.0', holder: 'Oct 3, 2026' });
    expect(insightsPreview({ ...v, chart: 'records-taste' }).card).toEqual({
      big: 'Taste', label: 'Stats · Last 3 months', thumb: { kind: 'grid', tiles: [['Best bag', '9.2'], ['Best day', '9.0']] }
    });
    for (const chart of ['habits-hour', 'nope', undefined]) expect(insightsPreview({ ...v, chart }).card).toBeUndefined();
  });
  it('thumbnails show price per gram where the page shows per 100g', () => {
    const r = { sections: [{ key: 'money', tiles: [{ key: 'priciestBag', label: 'Priciest bag per 100g', fmt: 'per100', value: 9.3, holder: { label: 'Bag', date: '' }, ties: [] }] }] } as unknown as RecordsTab;
    const m = { ...v, records: r };
    expect(insightsPreview({ ...m, chart: 'records-money' }).card!.thumb).toEqual({ kind: 'grid', tiles: [['Priciest bag per g', '$0.09/g']] });
    expect(insightsPreview({ ...m, chart: 'record-priciestBag' }).card).toMatchObject({ big: 'Priciest bag per g', thumb: { value: '$0.09/g' } });
    expect(insightsPreview({ ...m, chart: 'record-priciestBag' }).description).toContain('$9.30 / 100g');
  });
  it('thumbnail text is capped at 80 characters', () => {
    const boards = { ...none, origins: rows([['x'.repeat(200), 8]]) };
    expect((insightsPreview({ ...base, boards, chart: 'leaderboard-origins' }).card!.thumb as { rows: string[][] }).rows[0][0]).toHaveLength(80);
  });
  it('Records tile', () => {
    expect(insightsPreview({ ...v, chart: 'record-bestBag' })).toMatchObject({
      title: 'Stats: Best bag', description: 'Last 3 months\n9.2\nTest Roaster · Lab Bag 3\n2026-08-01\nTied with 2 more'
    });
    expect(insightsPreview({ ...v, chart: 'record-bestDay' })).toMatchObject({
      title: 'Stats: Best day', description: 'Last 3 months\n9.0\n2026-10-03'
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
