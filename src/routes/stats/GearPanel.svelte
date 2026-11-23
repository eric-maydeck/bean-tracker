<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import FloatTip from '#lib/components/FloatTip.svelte';
  import TipBody, { tipText, type Tip } from '#lib/components/TipBody.svelte';
  import { KIND_LABEL } from '#lib/gear.ts';
  import { formatGrams } from '#lib/grams.ts';
  import { backdrop } from '#lib/imageBackdrop.ts';
  import type { GearPanelCard } from '#lib/server/insights/trophies.ts';
  import { onDestroy } from 'svelte';

  // The Gear tab's way to /gear: a scrolling row of the active gear's cards, each the anchor of a sticky tip (ui-rules 54)
  // with its figures, a couple of specs and a link to that gear's dialog on /gear; the blurb and a real link to /gear below.
  let { cards }: { cards: GearPanelCard[] } = $props();

  // The open card's key. A hover opens it (the mouse can cross onto the tip: a short delay before closing), a click, tap
  // or Enter pins it until a click outside, Escape, or the tip's link (the origin map's behavior, WorldMap.svelte).
  let open = $state<string | null>(null);
  let pinned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const anchors: Record<string, HTMLElement | undefined> = $state({});
  const keep = () => clearTimeout(timer);
  const close = () => (keep(), (open = null), (pinned = false));
  const later = () => (keep(), (timer = setTimeout(close, 100)));
  onDestroy(keep);
  const hover = (k: string) => { if (pinned && open !== k) return; keep(); open = k; };
  const pin = (k: string) => { keep(); if (pinned && open === k) return close(); open = k; pinned = true; };

  const tip = (c: GearPanelCard): Tip => ({
    title: c.name,
    rows: [['Average', c.rating === null ? 'No ratings' : c.rating.toFixed(1)], ['Brews', String(c.brews)], ['Brewed', formatGrams(c.grams)], ...c.specs]
  });
  const KIND_COLOR = { dripper: 1, grinder: 4, filter: 6 } as const;
</script>

<svelte:document onclick={(e) => open && !(e.target as Element).closest('.gear-item') && close()} onkeydown={(e) => e.key === 'Escape' && close()} />

<section class="chart-panel gear-panel" id="gear-trophies" data-section="gear-trophies">
  <h2>Your gear</h2>
  <div class="cards" role="list">
    {#each cards as c (c.key)}
      <div class="gear-item" role="listitem">
        <!-- svelte-ignore a11y_no_static_element_interactions (a button by role: hover, click and Enter share one handler) -->
        <div class="gear-card" role="button" tabindex="0" aria-expanded={open === c.key} aria-label="{c.name}: {tipText(tip(c))}"
          bind:this={anchors[c.key]} style="--kc:var(--series-{KIND_COLOR[c.kind]})"
          onpointerenter={(e) => e.pointerType === 'mouse' && hover(c.key)}
          onpointerleave={(e) => e.pointerType === 'mouse' && !pinned && later()}
          onclick={() => pin(c.key)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pin(c.key))}>
          <span class="photo" style:--fill={backdrop(c.image?.fill)}>
            {#if c.image}<img src={c.image.src} alt="" loading="lazy" />{:else}<Icon name="gear" />{/if}
          </span>
          <span class="name">{c.name}</span>
          <span class="kind">{KIND_LABEL[c.kind]}</span>
        </div>
        {#if open === c.key && anchors[c.key]}
          <FloatTip anchor={anchors[c.key]!} onclose={close}>
            <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events (a mouse-only extra: Escape closes it, the link is a real link) -->
            <div class="tip-hover" onpointerenter={keep} onpointerleave={(e) => e.pointerType === 'mouse' && !pinned && later()} onclick={(e) => pinned && !(e.target as Element).closest('a') && close()}>
              <TipBody tip={tip(c)} />
              <a class="tip-link" href="/gear?card={c.key}" onclick={close}>See details on the Gear page</a>
            </div>
          </FloatTip>
        {/if}
      </div>
    {/each}
  </div>
  <div class="go-row">
    <p class="blurb">Browse your drippers, grinders and filters, and see or edit their details, on the Gear page.</p>
    <a class="button go" href="/gear">Open the Gear page →</a>
  </div>
</section>

<style>
  h2 {
    margin: 0 0 var(--space-3);
  }
  /* A row that scrolls sideways, cards that never stack; each snaps to the row's start. */
  .cards {
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    padding-bottom: var(--space-2);
    scroll-snap-type: x proximity;
  }
  .gear-item {
    flex: 0 0 8.5rem;
    scroll-snap-align: start;
  }
  .gear-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-top: 4px solid var(--kc);
    border-radius: var(--radius);
    background: var(--color-surface);
    cursor: pointer;
  }
  .gear-card[aria-expanded='true'],
  .gear-card:focus-visible {
    border-color: var(--color-accent);
    border-top-color: var(--kc);
  }
  @media (hover: hover) {
    .gear-card:hover {
      border-color: var(--color-accent);
      border-top-color: var(--kc);
    }
  }
  /* The photo contained on its own backdrop (ui-rules 18), the same look as the gear cards. */
  .photo {
    aspect-ratio: 1;
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--fill);
    color: #7a6a5c;
  }
  .photo img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: var(--fill);
  }
  .photo :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
  .go-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .blurb {
    margin: 0;
    color: var(--color-text-muted);
  }
  .go {
    margin: 0;
  }
  @media (max-width: 640px) {
    .go {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
  /* The tip is pointer-events: none (a hover tip); this wrapper fills it (cancelling its padding) so the mouse can
     rest on it and click the link (WorldMap's). */
  .tip-hover {
    margin: -0.5rem -0.75rem;
    padding: 0.5rem 0.75rem;
    pointer-events: auto;
    cursor: default;
  }
  .tip-hover :global(.tip-rows) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .tip-hover :global(.tip-rows dt) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
    cursor: pointer;
  }
</style>
