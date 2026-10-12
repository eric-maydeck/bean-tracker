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

// The grid's CSS picks --q4 / --q3 / --q2 by its own width (.hl-grid in +page.svelte).
export const rowVars = (n: number) => {
  const [a, b, c] = [4, 3, 2].map((cols) => rowSizes(n, cols));
  return a.map((_, i) => `--q4:${a[i]};--q3:${b[i]};--q2:${c[i]}`);
};
