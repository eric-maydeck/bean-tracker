<script lang="ts">
  import { onMount } from 'svelte';
  import { tidyList } from '#lib/pick/custom.ts';

  // The Enter coffees pop-up: one coffee per line. Save tidies the text and shows the tidied list; it stays open.
  let { names, onsave, onclose }: { names: string[]; onsave: (names: string[], cut: boolean) => void; onclose: () => void } = $props();

  let text = $state(names.join('\n'));
  let modalEl: HTMLDivElement | undefined = $state();
  const changed = $derived(text !== names.join('\n'));

  function save() {
    const t = tidyList(text);
    text = t.names.join('\n');
    onsave(t.names, t.cut);
  }

  // Focus the Close button (not the box: no phone keyboard); Tab stays inside; Escape closes.
  let opener: HTMLElement | null = null;
  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalEl?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  });
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') return onclose();
    if (e.key !== 'Tab' || !modalEl) return;
    const els = [...modalEl.querySelectorAll<HTMLElement>('button:not([disabled]), textarea')];
    const [first, last] = [els[0], els[els.length - 1]];
    if (!modalEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled on the window) -->
<div class="modal-backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal custom-list" role="dialog" aria-modal="true" aria-label="Enter coffees" tabindex="-1" bind:this={modalEl}>
    <h3>Enter coffees</h3>
    <p class="shared-note">One coffee per line (commas work too). Saved in this browser only, until you clear it or clear this site's data. Some browsers clear it sooner: Safari removes a site's data after 7 days without a visit, and private windows forget it when closed.</p>
    <div class="form-field">
      <textarea rows="10" aria-label="Coffees, one per line" bind:value={text}></textarea>
    </div>
    <div class="buttons">
      <button type="button" class="button button-success" disabled={!changed} onclick={save}>Save</button>
      <button type="button" class="button button-secondary" onclick={() => (text = '')}>Clear</button>
      <button type="button" class="button button-secondary" data-close onclick={onclose}>Close</button>
    </div>
  </div>
</div>

<style>
  .custom-list { max-width: 32rem; display: grid; gap: var(--space-3); }
  .custom-list h3 { margin: 0; }
  .custom-list textarea { width: 100%; box-sizing: border-box; resize: vertical; }
  /* the callout look (as in PickForMe), as a plain note */
  .shared-note { margin: 0; border: 1px solid var(--color-warm); border-radius: var(--radius); background: color-mix(in srgb, var(--color-warm) 12%, transparent); padding: var(--space-2) var(--space-3); font-size: 0.9rem; }
  .buttons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); }
  .buttons :global(.button) { margin: 0; justify-content: center; min-height: 36px; }
  @media (max-width: 640px) { .buttons :global(.button) { min-height: 44px; } }
</style>
