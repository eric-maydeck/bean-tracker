<script lang="ts">
  // "Your <year> recap is ready", admin only. Looks like a toast, sits above the phone tab bar; never takes focus.
  import { goto, invalidateAll } from '$app/navigation';
  let { year }: { year: number } = $props();
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
<div class="recap-banner" role="status">
  <span>Your {year} recap is ready</span>
  <div class="actions" data-button-row>
    <button type="button" onclick={open}>Open</button>
    <button type="button" onclick={dismiss}>Dismiss</button>
  </div>
</div>
{/if}

<style>
  .recap-banner {
    position: fixed;
    left: 50%;
    bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
    z-index: 45; /* over the tab bar's row, under modals */
    transform: translateX(-50%);
    box-sizing: border-box;
    max-width: calc(100vw - 2 * var(--space-4));
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    box-shadow: var(--shadow-hover);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  button {
    flex: 1;
    min-height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid currentColor;
    border-radius: var(--radius);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  button:hover,
  button:focus-visible {
    background: var(--color-surface);
    color: var(--color-text);
  }
  @media (max-width: 640px) {
    .recap-banner {
      bottom: calc(56px + var(--space-3) + env(safe-area-inset-bottom, 0px));
      flex-direction: column;
      align-items: stretch;
      width: calc(100vw - 2 * var(--space-4));
    }
    button {
      min-height: 44px;
    }
  }
  /* Landscape phones: one slim row, 44px targets. */
  @media (max-height: 450px) and (min-width: 641px) {
    button {
      min-height: 44px;
    }
  }
</style>
