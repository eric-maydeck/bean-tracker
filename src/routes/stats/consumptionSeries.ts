import type { Agg, Measure, Trend, Unit } from '#lib/insightsUrl.ts';
import type { ConsumptionTab } from '#lib/server/insights/consumption.ts';
import type { Habits } from '#lib/server/insights/habits.ts';
import type { ChartSeries } from '#lib/chartThumb.ts';
import { formatGrams } from '#lib/grams.ts';
import { hour12 } from '#lib/hours.ts';
import { WEEKDAYS } from '#lib/insightsUrl.ts';

// Habits' fixed x labels, and the weekend bars' colour (Sat, Sun) as in the Findings bars.
export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => hour12(i, true));
export const WEEKEND_TOKENS = WEEKDAYS.map((_, i) => (i >= 5 ? '--series-brown-3' : null));
// Value formats of the Consumption charts (tip text, ui-rules 36): `k` is the kg divisor, `avg` the per-day rates' extra decimal.
export const consumptionFmt = (g: boolean, avg: boolean) => ({
  fmt: (k: number) => (v: number) => (g ? formatGrams(v * k) : `${Number.isInteger(v) ? v : v.toFixed(avg ? 2 : 1)} bag${v === 1 ? '' : 's'}`),
  brews: (v: number) => `${Number.isInteger(v) ? v : v.toFixed(avg ? 2 : 1)} brew${v === 1 ? '' : 's'}`,
  water: (v: number) => `${+v.toFixed(v >= 10 ? 0 : v >= 1 ? 1 : 2)}L`
});

export const TITLE: Record<Trend, string> = { brews: 'Brews over time', water: 'Water over time', rating: 'Rating over time' };
type S = ChartSeries & { names?: (string | null)[] };
interface One { labels: string[]; values: (number | null)[]; datasetLabel: string; series: S[]; yMin?: number; k: number }
type Brewed = One & { type: 'bar' | 'line'; title: string };

// What each Consumption chart draws, shared by the tab and its link-preview thumbnails.
// `agg` only shapes tooltips and notes (not these series), so it is accepted but unused.
export function consumptionCharts(t: ConsumptionTab, o: { unit: Unit; trend?: Trend; agg: Agg; periodLabel: string; compareLabel: string; compareDates: string }): { brewed: Brewed; bought: One; onHand: One } {
  const { trend, compareLabel, compareDates } = o;
  const g = o.unit === 'grams';
  // Grams axes switch to kg from 10 kg so ticks stay short; `k` is the divisor for one chart.
  const kOf = (...vs: readonly (number | null)[][]) => (g && Math.max(0, ...vs.flat().map((v) => v ?? 0)) >= 10000 ? 1000 : 1);
  const div = (vs: readonly (number | null)[], k: number) => vs.map((v) => (v === null ? null : v / k));
  // compareBrewed lines up with brewed by index only (a clipped previous window can be shorter):
  // pad/slice it to brewed's buckets. A compare window with no data adds no series.
  const compare = t.compareBrewed ? t.brewed.map((_, i) => t.compareBrewed![i] ?? null) : null;
  const k1 = trend ? 1 : kOf(t.brewed, compare ?? [], [t.compareAverage]);
  const k2 = kOf(t.bought, t.brewed);
  const k3 = kOf(t.backlog);
  let brewed: Brewed;
  if (trend === 'rating') {
    // The rating line: its buckets start at the calibration date under Calibrated ratings (Leaderboards' Over time does too).
    const from = t.ratingFrom;
    const values = t.brewed.slice(from);
    const series: S[] = compare?.some((v) => v) ? [{ label: compareLabel, values: compare.slice(from), faded: true, names: t.compareTitles?.slice(from) }]
      : !t.compareBrewed && t.compareAverage ? [{ label: `${compareLabel} (avg)`, values: values.map(() => t.compareAverage!), dashed: true, names: values.map(() => compareDates) }] : [];
    const lo = Math.min(...[values, ...series.map((x) => x.values)].flat().filter((v): v is number => v !== null));
    brewed = { type: 'line', title: TITLE.rating, labels: t.labels.slice(from), values, datasetLabel: o.periodLabel, series, yMin: Number.isFinite(lo) ? Math.max(0, Math.floor(lo) - 1) : undefined, k: 1 };
  } else {
    const series: S[] = [
      ...(compare?.some((v) => v)
        ? [{ label: compareLabel, values: div(compare, k1), faded: true, names: t.compareTitles ?? undefined }]
        : !t.compareBrewed && t.compareAverage
          ? [{ label: `${compareLabel} (avg)`, values: t.brewed.map(() => t.compareAverage! / k1), dashed: true, names: t.brewed.map(() => compareDates) }]
          : []),
      ...(t.trendLine ? [{ label: t.trendLabel!, values: div(t.trendLine, k1), trend: true }] : [])
    ];
    brewed = { type: 'bar', title: trend ? TITLE[trend] : 'Brewed over time', labels: t.labels, values: div(t.brewed, k1), datasetLabel: o.periodLabel, series, k: k1 };
  }
  return {
    brewed,
    bought: { labels: t.labels, values: div(t.bought, k2), datasetLabel: 'Bought', series: [{ label: g ? 'Brewed' : 'Finished', values: div(t.brewed, k2) }], k: k2 },
    onHand: { labels: t.labels, values: div(t.backlog, k3), datasetLabel: 'On hand', series: [], k: k3 }
  };
}

interface Bars { values: (number | null)[]; series: S[]; yMin?: number }
// Habits' By hour / By weekday bars (the labels are fixed, so the component keeps them).
export function habitsCharts(h: Habits, o: { measure: Measure; agg: Agg; comparing: boolean; periodLabel: string; compareLabel: string }): { hour: Bars; weekday: Bars } {
  // A compare window with no data adds no series (and no legend entry).
  const compare = (values: (number | null)[] | null): S[] => (o.comparing && values?.some((v) => v) ? [{ label: o.compareLabel, values, faded: true }] : []);
  // Ratings sit high on a 1–10 scale: fit the axis floor a point below the lowest bar.
  const yMin = (...vs: ((number | null)[] | null)[]) => {
    if (o.measure !== 'rating') return undefined;
    const lo = Math.min(...vs.flatMap((v) => v ?? []).filter((v): v is number => v !== null));
    return Number.isFinite(lo) ? Math.max(0, Math.floor(lo) - 1) : undefined;
  };
  return {
    hour: { values: h.byHour, series: compare(h.compareHour), yMin: yMin(h.byHour, h.compareHour) },
    weekday: { values: h.byWeekday, series: compare(h.compareWeekday), yMin: yMin(h.byWeekday, h.compareWeekday) }
  };
}
