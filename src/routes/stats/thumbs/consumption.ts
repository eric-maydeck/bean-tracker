import { chartThumb } from '#lib/chartThumb.ts';
import type { ThumbFn } from '../thumbTypes';
import { consumptionCharts } from '../consumptionSeries';

// The link-preview thumbnails of the Consumption tab's charts, drawn from the same series as the tab (labels clipped to the wire's 80).
const clip = (s: string) => (s.length > 80 ? s.slice(0, 79) + '…' : s);
const of = (pick: (ch: ReturnType<typeof consumptionCharts>) => ReturnType<ThumbFn>): ThumbFn => (c) => {
  const t = c.data.consumptionTab;
  return t && t.buckets.length ? pick(consumptionCharts(t, { unit: c.s.unit, trend: c.s.trend, agg: c.s.agg, periodLabel: c.periodLabel, compareLabel: c.compareLabel, compareDates: '' })) : null;
};
const card = (title: string, thumb: ReturnType<typeof chartThumb>) => (thumb ? { title, thumb } : null);

export const CONSUMPTION_THUMBS: Record<string, ThumbFn> = {
  'consumption-chart-brewed': of(({ brewed: b }) => card(b.title, chartThumb(b.type === 'bar' ? 'vbars' : 'lines', [{ label: clip(b.datasetLabel), values: b.values }, ...b.series.map((s) => ({ ...s, label: clip(s.label) }))], { yMin: b.yMin }))),
  'consumption-chart-bought': of(({ bought: b }) => card('Bought vs brewed', chartThumb('vbars', [{ label: b.datasetLabel, values: b.values }, ...b.series]))),
  'consumption-chart-on-hand': of(({ onHand: b }) => card('On hand over time', chartThumb('lines', [{ label: b.datasetLabel, values: b.values }])))
};
