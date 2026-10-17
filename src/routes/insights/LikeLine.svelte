<script lang="ts">
  import { deltaInk, signed } from '$lib/components/deltaColor';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  let { like }: { like: { gap: number; label: string } } = $props();
  let anchor: HTMLElement | undefined = $state();
  let open = $state(false);
  // A cut line's full text (ui-rules 36: a clamped line's tip is its title only) in the shared top-layer tip (39),
  // opened from the text itself (41) on hover, tap and keyboard focus; Enter opens it too. A whole line needs no tip,
  // and it sits over the row's stretched link, so a tap on it goes on to that link.
  const cut = () => !!anchor && anchor.scrollWidth > anchor.clientWidth + 1;
</script>

<!-- No button role: the row (48px) is the tap target. Focusable for keyboard. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<small bind:this={anchor} class="like-line" tabindex="0"
  onpointerenter={(e) => e.pointerType === 'mouse' && cut() && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && cut() && (open = true)}
  onblur={() => (open = false)}
  onkeydown={(e) => e.key === 'Enter' && (open = true)}
  onclick={() => (cut() ? (open = true) : anchor?.parentElement?.querySelector('a')?.click())}
  ><span class={deltaInk(like.gap)}>{signed(like.gap)}</span> vs {like.label}</small
>{#if open && anchor}<FloatTip {anchor} onclose={() => (open = false)}><TipBody tip={{ title: `${signed(like.gap)} vs ${like.label}` }} /></FloatTip>{/if}

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
