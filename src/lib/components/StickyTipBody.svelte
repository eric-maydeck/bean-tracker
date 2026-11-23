<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { StickyTip } from '#lib/stickyTip.ts';

  // A sticky tip's content (inside a FloatTip): the tip is pointer-events: none (a hover tip), so this wrapper fills it
  // (cancelling its padding) and lets the pointer rest on it and click the link. A click on the body of a pinned tip closes it.
  let { sticky, href, linkText, children }: { sticky: StickyTip; href?: string; linkText?: string; children: Snippet } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events (a mouse-only extra: Escape closes it, the link is a real link) -->
<div class="tip-hover" onpointerenter={sticky.keep} onpointerleave={(e) => e.pointerType === 'mouse' && !sticky.pinned && sticky.later()} onclick={(e) => sticky.pinned && !(e.target as Element).closest('a') && sticky.close()}>
  {@render children()}
  {#if href}<a class="tip-link" {href}>{linkText}</a>{/if}
</div>

<style>
  .tip-hover {
    margin: -0.5rem -0.75rem;
    padding: 0.5rem 0.75rem;
    pointer-events: auto;
    cursor: default;
  }
  /* A long name ellipsizes; the tip never grows past its max width. */
  .tip-hover :global(.tip-rows) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .tip-hover :global(.tip-rows dt) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
    cursor: pointer;
  }
</style>
