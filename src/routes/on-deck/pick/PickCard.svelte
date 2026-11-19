<script lang="ts">
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import { truncTip } from '#lib/components/labelTip.ts';
  import { originWithFlag } from '#lib/countryFlags.ts';
  import type { PickCoffee, PickResult } from '#lib/pick/types.ts';

  // The /coffees card's content (thumbnail, name, roaster, origin, roast, process) with Brew, Discard and Open coffee under it.
  // `onclose` is set only where the card can be dismissed (the phone overlay).
  let { coffee, result, out, brewed, busy, onbrew, ondiscard, onopen, onclose }: {
    coffee: PickCoffee; result: PickResult; out: boolean; brewed: boolean; busy: boolean;
    onbrew: () => void; ondiscard: () => void; onopen: () => void; onclose?: () => void;
  } = $props();

  const locked = $derived(busy || out);
</script>

<article class="pick-card" aria-label="Pick result">
  {#if coffee.image}<img class="card-thumb thumb" src={coffee.image} alt="" style:background-color={coffee.fill} />{/if}
  <div class="name-row">
    <h3 class="name" use:truncTip>{#if out}<s><CoffeeName name={coffee.name} /></s>{:else}<CoffeeName name={coffee.name} />{/if}</h3>
    {#if result.via === 'success'}<span class="badge badge-warm">Critical success</span>{/if}
    {#if result.via === 'fail'}<span class="badge badge-urgent">Critical fail</span>{/if}
    {#if out}<span class="badge badge-neutral">Out for today</span>{/if}
    {#if brewed && !out}<span class="badge badge-fresh">Brewed today</span>{/if}
  </div>
  <p class="text-muted">{coffee.roaster}</p>
  <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
  <p class="text-muted">{coffee.roastLevel ?? 'Roast level unknown'}</p>
  {#if coffee.processing}<p class="text-muted">{coffee.processing}</p>{/if}
  <div class="buttons" class:four={!!onclose}>
    <button type="button" class="button" disabled={locked} onclick={onbrew}>Brew</button>
    <button type="button" class="button button-secondary" disabled={locked} onclick={ondiscard}>Discard</button>
    <button type="button" class="button button-secondary" disabled={busy} onclick={onopen}>Open coffee</button>
    {#if onclose}<button type="button" class="button button-secondary" data-close disabled={busy} onclick={onclose}>Close</button>{/if}
  </div>
</article>

<style>
  .pick-card p { margin: var(--space-1) 0 0; }
  /* the coffee page's picture size (280px square at most) */
  .thumb { max-width: 280px; }
  /* one line: the name truncates, a badge never wraps it or changes the height */
  .name-row { display: flex; align-items: center; gap: var(--space-2); min-height: 1.9rem; }
  .name { margin: 0; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name-row .badge { flex: none; white-space: nowrap; }
  /* same size, close together, one aligned row */
  .buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin-top: var(--space-3); }
  .buttons.four { grid-template-columns: repeat(2, 1fr); }
  .buttons :global(.button) { min-height: 44px; margin: 0; justify-content: center; }
  @media (max-width: 640px) { .thumb { max-width: 200px; } }
</style>
