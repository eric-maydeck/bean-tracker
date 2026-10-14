<script lang="ts">
  import type { RecentBrew, RecentBag } from '$lib/server/insights/overview';

  let { brews, bags }: { brews: RecentBrew[]; bags: RecentBag[] } = $props();

  const RATING_MAX = 10; // Bean Conqueror's rating scale
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rating = (r: number | null) => (r === null ? '—' : r.toFixed(1));
  const maxDays = $derived(Math.max(0, ...bags.map((b) => b.days)));
  // Both lists are padded to the longer one, so the two boards stay one height (ui-rules 31).
  const rows = $derived(Math.max(brews.length, bags.length, 1));
</script>

{#snippet who(name: string, slug: string | null, sub: string)}
  <span class="who">
    {#if slug}<a href="/coffees/{slug}" title={name}>{name}</a>{:else}<span class="name" title={name}>{name}</span>{/if}
    <small>{sub}</small>
  </span>
{/snippet}

{#snippet pad(n: number)}
  {#each { length: rows - n } as _, i (i)}
    <li class="board-row placeholder" aria-hidden="true"><span class="rank">{n + i + 1}</span><span class="who">—</span></li>
  {/each}
{/snippet}

<section class="chart-panel recent" style:--rows={rows}>
  <h2>Recent</h2>
  <div class="recent-pair">
    <div>
      <h3>Last 10 brews</h3>
      {#if brews.length}
        <ol class="board-rows">
          {#each brews as b, i (b.id)}
            <li class="board-row bar" style:--share={(b.rating ?? 0) / RATING_MAX}>
              <span class="rank">{i + 1}</span>
              {@render who(b.name ?? 'No coffee linked', b.slug, day(b.date))}
              <span class="val">{rating(b.rating)}</span>
            </li>
          {/each}
          {@render pad(brews.length)}
        </ol>
      {:else}<p class="recent-note">No brews yet.</p>{/if}
    </div>
    <div>
      <h3>Last 10 coffees finished</h3>
      {#if bags.length}
        <ol class="board-rows">
          {#each bags as b, i (b.id)}
            <li class="board-row bar" style:--share={maxDays ? b.days / maxDays : 0}>
              <span class="rank">{i + 1}</span>
              {@render who(b.name, b.slug, `${b.rating === null ? 'Unrated' : `Rated ${rating(b.rating)}`} · ${day(b.finished)}`)}
              <span class="val">{b.days} {b.days === 1 ? 'day' : 'days'}</span>
            </li>
          {/each}
          {@render pad(bags.length)}
        </ol>
      {:else}<p class="recent-note">No coffees finished yet.</p>{/if}
    </div>
  </div>
</section>

<style>
  /* Board rows and bars are :global() in +page.svelte (shared with Leaderboards). */
  .recent {
    --row-h: 3rem;
  }
  .recent-pair {
    display: grid;
    gap: var(--space-3);
  }
  @media (min-width: 641px) {
    .recent-pair {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  h3 {
    margin: 0 0 var(--space-1);
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .recent-note {
    display: grid;
    place-items: center;
    min-height: calc(var(--rows) * var(--row-h));
    margin: 0;
    color: var(--color-text-muted);
  }
  .placeholder {
    color: var(--color-text-muted);
    opacity: 0.45;
  }
</style>
