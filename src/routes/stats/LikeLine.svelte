<script lang="ts">
  import { deltaInk, likeGap } from '$lib/components/deltaColor';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  let { like }: { like: { gap: number; label: string } } = $props();
  let anchor: HTMLElement | undefined = $state();
  let open = $state(false);
  // A tap, click or Enter on the line follows the row's link, like the rest of the row (user, 2026-10-17: no
  // tap-to-expand). A cut line's full text (ui-rules 36: a clamped line's tip is its title only) shows in the shared
  // top-layer tip (39) on mouse hover and keyboard focus only, so it never stands between a tap and the link.
  const follow = () => anchor?.parentElement?.querySelector('a')?.click();
  const cut = () => !!anchor && anchor.scrollWidth > anchor.clientWidth + 1;
  // Only a cut line is a tab stop: a whole one has nothing to open (measured on mount and on every resize).
  let isCut = $state(false);
  $effect(() => {
    if (!anchor) return;
    const ro = new ResizeObserver(() => (isCut = cut()));
    ro.observe(anchor);
    return () => ro.disconnect();
  });
</script>

<!-- No button role: the row (48px) is the tap target. Focusable for keyboard when cut. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<small bind:this={anchor} class="like-line" tabindex={isCut ? 0 : -1}
  onpointerenter={(e) => e.pointerType === 'mouse' && cut() && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && cut() && (open = true)}
  onblur={() => (open = false)}
  onkeydown={(e) => e.key === 'Enter' && follow()}
  onclick={follow}
  ><span class={deltaInk(like.gap)}>{likeGap(like.gap)}</span> vs {like.label}</small
>{#if open && anchor}<FloatTip follow {anchor} onclose={() => (open = false)}><TipBody tip={{ title: `${likeGap(like.gap)} vs ${like.label}` }} /></FloatTip>{/if}

<style>
  .like-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    justify-self: start; /* the target hugs its text (ui-rules 41) */
    max-width: 100%;
    position: relative; /* over a row's stretched link */
    z-index: 1;
  }
  .like-line:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
