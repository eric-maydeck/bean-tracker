<script lang="ts">
  import type { RecapTileData } from '$lib/server/recaps/recap';
  import RecapTile from '$lib/components/RecapTile.svelte';

  let { tiles }: { tiles: RecapTileData[] } = $props();

  // Columns at 1 / 2 / 3 wide (CSS vars, so the right layout is there before hydration): the most that fit and leave
  // no row with a lone tile (tiles in the last row grow to close it). 1 tile = 1 column.
  const cols = (n: number, max: number) => {
    for (let c = Math.min(max, n); c > 1; c--) if (n % c !== 1) return c;
    return n > 1 ? Math.min(max, n) : 1;
  };
</script>

<div class="recaps">
  <div class="recap-tiles" style:--c1={cols(tiles.length, 2)} style:--c2={cols(tiles.length, 3)} style:--c3={cols(tiles.length, 4)}>
    {#each tiles as t (t.year)}<RecapTile tile={t} />{/each}
  </div>
</div>

<style>
  .recaps { container-type: inline-size; }
  /* Phones get 2 across (a tile is a mini poster); 3 from 620px, 4 from 900px. Flex-grow closes the last row. */
  .recap-tiles { --c: var(--c1); display: flex; flex-wrap: wrap; gap: 10px; }
  .recap-tiles > :global(.recap-tile) { flex: 1 1 calc((100% - (var(--c) - 1) * 10px) / var(--c) - 0.5px); min-width: 0; }
  @container (min-width: 620px) { .recap-tiles { --c: var(--c2); } }
  @container (min-width: 900px) { .recap-tiles { --c: var(--c3); } }
</style>
