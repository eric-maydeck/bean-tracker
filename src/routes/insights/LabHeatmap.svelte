<script lang="ts">
  import Heatmap from '$lib/components/Heatmap.svelte';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import type { Breakdown } from '$lib/server/insights/lab';
  import { deltaInk, labDelta } from '$lib/components/deltaColor';
  import { TIP_TITLE, sampleField } from '$lib/sample';
  import { noMatch, plural } from './DeltaBars.svelte';

  // A lab breakdown as a diverging heatmap of same-bag deltas (green better, red worse). A small-sample cell draws
  // striped with its value; a blank one says why: no brews at all, or no match (nothing to compare).
  // `best`: per row, the column to outline. `vs`: what the delta is measured against. `noun`: a column.
  let { by, ariaLabel, best, vs = 'same bag', scale, noun = 'band' }: {
    by: Breakdown; ariaLabel: string; best?: (number | null)[]; vs?: string; scale?: [string, string]; noun?: string;
  } = $props();

  let ses = $derived(by.cells.flat().flatMap((c) => (c && c.delta !== null ? [c.se] : [])));
  const text = (x: number | null, r: number, c: number) => {
    const cell = by.cells[r][c];
    return x !== null ? `${labDelta(x, ses)}${cell?.sample.small ? ` (${TIP_TITLE})` : ''}` : !cell ? 'No brews' : 'no match';
  };
  const label = (r: number, c: number) => {
    const cell = by.cells[r][c];
    return `${by.rows[r]} · ${by.cols[c]}${cell?.brews ? ` · ${plural(cell.brews, 'brew')}, ${plural(cell.bags, 'bag')}` : ''}`;
  };
  // Cells show no numbers, so the tip leads with the delta; the counts follow.
  const tip = (r: number, c: number): Tip => {
    const cell = by.cells[r][c], title = `${by.rows[r]} · ${by.cols[c]}`;
    if (!cell) return { title, note: 'No brews.' };
    const counts: [string, string][] = [['Brews', `${cell.brews}`], ['Bags', `${cell.bags}`]];
    if (cell.delta === null) return { title, rows: counts, note: cell.brews ? noMatch(noun) : 'No brews' };
    return { title, rows: [[`vs ${vs}`, labDelta(cell.delta, ses), deltaInk(cell.delta)], ...(cell.sample.small ? [] : counts)], ...sampleField(cell.sample, true) };
  };
</script>

<Heatmap diverging rows={by.rows} cols={by.cols} cells={by.cells.map((r) => r.map((c) => c?.delta ?? null))}
  small={by.cells.map((r) => r.map((c) => !!c && c.delta !== null && c.sample.small))}
  marked={best && by.rows.map((_, i) => by.cols.map((_, j) => best[i] === j))} {text} {label} {tip} {ariaLabel} {scale} />
