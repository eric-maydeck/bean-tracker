<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { page } from '$app/state';

  // A page's control block pinned to the top while scrolling (ui-rules 30). Desktop: the full bar sticks. Phones
  // (width <= 640 or height <= 450, so landscape too): the bar scrolls away normally; once it is off screen a short
  // pinned row (`summary` + an expand button) takes over, and expanding shows the full bar pinned over the page (its
  // own scroll when taller than the screen) with a button to fold it back. Open/closed is transient chrome, never
  // view state: not in the URL, not remembered. The spacer keeps the bar's height while it floats, so nothing jumps.
  // `children` receives the fold-back caret to render as the last item of its last row (empty unless expanded).
  let { children, summary }: { children: Snippet<[Snippet]>; summary: Snippet } = $props();

  let barEl: HTMLElement | undefined = $state();
  let spacerEl: HTMLElement | undefined = $state();
  let barH = $state(0);
  let slotH = $state(0);
  let phone = $state(false);
  let scrolled = $state(false);
  let expanded = $state(false);

  // chore(preview): temporary caret-color candidates (?_caret=1..4) and ?_expand=1 (opens the bar scrolled and expanded
  // on a phone). Server-rendered class; remove with the pick.
  const caretVariant = $derived(['1', '2', '3', '4'].includes(page.url.searchParams.get('_caret') ?? '') ? `c${page.url.searchParams.get('_caret')}` : '');
  let autoExpanded = false;
  $effect(() => {
    if (autoExpanded || !phone || !page.url.searchParams.has('_expand')) return;
    autoExpanded = true;
    window.scrollTo(0, 1500);
    requestAnimationFrame(() => requestAnimationFrame(() => { scrolled = true; expand(); }));
  });

  $effect(() => {
    const mq = matchMedia('(max-width: 640px), (max-height: 450px)');
    const onScroll = () => {
      const flow = expanded ? spacerEl : barEl; // the bar's place in the page, floating or not
      scrolled = !!flow && flow.getBoundingClientRect().bottom <= 0;
      if (!scrolled) expanded = false;
    };
    const onMq = () => {
      phone = mq.matches;
      if (!phone) expanded = false; // desktop width: the full bar is always pinned
      onScroll();
    };
    onMq();
    mq.addEventListener('change', onMq);
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mq.removeEventListener('change', onMq);
      removeEventListener('scroll', onScroll);
    };
  });

  // A scrolled-to target (the Add form, an inline edit's actions) lands below whatever is pinned.
  $effect(() => {
    document.documentElement.style.scrollPaddingTop = phone ? '3.5rem' : `${barH}px`;
    return () => document.documentElement.style.removeProperty('scroll-padding-top');
  });

  function expand() {
    slotH = barEl!.offsetHeight;
    expanded = true;
  }
</script>

{#snippet caret()}
  {#if expanded}
    <button type="button" class="icon-button cbar-toggle {caretVariant}" aria-expanded="true" aria-label="Hide controls" onclick={() => (expanded = false)}>
      <Icon name="caret-up" />
    </button>
  {/if}
{/snippet}

{#if expanded}<div bind:this={spacerEl} style:height="{slotH}px" style:margin-bottom="var(--space-3)"></div>{/if}
<div class="cbar" class:overlay={expanded} bind:this={barEl} bind:offsetHeight={barH}>
    {@render children(caret)}
</div>
{#if phone && scrolled && !expanded}
  <div class="cbar-mini">
    <span class="cbar-summary">{@render summary()}</span>
    <button type="button" class="icon-button cbar-toggle {caretVariant}" aria-expanded="false" aria-label="Show controls" onclick={expand}>
      <Icon name="caret-down" />
    </button>
  </div>
{/if}

<style>
  .cbar {
    position: sticky;
    top: 0;
    z-index: 30; /* above cards and rows, below the phone tab bar (40), toasts (90) and modals */
    background: var(--color-bg);
    padding-top: var(--space-2);
    margin-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }
  .cbar-mini {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 30;
    box-sizing: border-box;
    height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding-inline: var(--space-4);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }
  .cbar-summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
  }
  .cbar-toggle {
    flex: none;
    width: 44px;
    height: 44px;
  }
  .cbar-mini .cbar-toggle {
    margin-left: auto;
  }
  /* Expanded: the caret is the last item of the page's last row (results / Add / Sort by), in that row's right cell, so
     the row's own alignment gives it its neighbor's top and height (ui-rules 5). Sort by gives up room beside it. */
  .cbar :global(.add-sort-row > .cbar-toggle) {
    grid-column: 3;
    grid-row: 1; /* the same cell as Sort by in landscape */
    justify-self: end;
    align-self: stretch;
    height: auto;
    width: 44px;
  }
  @media (min-width: 641px) {
    /* Landscape: its neighbor is Sort by's 2.25rem toggle. */
    .cbar :global(.add-sort-row > .cbar-toggle) {
      align-self: center;
      height: 2.25rem;
    }
    .cbar :global(.add-sort-row:has(> .cbar-toggle) .sort-in-row) {
      margin-right: calc(44px + var(--space-2));
    }
  }
  @media (max-width: 640px), (max-height: 450px) {
    .cbar {
      position: static;
    }
    .cbar.overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      box-sizing: border-box;
      max-height: 100dvh;
      overflow-y: auto;
      padding-inline: var(--space-4);
      margin-bottom: 0;
    }
  }
  @media (max-width: 640px) {
    .cbar.overlay {
      max-height: calc(100dvh - 56px); /* the phone tab bar */
    }
  }

  /* chore(preview): neutral caret candidates, tokens only (both themes follow the tokens). */
  /* 1: inverted page ink: espresso fill with a light icon (dark mode: light fill, dark icon) */
  .cbar-toggle.c1,
  .cbar-toggle.c1:hover {
    background: var(--color-text);
    color: var(--color-bg);
    border-color: var(--color-text);
  }
  /* 2: espresso outline, 2px, on the surface */
  .cbar-toggle.c2,
  .cbar-toggle.c2:hover {
    background: var(--color-surface);
    color: var(--color-label);
    border: 2px solid var(--color-label);
  }
  /* 3: slate blue tint with a slate border and icon */
  .cbar-toggle.c3,
  .cbar-toggle.c3:hover {
    background: color-mix(in srgb, var(--chart-color-4) 22%, var(--color-surface));
    color: var(--chart-color-4);
    border-color: var(--chart-color-4);
  }
  /* 4: muted gray-brown solid with a page-colored icon */
  .cbar-toggle.c4,
  .cbar-toggle.c4:hover {
    background: var(--color-text-muted);
    color: var(--color-bg);
    border-color: var(--color-text-muted);
  }
</style>
