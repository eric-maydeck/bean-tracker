// Pours tab helpers: canonical band order for the words tables, and the two-column assignment of the Technique cards.

// Agitation bands in their Technique order: High, Medium, Low, a Mixed sequence ("High then Low"), then Mixed (other).
const agRank = (l: string): [number, string] =>
  l === 'High' ? [0, ''] : l === 'Medium' ? [1, ''] : l === 'Low' ? [2, ''] : l === 'Mixed (other)' ? [5, ''] : l === 'Mixed' ? [3, ''] : [4, l];
export const sortAgitation = (labels: Iterable<string>): string[] =>
  [...new Set(labels)].sort((a, b) => { const [x, y] = [agRank(a), agRank(b)]; return x[0] - y[0] || x[1].localeCompare(y[1]); });

// Contact bands ascending: "< 1:30", "1:30–1:59", ..., "4:30+" by their first time.
const secs = (l: string): number => {
  const m = /(\d+):(\d{2})/.exec(l);
  return m ? +m[1] * 60 + +m[2] - (l.startsWith('<') ? 0.5 : 0) : Infinity;
};
export const sortContact = (labels: Iterable<string>): string[] => [...new Set(labels)].sort((a, b) => secs(a) - secs(b));

// Two columns of cards: the split of `ids` (reading order kept as far as it costs little) whose column heights differ least.
// Cost = height difference + MISMATCH per card off its reading-order column (card i left-to-right: column i % 2).
export const MISMATCH = 30;
export function assignCols(ids: readonly string[], height: (id: string) => number, gap = 12): [string[], string[]] {
  const n = ids.length;
  let best: { cost: number; mask: number } | null = null;
  for (let mask = 0; mask < 1 << n; mask++) {
    const h = [0, 0];
    let off = 0;
    ids.forEach((id, i) => { const c = (mask >> i) & 1; h[c] += height(id) + gap; off += +(c !== i % 2); });
    const cost = Math.abs(h[0] - h[1]) + MISMATCH * off;
    if (!best || cost < best.cost) best = { cost, mask };
  }
  const out: [string[], string[]] = [[], []];
  ids.forEach((id, i) => out[((best?.mask ?? 0) >> i) & 1].push(id));
  return out;
}
