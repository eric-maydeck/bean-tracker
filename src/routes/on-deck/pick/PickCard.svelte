<script lang="ts">
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import type { PickCoffee, PickResult } from '#lib/pick/types.ts';

  let { coffee, result, out, brewed, busy, againDisabled, againLabel, onbrew, ondiscard, onopen, onagain, onclose }: {
    coffee: PickCoffee; result: PickResult; out: boolean; brewed: boolean; busy: boolean; againDisabled: boolean; againLabel: string;
    onbrew: () => void; ondiscard: () => void; onopen: () => void; onagain: () => void; onclose: () => void;
  } = $props();

  const locked = $derived(busy || out);
</script>

<article class="pick-card card" aria-label="Pick result">
  {#if coffee.image}<img class="thumb" src={coffee.image} alt="" />{/if}
  <div class="info">
    <h2 class="name">
      {#if result.n}<span class="num">{result.n}</span>{/if}
      {#if out}<s><CoffeeName name={coffee.name} /></s>{:else}<CoffeeName name={coffee.name} />{/if}
      <span class="badges">
      {#if result.via === 'success'}<span class="badge badge-warm">Critical success</span>{/if}
      {#if result.via === 'fail'}<span class="badge badge-urgent">Critical fail</span>{/if}
      {#if out}<span class="badge badge-neutral">Out for today</span>{/if}
      {#if brewed && !out}<span class="badge badge-fresh">Brewed today</span>{/if}
      </span>
    </h2>
    <p class="text-muted">{coffee.roaster}</p>
    <div class="buttons">
      <button type="button" class="button" disabled={locked} onclick={onbrew}>Brew</button>
      <button type="button" class="button button-secondary" disabled={locked} onclick={ondiscard}>Discard</button>
      <button type="button" class="button button-secondary" disabled={busy} onclick={onopen}>Open coffee page</button>
      <button type="button" class="button button-secondary" disabled={busy || againDisabled} onclick={onagain}>{againLabel}</button>
      <button type="button" class="button button-secondary" disabled={busy} onclick={onclose}>Close</button>
    </div>
  </div>
</article>

<style>
  .pick-card { display: flex; gap: var(--space-4); align-items: flex-start; margin: var(--space-3) 0; }
  .thumb { width: 84px; height: 104px; object-fit: cover; border-radius: var(--radius); flex-shrink: 0; }
  .info { min-width: 0; flex: 1; }
  .name { margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .badges { display: contents; }
  @media (max-width: 640px) { .badges { display: flex; flex-basis: 100%; gap: var(--space-2); min-height: 1.7rem; } } /* a reserved line: a badge never moves the buttons */
  .num { display: inline-grid; place-items: center; min-width: 1.8rem; height: 1.8rem; border-radius: 50%; background: var(--color-accent); color: var(--color-accent-contrast); font-size: 0.85rem; }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
  .buttons :global(.button) { min-height: 44px; }
</style>
