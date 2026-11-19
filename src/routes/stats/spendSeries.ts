import type { SpendSeries as SpendData } from '#lib/server/insights/spend.ts';
import type { SpendSeries as SpendKind } from '#lib/insightsUrl.ts';
import type { ChartSeries } from '#lib/chartThumb.ts';
import { seriesToken } from '#lib/components/chartColor.ts';
import { wholeUsd } from '#lib/money.ts';

// The Spend chart's series for a selection (moved out of Spend.svelte so the link-preview thumbnail draws the same ones).
export type Kind = 'oneOff' | 'sub' | 'overall';
export const NAME: Record<Kind, string> = { oneOff: 'One-off', sub: 'Subscription', overall: 'Overall' };
// The chart's colors are its dataset order, applied fresh to each selection (ui-rules 42: the first series is the primary
// brown, then the next ones); a compare series takes its current partner's color.
// Bars: All is the stacked split (its tip adds the overall total); the $/g lines of All add the overall line.
export const kindsOf = (spendSeries: SpendKind | undefined, lineChart: boolean): Kind[] => spendSeries === 'overall' ? ['overall'] : spendSeries === 'oneoff' ? ['oneOff'] : spendSeries === 'sub' ? ['sub'] : spendSeries === 'all' && lineChart ? ['oneOff', 'sub', 'overall'] : ['oneOff', 'sub'];
const sum = (a: (number | null)[], b: (number | null)[]) => a.map((v, i) => (v ?? 0) + (b[i] ?? 0));
export type Series = { label: string; values: (number | null)[]; faded?: boolean; dashed?: boolean; names?: (string | null)[]; hue?: string };
type Vals = Record<Kind, (number | null)[]>;

// The chart's datasets for the selection: the current window's series, then the compare window's, each in its partner's
// color: bars faded, lines dashed.
export function plan(sr: SpendData, compareLabel: string, kinds: Kind[], cur: Vals, cmp: Vals | null, avg: Record<Kind, number | null> | null, lineChart: boolean) {
  const one = kinds.length === 1;
  const token = (k: Kind) => seriesToken(kinds.indexOf(k), kinds.length);
  const tone = (k: Kind) => `var(${token(k)})`;
  const own = kinds.map((k): Series => ({ label: NAME[k], values: cur[k] }));
  const past: Series[] = cmp
    ? kinds.flatMap((k) => (cmp[k].some((v) => v) ? [{ label: one ? compareLabel : `${compareLabel} · ${NAME[k]}`, values: cmp[k], hue: tone(k), ...(lineChart ? { dashed: true } : { faded: true }) }] : []))
    : avg ? kinds.flatMap((k) => (avg[k] == null ? [] : [{ label: one ? `${compareLabel} (avg)` : `${compareLabel} (avg) · ${NAME[k]}`, values: sr.labels.map(() => avg[k]), dashed: true, hue: tone(k) }])) : [];
  return { kinds, cur, cmp, avg, lineChart, token, compared: past.length > 0, first: own[0], rest: [...own.slice(1), ...past], colors: [...kinds.map(tone), ...past.filter((x) => !x.dashed).map((x) => x.hue!)] };
}

export function spendPlans(sr: SpendData, spendSeries: SpendKind | undefined, compareLabel: string) {
  const total = sum(sr.sub, sr.oneOff);
  const bars = plan(sr, compareLabel, kindsOf(spendSeries, false),
    { oneOff: sr.oneOff, sub: sr.sub, overall: total },
    sr.compareSplit ? { oneOff: sr.compareSplit.oneOff, sub: sr.compareSplit.sub, overall: sr.compare ?? [] } : null,
    sr.compareAverageSplit ? { oneOff: sr.compareAverageSplit.oneOff, sub: sr.compareAverageSplit.sub, overall: sr.compareAverage } : null, false);
  const lines = plan(sr, compareLabel, kindsOf(spendSeries, true),
    { oneOff: sr.ppg.oneOff, sub: sr.ppg.sub, overall: sr.ppg.all },
    sr.comparePpgSplit ? { oneOff: sr.comparePpgSplit.oneOff, sub: sr.comparePpgSplit.sub, overall: sr.comparePpg ?? [] } : null, null, true);
  return { total, bars, lines };
}

// Money axis: whole dollars when any amount shown (either window, any series) is $1,000 or more.
export const spendWhole = (sr: SpendData, total: (number | null)[]) => wholeUsd([...total, ...(sr.compare ?? []), sr.compareAverage]);

// The drawn chart for the view: bars (Spend) or lines ($ per g), its series in dataset order, each with its page color.
export function spendChart(sr: SpendData, o: { spendView?: 'ppg'; spendSeries?: SpendKind; compareLabel: string }): { type: 'bar' | 'line'; labels: string[]; series: ChartSeries[]; whole: boolean } {
  const { total, bars, lines } = spendPlans(sr, o.spendSeries, o.compareLabel);
  const p = o.spendView === 'ppg' ? lines : bars;
  let c = 0; // the colors list covers the non-dashed series only
  const series = [p.first, ...p.rest].map((s): ChartSeries => ({ label: s.label, values: s.values, ...(s.faded && { faded: true }), ...(s.dashed ? { dashed: true } : { color: p.colors[c++] }) }));
  return { type: p.lineChart ? 'line' : 'bar', labels: sr.labels, series, whole: spendWhole(sr, total) };
}
