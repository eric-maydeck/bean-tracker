<script lang="ts" module>
  // Only one tip is open app-wide: a tip that opens dismisses the one before it (its owner may still think it open).
  let current: { dismiss: () => void } | null = null;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { tipPlace, viewBand } from './floatTip';

  // A chart tip in the top layer (round 2, C2): a manual popover, so no card overflow, scroll wrapper or
  // container clips it and it sits above the sticky bars; placed from its anchor's rect (tipPlace) and
  // re-placed on scroll and resize while open. Every tip is the structured one (TipBody), wrapping at 15rem.
  // `onclose`: called when another tip dismisses this one, so its owner resets its open state (a tap-only device
  // never blurs, so the trigger would otherwise stay "open" and never show again).
  let { anchor, children, onclose }: { anchor: Element; children: Snippet; onclose?: () => void } = $props();

  let el: HTMLDivElement | undefined = $state();
  // Hidden while its anchor is scrolled out of view or under the sticky bar (shows again when it scrolls back);
  // Escape (document-level) dismisses it until the tip moves to another anchor.
  let away = $state(false), dismissed = $state(false);
  const me = { dismiss: () => { dismissed = true; onclose?.(); } };
  onDestroy(() => current === me && (current = null));
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
    if (current !== me) current?.dismiss();
    current = me;
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
