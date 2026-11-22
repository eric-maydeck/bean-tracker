<script lang="ts">
  import { backdrop } from '#lib/imageBackdrop.ts';

  // The Gear tab's way to /gear: one link, a row of the active gear's photos, the blurb and a button-style span. The
  // row holds as many tiles as its measured width allows (one line, no wrap); "+N more" counts every other piece.
  let { panel }: { panel: { shown: { key: string; name: string; image: { src: string; fill: string } }[]; total: number } } = $props();
  const TILE = 64, GAP = 8, MORE = 96; // px: a tile, the gap between, the room kept for "+N more" (--tile in the css matches)
  let w = $state(0); // 0 until measured (server render): show them all, the row clips
  const cap = (room: number) => Math.max(0, Math.floor((room + GAP) / (TILE + GAP)));
  let visible = $derived(!w ? panel.shown.length
    : panel.shown.length <= cap(w) && panel.shown.length === panel.total ? panel.shown.length : Math.min(panel.shown.length, cap(w - MORE)));
  let more = $derived(panel.total - visible);
</script>

<section class="chart-panel gear-panel" id="gear-trophies" data-section="gear-trophies">
  <a class="gear-panel-link" href="/gear">
    <h2>Your gear</h2>
    <div class="tiles" bind:clientWidth={w}>
      {#each panel.shown.slice(0, visible) as g (g.key)}
        <span class="tile" style:--fill={backdrop(g.image.fill)}><img src={g.image.src} alt="" loading="lazy" /></span>
      {/each}
      {#if more > 0}<span class="more">+{more} more</span>{/if}
    </div>
    <p class="blurb">Browse your drippers, grinders and filters, and see or edit their details, on the Gear page.</p>
    <span class="button go">Open the Gear page →</span>
  </a>
</section>

<style>
  /* The link is the panel: the padding moves onto it so the whole card is the click target. */
  .gear-panel {
    padding: 0;
    overflow: hidden;
  }
  .gear-panel-link {
    display: block;
    padding: var(--space-4);
    color: inherit;
    text-decoration: none;
  }
  .gear-panel-link:hover,
  .gear-panel-link:focus-visible {
    background: var(--color-bg);
  }
  .gear-panel-link:hover .go,
  .gear-panel-link:focus-visible .go {
    background: var(--button-hover-bg);
    color: var(--button-hover-fg);
  }
  h2 {
    margin: 0 0 var(--space-3);
  }
  .tiles {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    white-space: nowrap;
  }
  /* A square on the photo's own backdrop, contained (ui-rules 18), the same look as the gear cards. */
  .tile {
    flex: 0 0 64px;
    height: 64px;
    position: relative;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--fill);
  }
  .tile img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: var(--fill);
  }
  .more {
    flex: none;
    padding-inline: var(--space-2);
    color: var(--color-text-muted);
  }
  .blurb {
    margin: var(--space-3) 0;
    color: var(--color-text-muted);
  }
  .go {
    margin: 0;
    float: right;
  }
  .gear-panel-link::after {
    content: '';
    display: block;
    clear: both;
  }
  @media (max-width: 640px) {
    .go {
      float: none;
      display: flex;
      justify-content: center;
    }
  }
</style>
