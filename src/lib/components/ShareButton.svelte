<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { copyText } from '$lib/copyLink';

  // Long, filter-heavy views get a short link (/s/<code>); short ones are
  // shared as-is. Phones get the native share sheet; elsewhere the link is
  // copied (prompt fallback where the clipboard API is unavailable, e.g.
  // plain-http LAN testing). Reads `location`, not `page.url`, which
  // doesn't follow replaceState (see urlState.ts).
  const SHORTEN_OVER = 60;
  // `path`: share this path (+ query) instead of the current one (a recap slide's own link).
  let { path: given }: { path?: string } = $props();
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function share() {
    const path = given ?? location.pathname + location.search;
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
        return;
      } catch (e) {
        // Canceled: done. InvalidStateError: an earlier sheet never settled and the
        // browser refuses until it does, so copy instead (user, 2026-10-25).
        if ((e as DOMException).name !== 'InvalidStateError') return;
      }
    }
    if ((await copyText(link)) === 'copied') {
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 2000);
    }
  }
</script>

<button type="button" class="button button-ghost share-button" onclick={share} aria-live="polite">
  <Icon name="share-network" />
  {copied ? 'Link copied' : 'Share'}
</button>

<style>
  .share-button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    /* In inline flow (desktop rows of inline-block buttons) an inline-flex
       button's baseline comes from its icon, which sat it ~4px above its
       same-height neighbors; top-align it instead. No effect in flex rows. */
    vertical-align: top;
  }
  .share-button :global(.icon) {
    width: 1.05rem;
    height: 1.05rem;
  }
</style>
