import { chartThumb } from '#lib/chartThumb.ts';
import type { Eras } from '#lib/server/insights/lab.ts';
import { nameColors, seriesColors } from '../multiLine';
import type { ThumbCtx, ThumbFn } from '../thumbTypes';

const clip = (s: string) => (s.length > 80 ? s.slice(0, 79) + '…' : s);

// The page's choice: Lines (UsageChart's yMin 0) or the 100%-stacked bars.
function erasThumb(m: Eras | null | undefined, lines: boolean, colors: string[]) {
  if (!m) return null;
  return chartThumb(lines ? 'lines' : 'vbars', m.lines.map((l, i) => ({ label: clip(l.label), values: l.values, color: colors[i] })), lines ? { yMin: 0 } : { stacked: true });
}

export const ERAS_THUMBS: Record<string, ThumbFn> = {
  'gear-eras': (c: ThumbCtx) => {
    const g = c.data.gear, m = g && (c.s.gearBy === 'grinder' ? g.grinderEras : g.eras);
    const thumb = erasThumb(m, c.s.gearView === 'lines', seriesColors(m?.lines.map((l) => l.label) ?? []));
    return thumb && { title: 'Gear usage over time', thumb };
  },
  'water-eras': (c: ThumbCtx) => {
    const w = c.data.water, m = w?.eras;
    const col = m && nameColors(m.lines.map((l) => l.label), w.pairs);
    const thumb = erasThumb(m, c.s.waterView === 'lines', m?.lines.map((l) => col!.get(l.label) ?? 'var(--series-other)') ?? []);
    return thumb && { title: 'Water usage over time', thumb };
  }
};
