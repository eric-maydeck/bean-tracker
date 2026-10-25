<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { useChartLink } from './chartLink';

  // A section heading that links to itself (?…&chart=<id>#<id>), so its URL can be copied and previews name it:
  // a plain click puts that URL in the address bar without a reload (the page's replaceState), a modified click
  // follows the href. No hover preload (it would fetch the page data for a link that never navigates). Capture phase: SvelteKit's own link handler runs before a delegated onclick. The # mark shows
  // on hover and focus (faintly always on touch, which has no hover). A load or click on the hash scrolls the
  // heading to just under the sticky filter bar (CollapsibleBar sets scroll-padding-top).
  let { id, level = 2, class: cls = '', children }: { id: string; level?: 2 | 3; class?: string; children: Snippet } = $props();
  const link = useChartLink();
  function onclick(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    link.go(id);
  }
</script>

<svelte:element this={`h${level}`} {id} class="heading-anchor {cls}">
  <a href={link.href(id)} onclickcapture={onclick} data-sveltekit-preload-data="off">{@render children()}<Icon name="hash" /></a>
</svelte:element>

<style>
  .heading-anchor {
    scroll-margin-top: var(--space-2);
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  a :global(.icon) {
    width: 0.8em;
    height: 0.8em;
    margin-inline-start: 0.3em;
    vertical-align: -0.05em;
    color: var(--color-text-muted);
    opacity: 0;
  }
  a:hover :global(.icon),
  a:focus-visible :global(.icon) {
    opacity: 1;
  }
  a:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  @media (hover: none) {
    a :global(.icon) {
      opacity: 0.5;
    }
  }
</style>
