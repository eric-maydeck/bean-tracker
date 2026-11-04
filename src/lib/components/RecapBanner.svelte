<script lang="ts">
  // "Your <year> recap is ready", admin only. A full-bleed strip at the very top of the page, above the nav, in the recap's cover tone; never takes focus.
  import { goto, invalidateAll } from '$app/navigation';
  import type { Tone } from '$lib/server/recaps/types';
  let { year, tone }: { year: number; tone: Tone } = $props();
  // The year's cover tone, with the ink the recap slides use on it.
  const ink = $derived(['sun', 'amber', 'cream'].includes(tone) ? '#2b211b' : '#faf7f2');
  let hidden = $state(false);

  async function seen() {
    try { // a failed save must not block Open or Dismiss; the banner just returns next load
      await fetch('/api/recaps/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year }) });
    } catch { /* offline */ }
  }
  async function open() {
    await seen();
    await goto(`/recaps/${year}`, { invalidateAll: true });
  }
  async function dismiss() {
    await seen();
    hidden = true;
    await invalidateAll();
  }
</script>

{#if !hidden}
<div class="recap-banner" role="status" style:--bg="var(--t-{tone})" style:--fg={ink}>
  <span>Your {year} recap is ready</span>
  <div class="actions" data-button-row>
    <button type="button" onclick={open}><span>Open</span></button>
    <button type="button" onclick={dismiss}><span>Dismiss</span></button>
  </div>
</div>
{/if}

<style>
  /* Edge to edge, one slim row; scrolls away with the page (not sticky). Text and buttons are one centered group; wraps to 2 rows only when it must (320px). */
  .recap-banner {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0 var(--space-3);
    padding: 4px max(var(--space-4), calc((100% - var(--container-max)) / 2 + var(--space-4)));
    background: var(--bg);
    color: var(--fg);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  /* The button is the 44px tap target (site rule); the pill you see is the smaller span inside it. */
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }
  button span {
    display: block;
    box-sizing: border-box;
    min-height: 32px;
    padding: 0 var(--space-3);
    line-height: 29px;
    border: 1.5px solid currentColor;
    border-radius: 16px;
  }
  button:hover span { background: color-mix(in srgb, currentColor 18%, transparent); }
  button:focus-visible { outline: 3px solid currentColor; outline-offset: -2px; border-radius: 22px; }
</style>
