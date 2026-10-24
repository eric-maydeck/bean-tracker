<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  // A page's control block pinned to the top while scrolling (ui-rules 30). Desktop: the full bar sticks. Phones
  // (width <= 640 or height <= 450, so landscape too): the bar scrolls away normally; once it is off screen a short
  // pinned row (`summary` + an expand button) takes over, and expanding shows the full bar pinned over the page (its
  // own scroll when taller than the screen) with a button to fold it back. Open/closed is transient chrome, never
  // view state: not in the URL, not remembered. The spacer keeps the bar's height while it floats, so nothing jumps.
  let { children, summary }: { children: Snippet; summary: Snippet } = $props();

  let barEl: HTMLElement | undefined = $state();
  let spacerEl: HTMLElement | undefined = $state();
  let barH = $state(0);
  let slotH = $state(0);
  let phone = $state(false);
  let scrolled = $state(false);
  let expanded = $state(false);

  $effect(() => {
    const mq = matchMedia('(max-width: 640px), (max-height: 450px)');
    const onScroll = () => {
      const flow = expanded ? spacerEl : barEl; // the bar's place in the page, floating or not
      scrolled = !!flow && flow.getBoundingClientRect().bottom <= 0;
      if (!scrolled) expanded = false;
    };
    const onMq = () => {
      phone = mq.matches;
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

  // Expanded: the caret takes the top and height of the rightmost button in the bar's first row (Show's last button on a
  // portrait phone, View's last in landscape), so it lines up with its left neighbor instead of the bar's top edge.
  let toggleEl: HTMLElement | undefined = $state();
  $effect(() => {
    if (!expanded || !barEl || !toggleEl) return;
    const first = [...barEl.querySelectorAll<HTMLElement>('.toolbar button')].filter((b) => b.offsetParent && b !== toggleEl);
    const top = Math.min(...first.map((b) => b.getBoundingClientRect().top));
    const edge = first.filter((b) => Math.abs(b.getBoundingClientRect().top - top) < 2)
      .reduce((a, b) => (b.getBoundingClientRect().right > a.getBoundingClientRect().right ? b : a));
    const r = edge.getBoundingClientRect();
    toggleEl.style.top = `${r.top - barEl.getBoundingClientRect().top + barEl.scrollTop}px`;
    toggleEl.style.height = `${r.height}px`;
  });

  function expand() {
    slotH = barEl!.offsetHeight;
    expanded = true;
  }
</script>

{#if expanded}<div bind:this={spacerEl} style:height="{slotH}px" style:margin-bottom="var(--space-3)"></div>{/if}
<div class="cbar" class:overlay={expanded} bind:this={barEl} bind:offsetHeight={barH}>
    {#if expanded}
      <button type="button" class="icon-button cbar-toggle" bind:this={toggleEl} aria-expanded="true" aria-label="Hide controls" onclick={() => (expanded = false)}>
        <Icon name="caret-up" />
      </button>
    {/if}
    {@render children()}
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
  /* Expanded: the top-right corner of the bar, level with its first row; the toolbar leaves room for it. */
  .overlay .cbar-toggle {
    position: absolute;
    top: var(--space-2);
    right: var(--space-4);
  }
  .overlay :global(.toolbar) {
    padding-right: calc(44px + var(--space-2));
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
</style>
