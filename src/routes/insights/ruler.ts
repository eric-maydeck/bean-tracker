import { MON } from '$lib/insightsUrl';

// The Milestones timeline ruler: every calendar month from the newest to the oldest with
// milestones, newest first like the feed, each at the centre of its equal band (p: 0..1).
// Major (labelled) ticks every 1 / 3 / 6 / 12 months, whichever lets the labels fit `len` px at
// `size` px each. `target` is the month a click on the tick jumps to: itself, or the nearest
// earlier month with milestones.
export interface Tick { ym: string; label: string; p: number; major: boolean; target: string }

const idx = (ym: string) => +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1;
const ymOf = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;

export function rulerTicks(months: readonly string[], len: number, size: number): Tick[] {
  if (!months.length) return [];
  const hi = idx(months[0]), lo = idx(months[months.length - 1]), n = hi - lo + 1;
  const have = new Set(months), fit = Math.max(1, Math.floor(len / size));
  const stride = [1, 3, 6, 12].find((s) => Math.ceil(n / s) <= fit) ?? 12 * Math.ceil(n / fit / 12);
  const out: Tick[] = [];
  let target = months[months.length - 1];
  for (let k = lo; k <= hi; k++) {
    const ym = ymOf(k);
    if (have.has(ym)) target = ym;
    out.push({ ym, label: `${MON[k % 12]} ${Math.floor(k / 12)}`, p: (hi - k + 0.5) / n, major: k % stride === 0, target });
  }
  out.reverse();
  if (!out.some((t) => t.major)) out[0].major = true; // a short span between majors still gets a label
  return out;
}

// The tick under a point a fraction f along the ruler.
export const tickAt = (ticks: readonly Tick[], f: number) => ticks[Math.min(ticks.length - 1, Math.max(0, Math.floor(f * ticks.length)))];

// Feed sections (one per month with milestones, newest first), in one coordinate space, top-down.
export interface Section { ym: string; top: number; bottom: number }

// A fraction along the ruler → a point in the feed: as far through that month's section as the
// point is through its band. An empty month lands on the start of the earlier month it jumps to.
export function rulerToFeed(ticks: readonly Tick[], secs: readonly Section[], f: number): number | null {
  if (!ticks.length) return null;
  const n = ticks.length, x = Math.min(n, Math.max(0, f * n)), i = Math.min(n - 1, Math.floor(x)), t = ticks[i];
  const s = secs.find((s) => s.ym === t.target);
  if (!s) return null;
  return s.top + (t.ym === t.target ? x - i : 0) * (s.bottom - s.top);
}

// The inverse: a point in the feed → a fraction along the ruler (0 above the feed, 1 below it).
export function feedToRuler(ticks: readonly Tick[], secs: readonly Section[], y: number): number {
  if (!ticks.length || !secs.length || y <= secs[0].top) return 0;
  const last = secs[secs.length - 1];
  if (y >= last.bottom) return 1;
  const s = secs.findLast((s) => s.top <= y)!;
  const k = ticks.findIndex((t) => t.ym === s.ym);
  return (k + Math.min(1, (y - s.top) / Math.max(1, s.bottom - s.top))) / ticks.length;
}
