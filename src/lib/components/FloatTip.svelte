<script module lang="ts">
  // Where the pointer last was (null after a key press): a `follow` tip opened by a mouse or touch starts there, one opened
  // from the keyboard stays at its anchor. ponytail: one document listener per page, set up on first import.
  let pointer: { x: number; y: number } | null = null;
  if (typeof document !== 'undefined') {
    for (const t of ['pointerover', 'pointermove', 'pointerdown'])
      document.addEventListener(t, (e) => (pointer = { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY }), true);
    document.addEventListener('keydown', () => (pointer = null), true);
  }
</script>

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
  // `beside`: placed to the side of the anchor, not above it (a horizontal bar's end).
  // `at`: a pointer position: the tip sits at that point instead of at its anchor's rect; `follow` keeps it on the pointer
  // while it moves (a chart mark's tip).
  // `follow` without `at`: a chart's tip starts at the pointer that opened it (a tap: the tap's point); a key-opened one stays anchored.
  // `tip`: the content as a Tip, in place of children (labelTip.ts mounts it with no snippet).
  let { anchor, children, tip, onclose, reveal = false, placeKey, beside = false, at: start = null, follow = false }: { anchor: Element; at?: { x: number; y: number } | null; follow?: boolean; placeKey?: unknown; beside?: boolean; children?: Snippet; tip?: Tip; onclose?: () => void; reveal?: boolean } = $props();

  let el: HTMLDivElement | undefined = $state();
  let at = $state(start ?? (follow ? pointer : null));
  // Hidden while its anchor is scrolled out of view or under the sticky bar (shows again when it scrolls back);
  // Escape (document-level) dismisses it until the tip moves to another anchor.
  let away = $state(false), dismissed = $state(false);
  const me = { dismiss: () => { dismissed = true; onclose?.(); } };
  onDestroy(() => openTip.current === me && (openTip.current = null));
  function place() {
    if (!el || !anchor.isConnected) return;
    const t = el.getBoundingClientRect();
    // A control in the sticky bar itself (a switch's help tip) is never "under" it: its band starts at the top.
    const a = at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : anchor.getBoundingClientRect(), band = viewBand(), view = anchor.closest('.filter-bar, .cbar.overlay') ? { ...band, top: 0 } : band;
    away = a.bottom <= view.top || a.top >= view.bottom;
    const { x, y } = tipPlace(a, { w: t.width, h: t.height }, view, 6, beside);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  // `placeKey`: changes when the anchor moves in place (a map zoom/pan): re-place without re-opening.
  $effect(() => {
    void placeKey;
    void at?.x;
    void at?.y;
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
    const move = (e: PointerEvent) => (at = { x: e.clientX, y: e.clientY });
    if (follow) document.addEventListener('pointermove', move);
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (dismissed = true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', esc);
      document.removeEventListener('pointermove', move);
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
    };
  });
</script>

<div bind:this={el} class="cell-tip float-tip wide" popover="manual" role="tooltip" style:visibility={away || dismissed ? 'hidden' : undefined}>{#if tip}<TipBody {tip} />{:else}{@render children?.()}{/if}</div>
