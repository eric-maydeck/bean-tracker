<script lang="ts">
  import type { RecapTileData } from '$lib/server/recaps/recap';
  import RecapTile from '$lib/components/RecapTile.svelte';

  let { tiles, empty }: { tiles: RecapTileData[]; empty?: string } = $props();
</script>

{#if tiles.length}
  <div class="recap-tiles">
    {#each tiles as t (t.year)}<RecapTile tile={t} />{/each}
  </div>
{:else if empty}
  <p class="chart-note">{empty}</p>
{/if}

<style>
  /* Every tile is the same size whether there is 1 or 5: two across on a phone, capped at 22rem; left-aligned, never stretched. */
  .recap-tiles { display: flex; flex-wrap: wrap; gap: 10px; }
  .recap-tiles > :global(.recap-tile) { flex: 0 0 min(22rem, calc((100% - 10px) / 2)); min-width: 0; }
</style>
