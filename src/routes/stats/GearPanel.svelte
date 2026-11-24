<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import HeadingAnchor from '#lib/components/HeadingAnchor.svelte';
  import FloatTip from '#lib/components/FloatTip.svelte';
  import StickyTipBody from '#lib/components/StickyTipBody.svelte';
  import { StickyTip } from '#lib/stickyTip.ts';
  import TipBody, { tipText, type Tip } from '#lib/components/TipBody.svelte';
  import { KIND_LABEL } from '#lib/gear.ts';
  import { formatGrams } from '#lib/grams.ts';
  import { backdrop } from '#lib/imageBackdrop.ts';
  import type { GearPanelCard } from '#lib/server/insights/trophies.ts';
  import { onDestroy, onMount, tick } from 'svelte';

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
  const KIND_COLOR = { dripper: 1, grinder: 4, filter: 6, accessory: 2 } as const;

  // Paging. The cards are sized (css) so a whole number (n) fit the row. An arrow is enabled only when there is more that way
  // (updated on scroll and resize). On a phone the arrows sit below the row and a page is n cards. Wide, they lie over the row's
  // edges: the card under one is a peek, not part of the shown page (a click or Enter on it scrolls one card; it stays in the tab order, and focusing it scrolls it into view), so a page is
  // n - 2 cards and the covered card becomes the first uncovered one on the next turn. The browser's clamp to the end keeps the
  // last page full and end-aligned.
  let row: HTMLDivElement | undefined = $state();
  let prevBtn: HTMLButtonElement | undefined = $state(), nextBtn: HTMLButtonElement | undefined = $state();
  let more = $state({ prev: false, next: false });
  let cover = $state({ prev: -1, next: -1 }); // index of the card under each arrow, -1 for none
  const geom = () => {
    const gap = parseFloat(getComputedStyle(row!).columnGap) || 0, step = (row!.firstElementChild as HTMLElement).offsetWidth + gap;
    return { step, n: Math.round((row!.clientWidth + gap) / step), wide: getComputedStyle(nextBtn!).position === 'absolute' };
  };
  function measure() {
    if (!row || !row.firstElementChild) return;
    const m = { prev: row.scrollLeft > 1, next: row.scrollLeft + row.clientWidth < row.scrollWidth - 1 };
    // The focused arrow going away (disabled) would drop focus to the body: hand it to the other one.
    if (!m.prev && document.activeElement === prevBtn && m.next) nextBtn?.focus();
    if (!m.next && document.activeElement === nextBtn && m.prev) prevBtn?.focus();
    const { step, n, wide } = geom(), i = Math.round(row.scrollLeft / step);
    more = m;
    cover = { prev: wide && m.prev ? i : -1, next: wide && m.next ? i + n - 1 : -1 };
    // Keyboard focus that landed on a covered card moves it out from under its arrow.
    const foc = cards.findIndex((c) => anchors[c.key] === document.activeElement && anchors[c.key]!.matches(':focus-visible')); // a mouse click focuses it too: that scrolls by itself
    if (foc >= 0 && foc === cover.prev) row.scrollBy({ left: -step, behavior: 'auto' });
    else if (foc >= 0 && foc === cover.next) row.scrollBy({ left: step, behavior: 'auto' });
  }
  function page(dir: 1 | -1, count?: number) {
    if (!row) return;
    const { step, n, wide } = geom();
    moved = false; // cards sliding under a still pointer don't open their tips until it moves (2B)
    row.scrollBy({ left: dir * (count ?? Math.max(1, wide ? n - 2 : n)) * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  let moved = true, at: [number, number] = [0, 0];
  const track = (e: PointerEvent) => { if (e.clientX !== at[0] || e.clientY !== at[1]) moved = true; at = [e.clientX, e.clientY]; };
  $effect(() => { void cards; tick().then(measure); }); // the cards changed: re-measure what is covered
  // A covered card (a peek) is not opened: a click, Enter or Space there scrolls it one card into view and closes any tip.
  const tap = (ix: number, key: string) => {
    if (ix !== cover.prev && ix !== cover.next) return pin(key);
    st.close();
    page(ix === cover.prev ? -1 : 1, 1);
  };
  onMount(() => {
    const ro = new ResizeObserver(measure);
    if (row) ro.observe(row);
    measure();
    return () => ro.disconnect();
  });
</script>

<svelte:document onpointermovecapture={track} onclick={(e) => open && !(e.target as Element).closest('.gear-item') && st.close()} onkeydown={(e) => e.key === 'Escape' && st.close()} />

<section class="chart-panel gear-panel" data-section="gear-trophies">
  <HeadingAnchor id="gear-trophies">Your gear</HeadingAnchor>
  <div class="pager">
    <button type="button" class="page-btn prev" aria-label="Previous gear" bind:this={prevBtn} disabled={!more.prev} onclick={() => page(-1)}><Icon name="caret-left" /></button>
  <div class="cards" role="list" bind:this={row} onscroll={measure} onfocusin={measure}>
    {#each cards as c, ix (c.key)}
      {@const covered = ix === cover.prev || ix === cover.next}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions (focus moving to an element outside the card and its tip closes the tip; a null relatedTarget, as when a mac browser doesn't focus a clicked link, doesn't: the document click handles outside clicks) -->
      <div class="gear-item" role="listitem" onfocusout={(e) => open === c.key && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node) && st.close()}>
        <!-- svelte-ignore a11y_no_static_element_interactions (a button by role: hover, click and Enter share one handler) -->
        <div class="gear-card" class:covered role="button" tabindex="0" aria-expanded={open === c.key} aria-label="{c.name}: {tipText(tip(c))}"
          bind:this={anchors[c.key]} style="--kc:var(--series-{KIND_COLOR[c.kind]})"
          onpointerenter={(e) => e.pointerType === 'mouse' && moved && !covered && hover(c.key)}
          onpointermove={(e) => e.pointerType === 'mouse' && moved && !covered && open !== c.key && hover(c.key)}
          onpointerleave={(e) => e.pointerType === 'mouse' && !st.pinned && st.later()}
          onfocus={(e) => !covered && e.currentTarget.matches(':focus-visible') && focus(c.key)}
          onclick={() => tap(ix, c.key)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tap(ix, c.key))}>
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
    <button type="button" class="page-btn next" aria-label="Next gear" bind:this={nextBtn} disabled={!more.next} onclick={() => page(1)}><Icon name="caret-right" /></button>
  </div>
  <div class="go-row">
    <p class="blurb">Browse your drippers, grinders and filters, and see or edit their details, on the Gear page.</p>
    <a class="button go" href="/gear">Open the Gear page →</a>
  </div>
</section>

<style>
  /* A row of whole cards, the full content width: --n of them exactly fill it (the count steps up with the width, cards about
     170px or more), so no card is part visible. It scrolls sideways by whole cards (snap), the scrollbar hidden. */
  .pager {
    --gap: var(--space-3);
    container-type: inline-size;
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: var(--space-2);
  }
  .cards {
    grid-column: 1 / -1;
    grid-row: 1;
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
  /* The arrows: below the row on a phone (2 cards a page), always there, dimmed when disabled; wide, laid over the row's edges
     (above the cards in z-order, so a click on one never reaches the card under it) and hidden when there is nothing that way. */
  .page-btn {
    grid-row: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 5rem;
    height: 3.5rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .page-btn.prev {
    grid-column: 1;
    justify-self: start;
  }
  .page-btn.next {
    grid-column: 2;
    justify-self: end;
  }
  .page-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .page-btn :global(svg) {
    width: 1.75rem;
    height: 1.75rem;
  }
  /* A card under an arrow is a peek, not part of the page: a click on its visible part scrolls it into view (no tip). */
  @media (hover: hover) {
    .page-btn:not(:disabled):hover {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
    }
  }
  @container (min-width: 534px) {
    .pager {
      row-gap: 0;
    }
    .page-btn,
    .page-btn.prev,
    .page-btn.next {
      grid-area: auto; /* placed in the grid, an absolute box would be measured from row 2, not the whole row */
      position: absolute;
      z-index: 1;
      top: 50%;
      translate: 0 -50%;
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
      width: 4rem;
      height: 4rem;
    }
    .page-btn.prev {
      left: var(--space-2);
    }
    .page-btn.next {
      right: var(--space-2);
      left: auto;
    }
    .page-btn :global(svg) {
      width: 2rem;
      height: 2rem;
    }
    .page-btn:disabled {
      visibility: hidden;
    }
  }
  @container (min-width: 534px) { .gear-item { --n: 3; } }
  @container (min-width: 716px) { .gear-item { --n: 4; } }
  @container (min-width: 898px) { .gear-item { --n: 5; } }
  @container (min-width: 1080px) { .gear-item { --n: 6; } }
  @container (min-width: 1262px) { .gear-item { --n: 7; } }
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
