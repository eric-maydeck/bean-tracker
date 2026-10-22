// Card grids fill every row (ui-rules 33): n cards at up to `cols` per row are spread over as few
// rows as fit, evenly, the fuller rows first (13 at 4 → 4, 3, 3, 3; never a lone 13th card).
// At 2 columns (phones) a row never takes 3 (each card keeps room to show more than its title, T5): an
// odd count ends in one card spanning the full row (9 → 2, 2, 2, 2, 1).
// Returns each card's row length.
export function rowSizes(n: number, cols: number): number[] {
  let rows = Math.ceil(n / cols);
  if (cols > 2 && n > 1 && n < 2 * rows) rows--; // some row would hold a single card
  const base = Math.floor(n / rows), extra = n % rows;
  return Array.from({ length: rows }, (_, r) => (r < extra ? base + 1 : base)).flatMap((q) => Array(q).fill(q));
}

// The grid's CSS picks --q5 / --q4 / --q3 / --q2 by its own width (.hl-grid in +page.svelte). Five cards
// on a very wide grid make one row of five, not 3 + 2 (two cards would stretch to half the page each);
// --q5 is --q4 for every other count.
export const rowVars = (n: number) => {
  const [a, b, c] = [4, 3, 2].map((cols) => rowSizes(n, cols));
  return a.map((_, i) => `--q5:${n === 5 ? 5 : a[i]};--q4:${a[i]};--q3:${b[i]};--q2:${c[i]}`);
};

// Findings card sizes (ui-rules 34): a card is LARGE-content (a chart or a versus split) or SMALL-content.
// Each class packs into its own rows (rowSizes, order kept), the strongest card's class first. A class of
// one card can't fill a row, so then every card is sized LARGE (a lone chart won't fit SMALL).
// Each card gets its row's height token per column count (--h2..--h5, picked by +page.svelte like --q):
// rows of 4/5 → --fs-s4 / --fs-l4, rows of 3 → --fs-3, rows of 1–2 → --fs-s2 / --fs-l2.
export function sizedGrid<T>(items: T[], large: (x: T) => boolean) {
  const n = items.length, nL = items.filter(large).length;
  const cls = (x: T) => (Math.min(nL, n - nL) === 1 || large(x) ? 'l' : 's');
  const lead = n ? cls(items[0]) : 's';
  const groups = [items.filter((x) => cls(x) === lead), items.filter((x) => cls(x) !== lead)];
  const h = (len: number, k: string) => (len === 3 ? '3' : `${k}${len > 3 ? 4 : 2}`);
  return groups.flatMap((g) => {
    const vars = rowVars(g.length), [a, b, c] = [4, 3, 2].map((cols) => rowSizes(g.length, cols));
    return g.map((item, i) => {
      const k = cls(item), h5 = g.length === 5 ? `${k}4` : h(a[i], k);
      const hs = `--h5:var(--fs-${h5});--h4:var(--fs-${h(a[i], k)});--h3:var(--fs-${h(b[i], k)});--h2:var(--fs-${h(c[i], k)})`;
      return { item, size: k, style: `${vars[i]};${hs}` };
    });
  });
}

// The /insights filter bar's phone grid (gate r2 A3): controls in order, each `w` cells wide, packed `cols` per row.
// A control that doesn't fit what's left of its row starts the next one and the control before it widens to the
// row end, and the last widens to its row end: every row is full, no hole. Returns each control's span.
export function packSpans(items: readonly (readonly [string, number])[], cols: number): Record<string, number> {
  const out: Record<string, number> = {};
  let col = 0, prev = '';
  for (const [k, w] of items) {
    if (col && col + w > cols) { out[prev] += cols - col; col = 0; }
    out[k] = Math.min(w, cols);
    col = (col + out[k]) % cols;
    prev = k;
  }
  if (col && prev) out[prev] += cols - col;
  return out;
}

// Row vars for a grid with expanded cards: an expanded card spans its own row, each run of collapsed cards
// between them fills its own rows.
export function segmentVars(expanded: readonly boolean[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < expanded.length; ) {
    if (expanded[i]) { out.push('--q5:1;--q4:1;--q3:1;--q2:1'); i++; continue; }
    let j = i;
    while (j < expanded.length && !expanded[j]) j++;
    out.push(...rowVars(j - i));
    i = j;
  }
  return out;
}
