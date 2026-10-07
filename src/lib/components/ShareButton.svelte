<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  // Long, filter-heavy views get a short link (/s/<code>); short ones are
  // shared as-is. Phones get the native share sheet; elsewhere the link is
  // copied (prompt fallback where the clipboard API is unavailable, e.g.
  // plain-http LAN testing). Reads `location`, not `page.url`, which
  // doesn't follow replaceState (see urlState.ts).
  const SHORTEN_OVER = 60;
  let copied = $state(false);

  async function share() {
    const path = location.pathname + location.search;
    let link = location.origin + path;
    if (path.length > SHORTEN_OVER) {
      try {
        const res = await fetch('/s', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: path })
        });
        if (res.ok) link = `${location.origin}/s/${(await res.json()).code}`;
      } catch {
        // fall back to the full link
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ url: link });
      } catch {
        // user cancelled
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      window.prompt('Copy this link', link);
    }
  }
</script>

<button type="button" class="button button-secondary share-button" onclick={share} aria-live="polite">
  <Icon name="share-network" />
  {copied ? 'Link copied' : 'Share'}
</button>

<style>
  .share-button {
    display: inline-flex;
    /* Baseline from the label, not the icon: at desktop the sibling buttons
       are inline-block on a shared baseline, and an icon-first inline-flex
       button otherwise sits a few px higher than them. */
    align-items: baseline;
    gap: var(--space-2);
  }
  .share-button :global(.icon) {
    align-self: center;
    width: 1.05rem;
    height: 1.05rem;
  }
</style>
