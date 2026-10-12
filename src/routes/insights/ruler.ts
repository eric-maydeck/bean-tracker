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
