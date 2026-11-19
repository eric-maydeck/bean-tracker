import { chartThumb } from '#lib/chartThumb.ts';
import type { ThumbFn } from '../thumbTypes';
import { usd } from '#lib/money.ts';
import { spendChart } from '../spendSeries';

export const SPEND_THUMBS: Record<string, ThumbFn> = {
  'spend-chart': (c) => {
    const t = c.data.spend;
    if (!t || t.tiles.bags === 0) return null;
    const sr = t.series;
    // The page shows "No priced bags" instead of the $/g chart.
    if (c.s.spendView === 'ppg' && sr.ppg.all.every((v) => v === null)) return null;
    const ch = spendChart(sr, { spendView: c.s.spendView, spendSeries: c.s.spendSeries, compareLabel: c.compareLabel });
    const ppg = c.s.spendView === 'ppg';
    const thumb = chartThumb(ch.type === 'bar' ? 'vbars' : 'lines', ch.series, { stacked: ch.type === 'bar', x: ch.labels, fmt: (v) => (ppg ? `${usd(v)}/g` : usd(v, ch.whole)) });
    return thumb && { title: 'Spend over time', thumb };
  },
  'spend-discovery': (c) => {
    const d = c.data.spend?.discovery;
    if (!d || d.cumulative.length < 2) return null;
    const thumb = chartThumb('lines', [{ label: 'Roasters', values: d.cumulative }], { yMin: 0, x: d.labels, fmt: (v) => `${v}` });
    return thumb && { title: 'Roaster discovery', thumb };
  }
};
