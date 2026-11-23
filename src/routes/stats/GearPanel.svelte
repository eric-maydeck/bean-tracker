<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import FloatTip from '#lib/components/FloatTip.svelte';
  import StickyTipBody from '#lib/components/StickyTipBody.svelte';
  import { StickyTip } from '#lib/stickyTip.ts';
  import TipBody, { tipText, type Tip } from '#lib/components/TipBody.svelte';
  import { KIND_LABEL } from '#lib/gear.ts';
  import { formatGrams } from '#lib/grams.ts';
  import { backdrop } from '#lib/imageBackdrop.ts';
  import type { GearPanelCard } from '#lib/server/insights/trophies.ts';
  import { onDestroy, onMount } from 'svelte';

  // The Gear tab's way to /gear: a scrolling row of the active gear's cards, each the anchor of a sticky tip (ui-rules 54)
  // with its figures, a couple of specs and a link to that gear's dialog on /gear; the blurb and a real link to /gear below.
  let { cards }: { cards: GearPanelCard[] } = $props();

  // The open card's key. A hover opens it (the mouse can cross onto the tip), a click, tap or Enter pins it until a click outside,
  // Escape, or focus leaving the card and its tip; a keyboard focus on a card opens its tip (stickyTip.ts, as the origin map).
  let open = $state<string | null>(null);
  const st = new StickyTip(() => (open = null));
  const anchors: Record<string, HTMLElement | undefined> = $state({});
  onDestroy(st.keep);
  const hover = (k: string) => { if (st.pinned && open !== k) return; st.keep(); open = k; };
  const pin = (k: string) => { st.keep(); if (st.pinned && open === k) return st.close(); open = k; st.pinned = true; };
  const focus = (k: string) => { st.keep(); st.pinned = false; open = k; };

  const tip = (c: GearPanelCard): Tip => ({
    title: c.name,
    rows: [...c.specs.filter(([l]) => l === 'Brand'), ['Average', c.rating === null ? 'No ratings' : c.rating.toFixed(1)], ['Brews', String(c.brews)], ['Brewed', formatGrams(c.grams)], ...c.specs.filter(([l]) => l !== 'Brand')]
  });
  const KIND_COLOR = { dripper: 1, grinder: 4, filter: 6 } as const;

  // Paging. The cards are sized (css) so a whole number fit the row, so the viewport is a whole number of card steps: a page is
  // that many cards, and the browser's clamp to the end makes the last page a full row. An arrow shows only when there is more
  // that way (updated on scroll and resize); the gutters stay reserved, so showing one never resizes the row.
  let row: HTMLDivElement | undefined = $state();
  let more = $state({ prev: false, next: false });
  function measure() {
    if (!row) return;
    more = { prev: row.scrollLeft > 1, next: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 };
  }
  function page(dir: 1 | -1) {
    if (!row) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0, step = (row.firstElementChild as HTMLElement).offsetWidth + gap;
    row.scrollBy({ left: dir * Math.max(1, Math.round((row.clientWidth + gap) / step)) * step, behavior: 'smooth' });
  }
  onMount(() => {
    const ro = new ResizeObserver(measure);
    if (row) ro.observe(row);
    measure();
    return () => ro.disconnect();
  });
</script>

<svelte:document onclick={(e) => open && !(e.target as Element).closest('.gear-item') && st.close()} onkeydown={(e) => e.key === 'Escape' && st.close()} />

<section class="chart-panel gear-panel" id="gear-trophies" data-section="gear-trophies">
  <h2>Your gear</h2>
  <div class="pager">
    <button type="button" class="page-btn" aria-label="Previous gear" style:visibility={more.prev ? 'visible' : 'hidden'} onclick={() => page(-1)}><Icon name="caret-left" /></button>
    <div class="cards-box">
  <div class="cards" role="list" bind:this={row} onscroll={measure}>
    {#each cards as c (c.key)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions (focus moving to an element outside the card and its tip closes the tip; a null relatedTarget, as when a mac browser doesn't focus a clicked link, doesn't: the document click handles outside clicks) -->
      <div class="gear-item" role="listitem" onfocusout={(e) => open === c.key && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node) && st.close()}>
        <!-- svelte-ignore a11y_no_static_element_interactions (a button by role: hover, click and Enter share one handler) -->
        <div class="gear-card" role="button" tabindex="0" aria-expanded={open === c.key} aria-label="{c.name}: {tipText(tip(c))}"
          bind:this={anchors[c.key]} style="--kc:var(--series-{KIND_COLOR[c.kind]})"
          onpointerenter={(e) => e.pointerType === 'mouse' && hover(c.key)}
          onpointerleave={(e) => e.pointerType === 'mouse' && !st.pinned && st.later()}
          onfocus={(e) => e.currentTarget.matches(':focus-visible') && focus(c.key)}
          onclick={() => pin(c.key)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pin(c.key))}>
          <span class="photo" style:--fill={backdrop(c.image?.fill)}>
            {#if c.image}<img src={c.image.src} alt="" loading="lazy" />{:else}<Icon name="gear" />{/if}
          </span>
          <span class="name">{c.name}</span>
          <span class="kind">{KIND_LABEL[c.kind]}</span>
        </div>
        {#if open === c.key && anchors[c.key]}
          <FloatTip anchor={anchors[c.key]!} onclose={st.close}>
            <StickyTipBody sticky={st} values href="/gear?card={c.key}" linkText="See details on the Gear page"><TipBody tip={tip(c)} /></StickyTipBody>
          </FloatTip>
        {/if}
      </div>
    {/each}
  </div>
    </div>
    <button type="button" class="page-btn" aria-label="Next gear" style:visibility={more.next ? 'visible' : 'hidden'} onclick={() => page(1)}><Icon name="caret-right" /></button>
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
  /* arrow | the row | arrow: the arrows sit in their own gutters, never over a card. */
  .pager {
    --gap: var(--space-3);
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) 1.75rem; /* narrow on a phone: the 44px tap target overhangs into the panel's padding */
    align-items: center;
    gap: var(--space-1);
  }
  .page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    margin-inline-start: -1rem; /* the previous arrow overhangs left, the next one (below) right: never onto a card */
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .page-btn :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
  @media (hover: hover) {
    .page-btn:hover {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
    }
  }
  .cards-box + .page-btn {
    margin-inline: 0 -1rem;
  }
  @media (min-width: 641px) {
    .pager {
      grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
    }
    .page-btn, .cards-box + .page-btn {
      margin-inline: 0;
    }
  }
  /* A row of whole cards: --n of them exactly fill the width (the count steps up with it), so no card is part visible. It scrolls
     sideways by whole cards (snap), the scrollbar hidden: the arrows and touch drag are the way. */
  .cards-box {
    container-type: inline-size;
    min-width: 0;
  }
  .cards {
    display: flex;
    gap: var(--gap);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .gear-item {
    --n: 2;
    flex: 0 0 calc((100% - (var(--n) - 1) * var(--gap)) / var(--n));
    min-width: 0;
    scroll-snap-align: start;
  }
  @container (min-width: 474px) { .gear-item { --n: 3; } }
  @container (min-width: 636px) { .gear-item { --n: 4; } }
  @container (min-width: 798px) { .gear-item { --n: 5; } }
  @container (min-width: 960px) { .gear-item { --n: 6; } }
  @container (min-width: 1122px) { .gear-item { --n: 7; } }
  @container (min-width: 1284px) { .gear-item { --n: 8; } }
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
    color: #7a6a5c; /* fixed like the backdrop (imageBackdrop.ts): the icon sits on a colour that is the same in both themes */
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
</style>
