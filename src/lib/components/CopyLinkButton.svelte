<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import { copyLinkOf } from '#lib/copyLink.ts';

  // The link icon after a heading's link (Stats HeadingAnchor, recipe titles): copies that link's full URL with a
  // "Link copied" toast. Place it right after the <a>, inside the heading. It shows on hover of the heading and on
  // focus, and always on touch (no hover); phones give it a 44px tap target.
  const copy = (e: MouseEvent) => copyLinkOf((e.currentTarget as HTMLElement).previousElementSibling as HTMLAnchorElement);
</script>

<button type="button" class="copy-link" aria-label="Copy link" onclick={copy}><Icon name="link" /></button>

<style>
  .copy-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  /* Inline-block on the heading's line height, like a "?" button beside it, so the two share a top and height. */
  .copy-link {
    display: inline-block;
    /* 1.1em after the text (0.3em gap + 0.8em icon), so tight heads (Leaderboards' board heads in phone landscape)
       still fit on one row. */
    padding: 0 0 0 0.3em;
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
  :global(:is(h2, h3):hover) > .copy-link,
  .copy-link:focus-visible,
  :global(a:focus-visible) + .copy-link {
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
