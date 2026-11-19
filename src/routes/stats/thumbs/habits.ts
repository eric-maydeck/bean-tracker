import { chartThumb } from '#lib/chartThumb.ts';
import type { ThumbFn } from '../thumbTypes';
import { habitsCharts } from '../consumptionSeries';

// By hour / By weekday: the same bars as the tab (labels clipped to the wire's 80).
const clip = (s: string) => (s.length > 80 ? s.slice(0, 79) + '…' : s);
const bars = (key: 'hour' | 'weekday', title: string): ThumbFn => (c) => {
  const h = c.data.habits;
  if (!h || h.tiles.brewDays === 0) return null; // the page draws one empty panel instead
  const b = habitsCharts(h, { measure: c.s.measure, agg: c.s.agg, comparing: !!c.data.previousPeriod, periodLabel: c.periodLabel, compareLabel: c.compareLabel })[key];
  const thumb = chartThumb('vbars', [{ label: clip(c.periodLabel), values: b.values }, ...b.series.map((s) => ({ ...s, label: clip(s.label) }))], { yMin: b.yMin });
  return thumb ? { title, thumb } : null;
};

export const HABITS_THUMBS: Record<string, ThumbFn> = { 'habits-hour': bars('hour', 'By hour of day'), 'habits-weekday': bars('weekday', 'By day of week') };
