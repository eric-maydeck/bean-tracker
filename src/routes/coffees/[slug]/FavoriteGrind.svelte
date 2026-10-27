<script lang="ts">
  import type { FavoriteGrind } from '$lib/server/favoriteGrind';

  // The Timing section's "Favorite grind": per grinder used on this bag, the setting of its highest-rated brew
  // (ties: the latest), with the rating and dripper; a grinder with brews and no ratings shows its count.
  let { items }: { items: FavoriteGrind[] } = $props();
</script>

<div class="stat fave" data-testid="favorite-grind">
  <span class="stat-label">Favorite grind</span>
  <ul class="stat-value fave-list">
    {#each items as g (g.grinder)}
      <li>
        <strong class="g">{g.grinder}</strong>
        {#if g.best}
          <span class="seg">· {g.best.setting ?? '—'}</span> <span class="seg">· {g.best.rating}{#if g.best.dripper}{' '}({g.best.dripper}){/if}</span>
        {:else}
          <span class="seg">· {g.brews} {g.brews === 1 ? 'brew' : 'brews'}, no ratings</span>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .fave-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .fave-list li {
    font-weight: 400;
    overflow-wrap: anywhere;
  }
  .g {
    font-weight: 600;
  }
  .seg {
    display: inline-block;
    max-width: 100%;
  }
</style>
