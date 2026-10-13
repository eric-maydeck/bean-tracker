<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tipPlace, viewBand } from './floatTip';

  // A chart tip in the top layer (round 2, C2): a manual popover, so no card overflow, scroll wrapper or
  // container clips it and it sits above the sticky bars; placed from its anchor's rect (tipPlace) and
  // re-placed on scroll and resize while open. Every tip is the structured one (TipBody), wrapping at 15rem.
  let { anchor, children }: { anchor: Element; children: Snippet } = $props();

  let el: HTMLDivElement | undefined = $state();
  // Hidden while its anchor is scrolled out of view or under the sticky bar (shows again when it scrolls back);
  // Escape (document-level) dismisses it until the tip moves to another anchor.
  let away = $state(false), dismissed = $state(false);
  function place() {
    if (!el || !anchor.isConnected) return;
    const t = el.getBoundingClientRect();
    const a = anchor.getBoundingClientRect(), view = viewBand();
    away = a.bottom <= view.top || a.top >= view.bottom;
    const { x, y } = tipPlace(a, { w: t.width, h: t.height }, view);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  $effect(() => {
    void anchor;
    dismissed = false;
    if (!el) return;
    if (!el.matches(':popover-open')) el.showPopover();
    place();
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (dismissed = true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', esc);
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
    };
  });
</script>

<div bind:this={el} class="cell-tip float-tip wide" popover="manual" role="tooltip" style:visibility={away || dismissed ? 'hidden' : undefined}>{@render children()}</div>
