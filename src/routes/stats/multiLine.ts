import type { Multi } from '#lib/server/insights/insightGenerators.ts';
import type { BoardRow, BoardSeries } from '#lib/server/insights/leaderboards.ts';
import { BAG_BOARDS, VIEW_BOARDS, lowFirst, type Board, type BoardView, type BoardViews, type Rank } from '#lib/insightsUrl.ts';

// One shared y scale over a 100×40 box (2 units of padding top and bottom).
function frame(m: Multi) {
  const vs = m.lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  const lo = vs.length ? Math.min(...vs) : 0, hi = vs.length ? Math.max(...vs) : 0, span = hi - lo || 1;
  return { lo, hi, py: (v: number) => 38 - ((v - lo) / span) * 36 };
}

// x of column i in the 100-wide box.
export const px = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);

// The categorical slots (--series-1..14 (7 hues x 2 tones: 1-7 every hue once, 8-14 the other tone), app.css; distinctness checked in palette.test.ts).
export const SLOTS = Array.from({ length: 14 }, (_, i) => `var(--series-${i + 1})`);
// A slot's text-safe variant (4.5:1 on the card): `var(--series-3)` -> `var(--series-3-ink)`.
export const inkOf = (slot: string) => slot.replace(/\)$/, '-ink)');
const OTHER = 'var(--series-other)';
// 1-3 colored series take the browns (brown, tan, sand), 4+ the slots (ui-rules 42).
// 1-3 series are the browns, light / medium / dark; two take the light and the dark (the best-separated pair); 4+ the slots.
export const brownsFor = (n: number) => (n === 2 ? [1, 3] : [1, 2, 3]).map((i) => `var(--series-brown-${i})`);
export const slotsFor = (n: number) => (n <= 3 ? brownsFor(n) : SLOTS);

// Categorical slots in line order, counted once over every series ("Other" included, so a chart's bars and lines agree);
// "Other" is muted and takes no slot.
export function seriesColors(labels: string[]) {
  let slot = 0;
  const slots = slotsFor(labels.length);
  return labels.map((l) => (l === 'Other' ? OTHER : slots[slot++ % slots.length]));
}

// A capped list in a tip: up to `max` items, then "+N more"; a single leftover item is shown rather than "+1 more"
// (it costs the same row).
export function capList<T>(items: T[], max: number): { shown: T[]; more: number } {
  const n = items.length <= max + 1 ? items.length : max;
  return { shown: items.slice(0, n), more: items.length - n };
}

// One color per name for a whole page (ui-rules 42; Water's recipes): usage lines first, in line order, then each
// pair's recipes. Every name gets its own slot while slots last; past that a name reuses a slot no name it is
// shown with uses (the lines share every bar; a pair's two share a block), so a bar or pair never repeats a color.
// "Other" (a usage segment) stays gray; its member recipes keep their own colors elsewhere.
export function nameColors(lines: string[], pairs: { a: string; b: string }[]): Map<string, string> {
  const shown = lines.filter((l) => l !== 'Other');
  const names = [...new Set([...shown, ...pairs.flatMap((p) => [p.a, p.b])])];
  const near = new Map(names.map((n) => [n, new Set<string>()]));
  const link = (a: string, b: string) => a !== b && (near.get(a)!.add(b), near.get(b)!.add(a));
  for (const a of shown) for (const b of shown) link(a, b);
  for (const p of pairs) link(p.a, p.b);
  const c = new Map<string, string>();
  const slots = slotsFor(names.length);
  const users = new Map(slots.map((v) => [v, 0]));
  for (const n of names) {
    const taken = new Set([...near.get(n)!].map((m) => c.get(m)));
    const slot = slots.find((v) => !users.get(v)) ?? slots.find((v) => !taken.has(v)) ?? slots[c.size % slots.length];
    c.set(n, slot);
    users.set(slot, users.get(slot)! + 1);
  }
  return c;
}

// A smooth path through the points (monotone cubic, ui-rules G5): tangents are the harmonic mean of the
// neighboring slopes (0 at a turn), so the curve never overshoots the data.
export function smooth(p: [number, number][]): string {
  const f = (x: number) => +x.toFixed(2);
  if (p.length < 3) return `M${p.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`;
  const d = p.slice(1).map(([x, y], i) => (y - p[i][1]) / (x - p[i][0]));
  const m = p.map((_, i) => (i === 0 ? d[0] : i === p.length - 1 ? d[i - 1] : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
  let s = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], h = (x1 - x0) / 3;
    s += `C${f(x0 + h)},${f(y0 + m[i - 1] * h)} ${f(x1 - h)},${f(y1 - m[i] * h)} ${f(x1)},${f(y1)}`;
  }
  return s;
}

// Multi-line chart: one shared y scale over a 100×40 box; a null breaks its line. Each run is an SVG path.
export function lines(m: Multi) {
  const { py } = frame(m), n = m.x.length, colors = seriesColors(m.lines.map((l) => l.label));
  return m.lines.map((l, k) => {
    const runs: string[] = [];
    let run: [number, number][] = [];
    l.values.forEach((v, i) => {
      if (v === null) { if (run.length) runs.push(smooth(run)); run = []; return; }
      run.push([px(i, n), py(v)]);
      if (run.length === 1 && (l.values[i + 1] ?? null) === null) run.push([px(i, n) + 0.8, py(v)]); // a lone point: a dash
    });
    if (run.length) runs.push(smooth(run));
    return { label: l.label, runs, color: inkOf(colors[k]) }; // strokes use the -ink token
  });
}

// Leaderboards' Over time: what a board draws, shared by the page and its link-preview thumbnail. `view` is the
// page's pick (Over time for a switched board and always for Caffeine), `pool` every group's line (lowest first under Lowest first).
export const boardSize = (b: Board) => (b === 'roasters' || b === 'coffees' || b === 'origins' || b === 'varieties' || b === 'producers' ? 10 : 5);
interface BoardOpts { board: Board; low: Board[]; open: Board[]; views?: BoardViews; rank: Rank }
export function boardView(rows: BoardRow[], sr: BoardSeries | undefined, o: BoardOpts) {
  const b = o.board, fixed = b === 'caffeine';
  const ordered = o.low.includes(b) && !fixed ? lowFirst(b, rows) : rows;
  const pool = !(o.low.includes(b) && !fixed) ? (sr?.lines ?? []) : ordered.flatMap((r) => sr?.lines.find((l) => l.label === r.label) ?? []);
  const unranked = (o.rank === 'spend' || o.rank === 'ppg') && !BAG_BOARDS.includes(b);
  const switchable = (VIEW_BOARDS as readonly Board[]).includes(b) && !unranked && rows.length > 0;
  const pick = switchable ? (o.views as Partial<Record<Board, BoardView>> | undefined)?.[b] : undefined;
  const view = pick || fixed ? 'time' : 'list';
  const lines = o.open.includes(b) ? pool : pool.slice(0, boardSize(b));
  return { ordered, pool, unranked, switchable, pick, view, lines } as const;
}
// The lines the page draws for this board, or null when it draws the List, a note or nothing.
export function boardTimeLines(rows: BoardRow[], sr: BoardSeries | undefined, o: BoardOpts) {
  const v = boardView(rows, sr, o);
  return v.view === 'time' && !v.unranked && rows.length && sr && v.lines.length && sr.labels.length ? { labels: sr.labels, lines: v.lines } : null;
}
