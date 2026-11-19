<script lang="ts">
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import RoastBeans from '#lib/components/RoastBeans.svelte';
  import Usd from '#lib/components/Usd.svelte';
  import { truncTip } from '#lib/components/labelTip.ts';
  import { originWithFlag } from '#lib/countryFlags.ts';
  import { formatDate } from '#lib/formatDate.ts';
  import { formatBag } from '#lib/grams.ts';
  import type { PickCoffee, PickResult } from '#lib/pick/types.ts';

  // The /coffees cards view's card (same fields, order and classes) with Brew, Discard and Open coffee under it.
  // `onclose` is set only where the card can be dismissed (the phone overlay).
  let { coffee, result, out, brewed, busy, wide = false, onbrew, ondiscard, onopen, onclose }: {
    coffee: PickCoffee; result: PickResult; out: boolean; brewed: boolean; busy: boolean; wide?: boolean;
    onbrew: () => void; ondiscard: () => void; onopen: () => void; onclose?: () => void;
  } = $props();

  const locked = $derived(busy || out);
  const info = $derived(coffee.info);
</script>

<article class="pick-card" class:wide aria-label="Pick result">
  {#if coffee.image}<img class="card-thumb" src={coffee.image} alt="" style:background-color={coffee.fill} />{:else if wide}<div class="card-thumb ph" style:background-color={coffee.fill}></div>{/if}
  <div class="rest">
  <div class="card-body">
    <!-- one line: the name truncates, a badge never wraps it or changes the height -->
    <div class="name-row">
      <h3 class="name" use:truncTip>{#if out}<s><CoffeeName name={coffee.name} /></s>{:else}<CoffeeName name={coffee.name} />{/if}</h3>
      {#if result.via === 'success'}<span class="badge badge-warm">Critical success</span>{/if}
      {#if result.via === 'fail'}<span class="badge badge-urgent">Critical fail</span>{/if}
      {#if out}<span class="badge badge-neutral">Out for today</span>{/if}
      {#if brewed && !out}<span class="badge badge-fresh">Brewed today</span>{/if}
    </div>
    <p class="text-muted">{coffee.roaster}</p>
    <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
    <p class="roast-row">
      <RoastBeans degrees={info?.degrees ?? 0} />
      <span class="text-muted">{coffee.roastLevel ?? 'Roast level unknown'}</span>
    </p>
    {#if coffee.processing}<p class="text-muted">{coffee.processing}</p>{/if}
    {#if info}
      <p class="text-muted">
        {#if info.costPerGram != null}<Usd n={info.costPerGram} suffix="/g" />{:else}Cost unknown{/if}
        {info.amountG != null ? ` · ${formatBag(info.amountG, info.gramsLeft)}` : ''}
      </p>
      {#if info.roastDate}
        <p class="text-muted">
          Roasted {formatDate(info.roastDate)}
          {info.daysSinceRoast != null ? ` (${info.daysSinceRoast}d ago)` : ''}
        </p>
      {/if}
      {#if info.drinkAfter && info.drinkBefore}
        <p class="text-muted">Rest window: {formatDate(info.drinkAfter)} – {formatDate(info.drinkBefore)}</p>
      {/if}
      {#if info.status === 'archive'}<span class="badge badge-fresh">Archive</span>{:else if info.status === 'open'}<span class="badge badge-warm">Open</span>{:else}<span class="badge badge-neutral">Backlog</span>{/if}
    {/if}
    {#if coffee.decaf}<span class="badge badge-decaf">Decaf</span>{/if}
    {#if coffee.category === 'frozen'}<span class="badge badge-frozen">Frozen</span>{/if}
  </div>
  <div class="buttons" class:four={!!onclose}>
    <button type="button" class="button" disabled={locked} onclick={onbrew}>Brew</button>
    <button type="button" class="button button-secondary" disabled={locked} onclick={ondiscard}>Discard</button>
    <button type="button" class="button button-secondary" disabled={busy} onclick={onopen}>Open coffee</button>
    {#if onclose}<button type="button" class="button button-secondary" data-close disabled={busy} onclick={onclose}>Close</button>{/if}
  </div>
  </div>
</article>

<style>
  /* the thumbnail fills the width, so the card's padding is the same left, top and right of it */
  .pick-card { width: 280px; max-width: 100%; display: flex; flex-direction: column; }
  .rest { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  /* horizontal: the thumbnail left (the card is as tall as it), the fields and buttons right */
  .pick-card.wide { width: 100%; }
  .ph { display: none; } /* the no-image placeholder keeps the horizontal card's shape: desktop only */
  @media (min-width: 641px) {
    .pick-card.wide { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: var(--space-4); }
    .wide .card-thumb { margin: 0; }
    .ph { display: block; background: var(--color-bg); }
    .wide .card-body { margin-bottom: var(--space-2); }
    .wide .card-body :global(p) { margin: 0 0 2px; }
    .wide .name-row { min-height: 0; }
  }
  .card-body { margin-bottom: var(--space-3); }
  .name-row { display: flex; align-items: center; gap: var(--space-2); min-height: 1.9rem; }
  .name { margin: 0; padding: 0; border: 0; font-size: 1rem; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name-row .badge { flex: none; white-space: nowrap; }
  /* same size, close together, one aligned row at the card's foot (Reset today shares this size) */
  .buttons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin-top: auto; }
  .buttons.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .buttons :global(.button) { margin: 0; padding: 0.35rem 0.25rem; min-height: 36px; font-size: 0.85rem; justify-content: center; white-space: nowrap; }
  @media (max-width: 640px) { .buttons :global(.button) { min-height: 44px; } }
</style>
