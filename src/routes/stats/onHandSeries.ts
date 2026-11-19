import { formatGrams } from '#lib/grams.ts';
import type { Unit, WaitBy } from '#lib/insightsUrl.ts';
import type { OnHandTab, WaitRow } from '#lib/server/insights/onHand.ts';
import type { ChartSeries } from '#lib/chartThumb.ts';

// Shared by OnHand.svelte, RunwayChart.svelte, +page.svelte and the link-preview thumbs (thumbs/onhand.ts).

// Age profile: waiting bags by days since roast, split by where that age sits in the roaster's rest window.
export const AGE_SERIES = [['before', 'Before rest window'], ['inside', 'In rest window'], ['past', 'Past rest window'], ['noWindow', 'No rest window']] as const;
// The series' palette slots: Past rest window takes a red slot, clearly apart from the purple of In rest window.
export const AGE_TOKENS = ['--series-1', '--series-2', '--series-10', '--series-4'] as const;

export const unitFmt = (unit: Unit) => (v: number) => (unit === 'grams' ? formatGrams(v) : `${+v.toFixed(1)} bag${v === 1 ? '' : 's'}`);

export function ageChart(t: OnHandTab, unit: Unit): { labels: string[]; series: ChartSeries[] } {
  const split = unit === 'grams' ? t.age.grams : t.age.bags;
  return { labels: t.age.labels, series: AGE_SERIES.map(([k, label], i) => ({ label, values: split[k], color: `var(${AGE_TOKENS[i]})` })) };
}

// Bag states: every open and backlog bag in one state (a freeze beats open/waiting), counted in bags or grams.
export const STATES = [['open', 'Open'], ['waiting', 'Unopened'], ['frozen', 'Frozen']] as const;
export const stateRows = (t: OnHandTab, unit: Unit): { labels: string[]; values: number[] } =>
  ({ labels: STATES.map(([, n]) => n), values: STATES.map(([k]) => (unit === 'grams' ? t.states[k].grams : t.states[k].bags)) });

export const waitingRows = (t: OnHandTab, waitBy?: WaitBy): WaitRow[] => t.waiting.by[waitBy ?? 'roaster'];

// "last 12 months pace"; a custom window's dates stay as they are.
export const paceName = (range: string, periodLabel: string) =>
  range === 'all' || /^[A-Z][a-z]{2} \d/.test(periodLabel) ? periodLabel : periodLabel.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
export const runwayPaces = (o: { range: string; periodLabel: string; runwayDays: number | null; allDays: number | null }): { name: string; days: number | null }[] =>
  [...(o.range === 'all' ? [] : [{ name: paceName(o.range, o.periodLabel), days: o.runwayDays }]), { name: 'all-time pace', days: o.allDays }];

const POINTS = 40;
export const dayLabel = (today: string, n: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
// Grams on the shelf from today to zero, one straight line per pace, each ending on its run-out day.
export function runwaySeries(onHandG: number, today: string, paces: { name: string; days: number | null }[]) {
  const lines = paces.flatMap((p) => (p.days === null ? [] : [{ name: p.name, days: p.days }]));
  if (!lines.length) return null;
  const last = Math.max(0, ...lines.map((l) => l.days));
  // Evenly spaced days, plus today and every run-out day, so each line lands exactly on zero.
  const days = [...new Set([...Array.from({ length: POINTS + 1 }, (_, i) => Math.round((last * i) / POINTS)), ...lines.map((l) => l.days)])].sort((a, b) => a - b);
  const left = (l: { days: number }, d: number) => (d > l.days ? null : (onHandG * (l.days - d)) / l.days);
  return {
    days, lines, left, labels: days.map((d) => dayLabel(today, d)),
    series: lines.map((l) => ({ label: `${l.name} · out ${dayLabel(today, l.days)}`, values: days.map((d) => left(l, d)) }))
  };
}
