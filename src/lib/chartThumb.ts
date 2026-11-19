import { THUMB_TOKENS, type Thumb, type ThumbSeries } from './linkPreview';
import { seriesToken } from './components/chartColor';

export interface ChartSeries { label: string; values: (number | null)[]; color?: string; faded?: boolean; dashed?: boolean; trend?: boolean } // color: 'var(--series-x)' or '--series-x'

const MAX_POINTS = 40, MAX_SERIES = 3;
const tokenIdx = (t: string) => THUMB_TOKENS.indexOf(t.replace(/^var\(|\)$/g, '') as never);
const clip = (s: string) => (s.length > 80 ? s.slice(0, 79) + '…' : s);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// A chart's shape for a link-preview card: overlays dropped, <=3 series, <=40 points, ints 0..100 (see Global Constraints, #123).
export function chartThumb(kind: 'vbars' | 'lines', series: ChartSeries[], opts: { stacked?: boolean; yMin?: number } = {}): Thumb | null {
  const stacked = kind === 'vbars' && !!opts.stacked;
  // Chart.svelte's palette size: the first series plus every non-dashed one after it.
  const paletteCount = 1 + series.slice(1).filter((s) => !s.dashed).length;
  let kept = series.map((s, i) => ({ s, i })).filter(({ s }) => !s.faded && !s.dashed && !s.trend)
    .map(({ s, i }) => ({ label: clip(s.label), values: s.values.map((v) => (v != null && Number.isFinite(v) ? v : null)), color: s.color && tokenIdx(s.color) >= 0 ? tokenIdx(s.color) : tokenIdx(seriesToken(i % 14, paletteCount)) }));
  if (!kept.length) return null;
  if (stacked && kept.length > MAX_SERIES) {
    const rest = kept.slice(MAX_SERIES - 1), len = Math.max(...rest.map((r) => r.values.length));
    const sum = Array.from({ length: len }, (_, k) => { const v = rest.map((r) => r.values[k]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; });
    kept = [...kept.slice(0, MAX_SERIES - 1), { label: 'Other', values: sum, color: tokenIdx('--series-other') }];
  } else kept = kept.slice(0, MAX_SERIES);
  if (kind === 'lines') { // drop leading and trailing columns where every kept series is null
    const live = (k: number) => kept.some((c) => c.values[k] != null), len = Math.max(...kept.map((c) => c.values.length));
    let a = 0, b = len;
    while (a < b && !live(a)) a++;
    while (b > a && !live(b - 1)) b--;
    kept = kept.map((c) => ({ ...c, values: Array.from({ length: b - a }, (_, k) => c.values[a + k] ?? null) }));
  }
  if (kept.length === 1) kept[0].color = tokenIdx('--series-11');

  const n = Math.max(...kept.map((k) => k.values.length));
  if (n < 2 || kept.every((k) => k.values.every((v) => v == null))) return null;
  // Lines sample points (first and last kept); bars average equal buckets (nulls ignored, an empty bucket is 0).
  const down = (vals: (number | null)[]): (number | null)[] => {
    const v = Array.from({ length: n }, (_, k) => vals[k] ?? null);
    if (n <= MAX_POINTS) return kind === 'vbars' ? v.map((x) => x ?? 0) : v;
    return Array.from({ length: MAX_POINTS }, (_, i) => kind === 'lines' ? v[Math.round(i * (n - 1) / (MAX_POINTS - 1))]
      : mean(v.slice(Math.floor(i * n / MAX_POINTS), Math.floor((i + 1) * n / MAX_POINTS)).filter((x): x is number => x != null)));
  };
  const cols = kept.map((k) => ({ ...k, values: down(k.values) }));
  const all = cols.flatMap((c) => c.values).filter((x): x is number => x != null);
  let lo: number, hi: number;
  if (kind === 'lines') { lo = opts.yMin ?? Math.min(...all); hi = Math.max(...all); }
  else {
    lo = opts.yMin ?? 0;
    hi = stacked ? Math.max(...cols[0].values.map((_, k) => cols.reduce((a, c) => a + (c.values[k] ?? 0), 0))) : Math.max(...all);
  }
  const scale = (v: number | null) => v == null ? null : hi <= lo ? (kind === 'lines' ? 50 : 0) : Math.round(Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)));
  const out: ThumbSeries[] = cols.map((c) => ({ label: c.label, color: c.color, values: c.values.map(scale) }));
  return kind === 'lines' ? { kind, series: out } : { kind, series: out, ...(stacked && { stacked: true }) };
}
