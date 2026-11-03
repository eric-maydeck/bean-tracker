<script lang="ts">
  // "Your <year> recap is ready", admin only. A page banner (in flow, top of the content); never takes focus.
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
  /* In flow at the top of the page content, full width; stays until Open or Dismiss. */
  .recap-banner {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  button {
    min-height: 44px;
    padding: 0 var(--space-4);
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
  @media (max-width: 480px) {
    .actions { flex: 1 1 100%; }
    button { flex: 1; }
  }
</style>
