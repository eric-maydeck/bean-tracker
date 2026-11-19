<script lang="ts">
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import type { PickCoffee, PickResult } from '#lib/pick/types.ts';

  let { coffee, result, out, brewed, busy, onbrew, ondiscard, onopen, onclose }: {
    coffee: PickCoffee; result: PickResult; out: boolean; brewed: boolean; busy: boolean;
    onbrew: () => void; ondiscard: () => void; onopen: () => void; onclose: () => void;
  } = $props();

  const locked = $derived(busy || out);
</script>

<article class="pick-card" aria-label="Pick result">
  {#if coffee.image}<img class="thumb" src={coffee.image} alt="" style:background-color={coffee.fill} />{/if}
  <div class="info">
    <h3 class="name">
      {#if out}<s><CoffeeName name={coffee.name} /></s>{:else}<CoffeeName name={coffee.name} />{/if}
      <span class="badges">
        {#if result.via === 'success'}<span class="badge badge-warm">Critical success</span>{/if}
        {#if result.via === 'fail'}<span class="badge badge-urgent">Critical fail</span>{/if}
        {#if out}<span class="badge badge-neutral">Out for today</span>{/if}
        {#if brewed && !out}<span class="badge badge-fresh">Brewed today</span>{/if}
      </span>
    </h3>
    <p class="text-muted">{coffee.roaster}</p>
    <div class="buttons">
      <button type="button" class="button" disabled={locked} onclick={onbrew}>Brew</button>
      <button type="button" class="button button-secondary" disabled={locked} onclick={ondiscard}>Discard</button>
      <button type="button" class="button button-secondary" disabled={busy} onclick={onopen}>Open coffee page</button>
      <button type="button" class="button button-secondary" data-close disabled={busy} onclick={onclose}>Close</button>
    </div>
  </div>
</article>

<style>
  .pick-card { display: flex; gap: var(--space-4); align-items: flex-start; }
  .thumb { width: 84px; height: 104px; object-fit: contain; border-radius: var(--radius); flex-shrink: 0; }
  .info { min-width: 0; flex: 1; }
  .name { margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  /* a reserved line under the name, on every width: a badge never wraps the name or moves the buttons */
  .badges { display: flex; flex-basis: 100%; gap: var(--space-2); min-height: 1.7rem; }
  .info p { margin: var(--space-1) 0 0; }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-2); }
  .buttons :global(.button) { min-height: 44px; }
</style>
