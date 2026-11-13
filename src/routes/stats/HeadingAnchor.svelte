<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { useChartLink } from './chartLink';
  import { copyLinkOf, plainClick } from '$lib/copyLink';

  // A section heading that links to itself (?…&chart=<id>#<id>), so its URL can be shared and previews name it:
  // a plain click on the text puts that URL in the address bar without a reload (the page's replaceState), a modified
  // click follows the href. No hover preload (it would fetch the page data for a link that never navigates). Capture
  // phase: SvelteKit's own link handler runs before a delegated onclick. The link icon after the text is its own
  // button: it copies the link's full URL with a "Link copied" toast (copyLinkOf). It shows on hover and focus, and
  // always on touch (no hover); phones give it a 44px tap target. A load or click on the hash scrolls the heading to
  // just under the sticky filter bar (CollapsibleBar sets scroll-padding-top).
  let { id, level = 2, class: cls = '', children }: { id: string; level?: 2 | 3; class?: string; children: Snippet } = $props();
  const link = useChartLink();
  let a: HTMLAnchorElement | undefined = $state();
  function onclick(e: MouseEvent) {
    if (!plainClick(e)) return;
    e.preventDefault();
    link.go(id);
  }
</script>

<!-- Named by its text alone (aria-labelledby), not "… Copy link". -->
<svelte:element this={`h${level}`} {id} class="heading-anchor {cls}" aria-labelledby="{id}-text">
  <a bind:this={a} id="{id}-text" href={link.href(id)} onclickcapture={onclick} data-sveltekit-preload-data="off">{@render children()}</a><button
    type="button" class="copy-link" aria-label="Copy link" onclick={() => a && copyLinkOf(a)}><Icon name="link" /></button>
</svelte:element>

<style>
  .heading-anchor {
    scroll-margin-top: var(--space-2);
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  a:focus-visible,
  .copy-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  /* Inline-block on the heading's line height, like a "?" button beside it, so the two share a top and height. */
  .copy-link {
    display: inline-block;
    margin-inline-start: 0.15em;
    padding: 0 0.15em;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    font: inherit;
    line-height: inherit;
    cursor: pointer;
    opacity: 0;
  }
  .copy-link :global(.icon) {
    width: 0.8em;
    height: 0.8em;
    vertical-align: -0.05em;
  }
  .heading-anchor:hover .copy-link,
  .copy-link:focus-visible,
  a:focus-visible + .copy-link {
    opacity: 1;
  }
  .copy-link:hover {
    color: var(--color-text);
  }
  /* Phones (≤640, as for .mode-tip-button): a 44px target, with the icon at its start so the target reaches right of
     the icon, never over the text; the negative margins cancel the padding (line height and what follows unmoved). */
  @media (max-width: 640px) {
    .copy-link {
      min-width: 44px;
      padding: max(16px, calc(22px - 0.5lh)) calc(44px - 1.1em) max(16px, calc(22px - 0.5lh)) 0.3em;
      margin: min(-16px, calc(0.5lh - 22px)) calc(1.1em - 44px) min(-16px, calc(0.5lh - 22px)) 0;
    }
  }
  /* Touch (no hover): always shown. */
  @media (hover: none) {
    .copy-link {
      opacity: 1;
    }
  }
</style>
