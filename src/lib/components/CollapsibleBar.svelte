<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { pinnedBar } from '$lib/components/pinnedBar.svelte';

  // A page's control block pinned to the top while scrolling (ui-rules 30). Desktop: the full bar sticks. Phones
  // (width <= 640 or height <= 450, so landscape too): the bar scrolls away normally; once it is off screen a short
  // pinned row (`summary` + an expand button) takes over, and expanding shows the full bar pinned over the page (its
  // own scroll when taller than the screen) with a pull tab hanging off its bottom edge to fold it back. Open/closed
  // is transient chrome, never view state: not in the URL, not remembered. The spacer keeps the block's height while
  // the bar floats, so nothing jumps. `desktopPinned` (px) = inner mode: on desktop the page pins its own part of the
  // block (this is its height) and the bar adds no chrome; on phones the in-flow bar has none either.
  let { children, summary, desktopPinned }: { children: Snippet; summary: Snippet; desktopPinned?: number } = $props();

  let barEl: HTMLElement | undefined = $state();
  let spacerEl: HTMLElement | undefined = $state();
  let barH = $state(0);
  let bodyH = $state(0);
  let chrome = $state(0);
  let spacerMargin = $state('0px');
  let phone = $state(false);
  let scrolled = $state(false);
  let expanded = $state(false);
  let hashDone = false;

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
    untrack(onMq); // its reads (expanded, the bar elements) are not this effect's deps: it would re-subscribe on every expand and fold
    mq.addEventListener('change', onMq);
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mq.removeEventListener('change', onMq);
      removeEventListener('scroll', onScroll);
    };
  });

  // What is pinned, and a scrolled-to target (the Add form, an inline edit's actions, a Jump to chip) lands below it.
  $effect(() => {
    const h = phone ? 3.5 * parseFloat(getComputedStyle(document.documentElement).fontSize) : (desktopPinned ?? barH);
    pinnedBar.h = h;
    document.documentElement.style.scrollPaddingTop = `${h}px`;
    if (h && !hashDone) {
      hashDone = true; // the browser's own hash scroll ran before this padding existed
      try {
        document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      } catch { /* a malformed hash (#%E0): no target, no scroll */ }
    }
  });
  // Cleared only on unmount: clearing on every re-run would flash 0 at whatever reads pinnedBar.h.
  $effect(() => () => {
    document.documentElement.style.removeProperty('scroll-padding-top');
    pinnedBar.h = 0;
  });

  // A popover opened from the bar (the Ratings menu) is placed from its button once; when the overlay scrolls under it, close it.
  const closePopovers = () => barEl?.querySelectorAll<HTMLElement>(':popover-open').forEach((p) => p.hidePopover());

  async function expand() {
    chrome = barEl!.offsetHeight - bodyH;
    spacerMargin = getComputedStyle(barEl!).marginBottom;
    expanded = true;
    await tick();
    barEl?.querySelector<HTMLElement>('.cbar-pull')?.focus();
  }

  async function fold() {
    expanded = false;
    await tick();
    document.querySelector<HTMLElement>('.cbar-mini .cbar-toggle')?.focus();
  }
</script>

{#if expanded}<div bind:this={spacerEl} style:height="{bodyH + chrome}px" style:margin-bottom={spacerMargin}></div>{/if}
<!-- A #hash link inside the bar (Jump to chips) folds it: the section lands below the short row. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="cbar" class:inner={desktopPinned !== undefined} class:overlay={expanded} bind:this={barEl} bind:offsetHeight={barH} onclick={(e) => { if (expanded && (e.target as Element).closest('a[href^="#"]')) expanded = false; }}>
  {#if expanded}
    <button type="button" class="cbar-pull" aria-expanded="true" aria-label="Hide controls" onclick={fold}>
      <span class="cbar-pull-tab"><Icon name="caret-up" /></span>
    </button>
  {/if}
  <div class="cbar-scroll" onscroll={closePopovers}><div class="cbar-body" bind:offsetHeight={bodyH}>{@render children()}</div></div>
</div>
{#if phone && scrolled && !expanded}
  <div class="cbar-mini">
    <span class="cbar-summary">{@render summary()}</span>
    <button type="button" class="icon-button cbar-toggle" aria-expanded="false" aria-label="Show controls" onclick={expand}>
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
  /* Inner mode on desktop: the page pins its own part. Contents is the default and phone mode undoes it, so no width falls in a gap between the two queries. */
  .cbar.inner,
  .cbar.inner .cbar-scroll,
  .cbar.inner .cbar-body {
    display: contents;
  }
  @media (max-width: 640px), (max-height: 450px) {
    .cbar.inner,
    .cbar.inner .cbar-scroll {
      display: block;
    }
    .cbar.inner .cbar-body {
      display: flow-root;
    }
    .cbar {
      position: static;
    }
    .cbar.inner {
      padding: 0;
      margin: 0;
      border: 0;
      background: none;
    }
    .cbar.overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      max-height: calc(100dvh - 44px); /* room for the pull tab below it */
      padding-inline: var(--space-4);
      margin-bottom: 0;
    }
    .cbar.inner.overlay {
      background: var(--color-bg);
      padding-top: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }
    .cbar.overlay > .cbar-scroll {
      overflow-y: auto;
      min-height: 0;
    }
  }
  @media (max-width: 640px) {
    .cbar.overlay {
      max-height: calc(100dvh - 64px - 44px - env(safe-area-inset-bottom, 0px)); /* the phone tab bar (about 60px tall, plus its safe-area padding), the pull tab */
    }
  }
  /* Back to top (35) stays tappable while the bar is expanded, but behind the overlay and its pull tab where they meet. */
  :global(body:has(.cbar.overlay) .back-to-top) {
    z-index: 29;
  }
  .cbar-body {
    display: flow-root; /* its children's margins stay inside, so the spacer can match its height */
  }
  .cbar-pull {
    position: absolute;
    top: 100%;
    right: var(--space-4);
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: flex-start; /* a button centers its content: without this the tab floats below the bar edge */
  }
  /* The expand caret's own box (44x44, muted fill, page-colored icon), hung flush under the bar: it covers the bar's bottom
     border under it, square top corners, rounded bottom ones. */
  .cbar-pull-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid;
    border-radius: 0 0 var(--radius) var(--radius);
  }
  .cbar-pull:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: -2px;
  }

  /* The caret is not a normal button: neutral muted gray-brown fill with a page-colored icon (>= 6:1 in both themes). */
  .cbar-toggle,
  .cbar-toggle:hover,
  .cbar-pull-tab {
    background: var(--color-text-muted);
    color: var(--color-bg);
    border-color: var(--color-text-muted);
  }
  .cbar-pull-tab :global(.icon) {
    width: 1.25rem; /* as the short row's caret icon (.icon-button .icon) */
    height: 1.25rem;
  }
</style>
