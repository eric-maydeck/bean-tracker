<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tipPlace, viewBand } from './floatTip';

  // A chart tip in the top layer (round 2, C2): a manual popover, so no card overflow, scroll wrapper or
  // container clips it and it sits above the sticky bars; placed from its anchor's rect (tipPlace) and
  // re-placed on scroll and resize while open. `wide`: the lab's structured tip (wraps at 15rem).
  let { anchor, wide = true, children }: { anchor: Element; wide?: boolean; children: Snippet } = $props();

  let el: HTMLDivElement | undefined = $state();
  function place() {
    if (!el || !anchor.isConnected) return;
    const t = el.getBoundingClientRect();
    const { x, y } = tipPlace(anchor.getBoundingClientRect(), { w: t.width, h: t.height }, viewBand());
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  $effect(() => {
    void anchor;
    if (!el) return;
    if (!el.matches(':popover-open')) el.showPopover();
    place();
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
    };
  });
</script>

<div bind:this={el} class="cell-tip float-tip" class:wide popover="manual" role="tooltip">{@render children()}</div>
