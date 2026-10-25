<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { openTip, tipPlace, viewBand } from './floatTip';
  import TipBody, { type Tip } from './TipBody.svelte';

  // A chart tip in the top layer (round 2, C2): a manual popover, so no card overflow, scroll wrapper or
  // container clips it and it sits above the sticky bars; placed from its anchor's rect (tipPlace) and
  // re-placed on scroll and resize while open. Every tip is the structured one (TipBody), wrapping at 15rem.
  // `onclose`: called when another tip dismisses this one, so its owner resets its open state (a tap-only device
  // never blurs, so the trigger would otherwise stay "open" and never show again).
  // `reveal`: a tip opened by a click, tap or keyboard (never by hover: the page would slide out from under it) that runs
  // past the bottom of the visible band scrolls the page just enough to show it whole (ui-rules 39; the See all tip
  // under the sticky bar at 1003×333). ponytail: only the below-overflow case; a tip clamped over its anchor stays.
  // `tip`: the content as a Tip, in place of children (labelTip.ts mounts it with no snippet).
  let { anchor, children, tip, onclose, reveal = false, placeKey }: { anchor: Element; placeKey?: unknown; children?: Snippet; tip?: Tip; onclose?: () => void; reveal?: boolean } = $props();

  let el: HTMLDivElement | undefined = $state();
  // Hidden while its anchor is scrolled out of view or under the sticky bar (shows again when it scrolls back);
  // Escape (document-level) dismisses it until the tip moves to another anchor.
  let away = $state(false), dismissed = $state(false);
  const me = { dismiss: () => { dismissed = true; onclose?.(); } };
  onDestroy(() => openTip.current === me && (openTip.current = null));
  function place() {
    if (!el || !anchor.isConnected) return;
    const t = el.getBoundingClientRect();
    // A control in the sticky bar itself (a switch's help tip) is never "under" it: its band starts at the top.
    const a = anchor.getBoundingClientRect(), band = viewBand(), view = anchor.closest('.filter-bar, .cbar.overlay') ? { ...band, top: 0 } : band;
    away = a.bottom <= view.top || a.top >= view.bottom;
    const { x, y } = tipPlace(a, { w: t.width, h: t.height }, view);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  // `placeKey`: changes when the anchor moves in place (a map zoom/pan): re-place without re-opening.
  $effect(() => {
    void placeKey;
    place();
  });
  $effect(() => {
    void anchor;
    if (openTip.current !== me) openTip.current?.dismiss();
    openTip.current = me;
    // A help popover open elsewhere closes too (one tip at a time), unless this tip is inside it.
    for (const p of document.querySelectorAll<HTMLElement>('.mode-tip:popover-open')) if (!p.contains(anchor)) p.hidePopover();
    dismissed = false;
    if (!el) return;
    if (!el.matches(':popover-open')) el.showPopover();
    place();
    const over = reveal ? el.getBoundingClientRect().bottom + 8 - viewBand().bottom : 0;
    if (over > 0) {
      scrollBy({ top: over, behavior: 'instant' });
      // Never so far that the anchor slides under the sticky bar (the tip would hide with it): back off the excess.
      const under = viewBand().top + 4 - anchor.getBoundingClientRect().top;
      // (not for an anchor in the open bar overlay: it is over the page, not under it, and scrolling could fold the bar)
      if (under > 0 && !anchor.closest('.cbar.overlay')) scrollBy({ top: -under, behavior: 'instant' });
      place(); // now, not on the scroll event a frame later: the tip is never seen (or measured) at the old spot
    }
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

<div bind:this={el} class="cell-tip float-tip wide" popover="manual" role="tooltip" style:visibility={away || dismissed ? 'hidden' : undefined}>{#if tip}<TipBody {tip} />{:else}{@render children?.()}{/if}</div>
