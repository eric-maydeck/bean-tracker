// Card grids fill every row (ui-rules 33): n cards at up to `cols` per row are spread over as few
// rows as fit, evenly, the fuller rows first (13 at 4 → 4, 3, 3, 3; never a lone 13th card).
// At 2 columns an odd count can't split evenly: one row takes 3 rather than leave a lone card (9 → 3, 2, 2, 2).
// Returns each card's row length.
export function rowSizes(n: number, cols: number): number[] {
  let rows = Math.ceil(n / cols);
  if (n > 1 && n < 2 * rows) rows--; // some row would hold a single card
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
// rows of 4/5 → --fs-s4 / --fs-l4, rows of 3 → --fs-3 (--fs-p3 on a 2-column grid), rows of 2 → --fs-s2 / --fs-l2.
export function sizedGrid<T>(items: T[], large: (x: T) => boolean) {
  const n = items.length, nL = items.filter(large).length;
  const cls = (x: T) => (Math.min(nL, n - nL) === 1 || large(x) ? 'l' : 's');
  const lead = n ? cls(items[0]) : 's';
  const groups = [items.filter((x) => cls(x) === lead), items.filter((x) => cls(x) !== lead)];
  const h = (len: number, cols: number, k: string) => (len === 3 ? (cols === 2 ? 'p3' : '3') : `${k}${len > 3 ? 4 : 2}`);
  return groups.flatMap((g) => {
    const vars = rowVars(g.length), [a, b, c] = [4, 3, 2].map((cols) => rowSizes(g.length, cols));
    return g.map((item, i) => {
      const k = cls(item), h5 = g.length === 5 ? `${k}4` : h(a[i], 4, k);
      const hs = `--h5:var(--fs-${h5});--h4:var(--fs-${h(a[i], 4, k)});--h3:var(--fs-${h(b[i], 3, k)});--h2:var(--fs-${h(c[i], 2, k)})`;
      return { item, size: k, style: `${vars[i]};${hs}` };
    });
  });
}
