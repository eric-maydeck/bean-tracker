<script lang="ts">
  import { formatDate } from '$lib/formatDate';
  import { RATING_MAX } from '$lib/rating';
  import WholeNote from './WholeNote.svelte';
  import { labelTip, followTip } from '$lib/components/labelTip';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import { type BrewFilterKey, type InsightsUrlState, type Top } from '$lib/insightsUrl';
  import type { RecentBrew, RecentBag } from '$lib/server/insights/overview';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import ShowMore from './ShowMore.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';

  let { brews, bags, n, nc, choose, wholeKeys }: {
    wholeKeys: BrewFilterKey[]; brews: RecentBrew[]; bags: RecentBag[]; n: Top | undefined; nc: Top | undefined; choose: (c: InsightsUrlState) => void;
  } = $props();

  const day = formatDate;
  const rating = (r: number | null) => (r === null ? '—' : r.toFixed(1));
  // Each list shows 10, 20 or 50 (the server sends 50); Show more / Show less steps between them.
  const shownBrews = $derived(brews.slice(0, n ?? 10));
  const shownBags = $derived(bags.slice(0, nc ?? 10));

  // The row tip (coffee and roaster) follows the pointer over the filled part of the bar only: a transparent .hit span
  // laid over the bar (inside the link, so a click still opens the coffee). No bar (unrated) = no row tip.
  const rowTip = (name: string, roaster: string | null): Tip => ({ title: name, rows: roaster ? [['Roaster', roaster]] : undefined });
</script>

{#snippet who(name: string, slug: string | null, sub: string, roaster: string | null, filled: boolean)}
  {#snippet hit()}{#if filled}<span class="hit" use:followTip={rowTip(name, roaster)}></span>{/if}{/snippet}
  <span class="who">
    {#if slug}<a href="/coffees/{slug}"><CoffeeName {name} />{@render hit()}</a>{:else}<span class="name"><CoffeeName {name} />{@render hit()}</span>{/if}
    <small>{sub}</small>
  </span>
{/snippet}

<section class="chart-panel recent">
  <HeadingAnchor id="overview-recent">Recent</HeadingAnchor>
  <div class="board-row board-head"><h3>Last {shownBrews.length} brews</h3><span class="val">Rating</span></div>
  {#if brews.length}
    <ol class="board-rows">
      {#each shownBrews as b, i (b.id)}
        <li class="board-row bar" style:--share={(b.rating ?? 0) / RATING_MAX}>
          <span class="rank">{i + 1}</span>
          {@render who(b.name ?? 'No coffee linked', b.slug, b.roaster ? `${b.roaster} · ${day(b.date)}` : day(b.date), b.roaster, !!b.rating)}
          <span class="val" use:labelTip={b.tip}>{rating(b.rating)}</span>
        </li>
      {/each}
    </ol>
    <ShowMore count={brews.length} {n} set={(v) => choose({ recent: v })} />
  {:else}<p class="recent-note">No brews yet.</p>{/if}
  <div class="board-row board-head second"><h3>Last {shownBags.length} coffees finished</h3><span class="val">Rating</span></div>
  <!-- Led by the coffee's rating (bar on the 10 scale, as for brews); how long it was open and when it ran out under its name. -->
  {#if bags.length}
    <ol class="board-rows">
      {#each shownBags as b, i (b.id)}
        <li class="board-row bar" style:--share={(b.rating ?? 0) / RATING_MAX}>
          <span class="rank">{i + 1}</span>
          {@render who(b.name, b.slug, `Open for ${b.days} ${b.days === 1 ? 'day' : 'days'} · Finished ${day(b.finished)}`, b.roaster, !!b.rating)}
          <span class="val" use:labelTip={b.tip}>{rating(b.rating)}</span>
        </li>
      {/each}
    </ol>
    <ShowMore count={bags.length} n={nc} set={(v) => choose({ recentc: v })} />
  {:else}<p class="recent-note">No coffees finished yet.</p>{/if}
  {#if wholeKeys.length}<WholeNote keys={wholeKeys} />{/if}
</section>

<style>
  /* Board rows and bars are :global() in +page.svelte (shared with Leaderboards). */
  .recent {
    --row-h: 3rem;
  }
  /* The tip's hit area: the bar's footprint, above the link's stretched overlay and the text (still inside the link: a click opens the coffee). */
  .hit {
    position: absolute;
    z-index: 1;
    inset: 3px auto 3px 0;
    width: calc(var(--share) * 100%);
  }
  /* The rating sits above the link's overlay so its own tip opens. */
  .recent :global(.board-row .val) {
    position: relative;
    z-index: 1;
  }
  .second {
    margin-top: var(--space-4);
  }
  /* Two columns on wider screens, filled a row at a time (1 left, 2 right, 3 left ...); one column on phones. */
  .recent :global(.board-rows) {
    display: grid;
    column-gap: var(--space-5);
  }
  @media (min-width: 641px) {
    .recent :global(.board-rows) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .recent :global(.board-rows > .board-row:nth-child(2)) {
      border-top: 0;
    }
  }
  /* The board's title and its value column's label share one line over the rows (LabBoard's head). */
  .board-head {
    height: auto;
    padding-bottom: var(--space-1);
    border-top: 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
  .board-head + .board-rows > :global(.board-row:first-child) {
    border-top: 0;
  }
  .board-head .val {
    font-weight: normal;
    white-space: nowrap;
  }
  h3 {
    grid-column: 1 / 3;
    margin: 0;
    font-size: 0.85rem;
  }
  .recent-note {
    display: grid;
    place-items: center;
    min-height: var(--row-h);
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
