<script lang="ts">
  import { page } from '$app/state';
  import type { RecapTileData } from '$lib/server/recaps/recap';
  import RecapTile from '$lib/components/RecapTile.svelte';

  // period: the Period's text when recaps exist but none overlap it; null = there is no recap at all.
  let { tiles, admin, period }: { tiles: RecapTileData[]; admin: boolean; period: string | null } = $props();
  const back = $derived(encodeURIComponent(page.url.pathname + page.url.search));
</script>

{#if tiles.length}
  <div class="recap-tiles">
    {#each tiles as t (t.year)}<RecapTile tile={t} />{/each}
  </div>
{:else}
  <section class="recaps-empty">
    <h2>{period ? `No recaps in ${period}` : 'No recaps yet'}</h2>
    <p>{period ? 'Pick a wider period to see them.' : "A year's recap appears once it has brews."}</p>
    {#if !admin}<p>Recaps for the current year are visible once you sign in. <a href="/login?redirectTo={back}">Sign in</a></p>{/if}
  </section>
{/if}

<style>
  /* Every tile is the same size whether there is 1 or 5: two across on a phone, capped at 22rem; left-aligned, never stretched. */
  .recap-tiles { display: flex; flex-wrap: wrap; gap: 10px; }
  .recap-tiles > :global(.recap-tile) { flex: 0 0 min(22rem, calc((100% - 10px) / 2)); min-width: 0; }
  .recaps-empty { max-width: 34rem; padding: var(--space-4) 0; }
  .recaps-empty h2 { margin: 0 0 var(--space-2); }
  .recaps-empty p { margin: 0 0 var(--space-2); color: var(--color-text-muted); }
</style>
