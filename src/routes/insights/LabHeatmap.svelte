<script lang="ts">
  import Heatmap from '$lib/components/Heatmap.svelte';
  import type { Breakdown } from '$lib/server/insights/lab';
  import { plural, signed } from './DeltaBars.svelte';

  // A lab breakdown as a diverging heatmap of same-bag deltas. A thin cell draws faded with its value;
  // a blank one says why: no brews at all, or none paired (nothing to compare).
  let { by, ariaLabel }: { by: Breakdown; ariaLabel: string } = $props();

  const text = (x: number | null, r: number, c: number) => {
    const cell = by.cells[r][c];
    return x !== null ? `${signed(x)}${cell?.solid ? '' : ' (few brews)'}` : !cell ? 'No brews' : 'No paired brews';
  };
  const label = (r: number, c: number) => {
    const cell = by.cells[r][c];
    return `${by.rows[r]} · ${by.cols[c]}${cell?.brews ? ` · ${plural(cell.brews, 'brew')}, ${plural(cell.bags, 'bag')}` : ''}`;
  };
</script>

<Heatmap diverging rows={by.rows} cols={by.cols} cells={by.cells.map((r) => r.map((c) => c?.delta ?? null))}
  faded={by.cells.map((r) => r.map((c) => !!c && c.delta !== null && !c.solid))} {text} {label} {ariaLabel} />
