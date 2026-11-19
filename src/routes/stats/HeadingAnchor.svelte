<script lang="ts">
  import type { Snippet } from 'svelte';
  import CopyLinkButton from '#lib/components/CopyLinkButton.svelte';
  import { useChartLink } from './chartLink';
  import { plainClick } from '#lib/copyLink.ts';

  // A section heading that links to itself (?…&chart=<id>#<id>), so its URL can be shared and previews name it:
  // a plain click on the text puts that URL in the address bar without a reload (the page's shallow goto), a modified
  // click follows the href. No hover preload (it would fetch the page data for a link that never navigates). Capture
  // phase: SvelteKit's own link handler runs before a delegated onclick. The link icon after the text is its own
  // button (CopyLinkButton): it copies the link's full URL with a "Link copied" toast. A load or click on the hash scrolls the heading to
  // just under the sticky filter bar (CollapsibleBar sets scroll-padding-top).
  let { id, level = 2, class: cls = '', children }: { id: string; level?: 2 | 3; class?: string; children: Snippet } = $props();
  const link = useChartLink();
  function onclick(e: MouseEvent) {
    if (!plainClick(e)) return;
    e.preventDefault();
    link.go(id);
  }
</script>

<!-- Named by its text alone (aria-labelledby), not "… Copy link". Its own row scope (checkLayout): the icon rides the heading's
     text line, so its tap area follows the heading's line height, not that of a "?" button beside the heading (LabHead);
     the two icons share the row's baseline. -->
<svelte:element this={`h${level}`} {id} class="heading-anchor {cls}" aria-labelledby="{id}-text" data-row-scope>
  <a id="{id}-text" href={link.href(id)} onclickcapture={onclick} data-sveltekit-preload-data="false">{@render children()}</a><CopyLinkButton />
</svelte:element>

<style>
  .heading-anchor {
    scroll-margin-top: var(--space-2);
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  a:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
