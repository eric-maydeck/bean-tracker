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
  // `wide` (the inline card): the coffee page's detail as stats (producer, region, variety, ...) in place of the plain lines, filling
  // the card's height. `onclose` is set only where the card can be dismissed (the phone overlay).
  let { coffee, result, out, brewed, busy, wide = false, onbrew, ondiscard, onopen, onclose }: {
    coffee: PickCoffee; result: PickResult; out: boolean; brewed: boolean; busy: boolean; wide?: boolean;
    onbrew: () => void; ondiscard: () => void; onopen: () => void; onclose?: () => void;
  } = $props();

  const locked = $derived(busy || out);
  const info = $derived(coffee.info);

  // Most useful first; only what has a value; the first 8 fit the card (4 rows of 2), tasting notes get their own line.
  // The coffee page's labels (COFFEE_ORIGIN_LABELS) and stat styles.
  type Stat = { label: string; text?: string; cost?: number };
  const stats = $derived.by((): Stat[] => {
    if (!info) return [];
    const rest = info.drinkAfter && info.drinkBefore ? `${formatDate(info.drinkAfter)} – ${formatDate(info.drinkBefore)}` : '';
    const all: (Stat | false | '' | null | undefined)[] = [
      coffee.processing && { label: 'Processing', text: coffee.processing },
      info.costPerGram != null ? { label: 'Cost', cost: info.costPerGram, text: info.amountG != null ? ` · ${formatBag(info.amountG, info.gramsLeft)}` : '' } : info.amountG != null && { label: 'Bag', text: formatBag(info.amountG, info.gramsLeft) },
      info.roastDate && { label: 'Roasted', text: `${formatDate(info.roastDate)}${info.daysSinceRoast != null ? ` (${info.daysSinceRoast}d ago)` : ''}` },
      rest && { label: 'Rest window', text: rest },
      info.producer && { label: 'Producer', text: info.producer },
      info.region && { label: 'Region', text: info.region },
      info.variety && { label: 'Variety', text: info.variety },
      info.elevation && { label: 'Elevation', text: info.elevation },
      info.farm && { label: 'Farm', text: info.farm },
      info.harvestTime && { label: 'Harvest', text: info.harvestTime },
      info.certification && { label: 'Certification', text: info.certification }
    ];
    return all.filter((s): s is Stat => !!s).slice(0, 8);
  });
</script>

{#snippet badges()}
  {#if info?.status === 'archive'}<span class="badge badge-fresh">Archive</span>{:else if info?.status === 'open'}<span class="badge badge-warm">Open</span>{:else if info}<span class="badge badge-neutral">Backlog</span>{/if}
  {#if coffee.decaf}<span class="badge badge-decaf">Decaf</span>{/if}
  {#if coffee.category === 'frozen'}<span class="badge badge-frozen">Frozen</span>{/if}
{/snippet}

<article class="pick-card" class:wide class:noimg={!coffee.image} aria-label="Pick result">
  {#if coffee.image}<img class="card-thumb" src={coffee.image} alt="" style:background-color={coffee.fill} />{/if}
  <div class="rest">
  <div class="card-body">
  <div class="head">
    <!-- one line: the name truncates, a badge never wraps it or changes the height -->
    <div class="name-row">
      <h3 class="name" use:truncTip>{#if out}<s><CoffeeName name={coffee.name} /></s>{:else}<CoffeeName name={coffee.name} />{/if}</h3>
      {#if result.via === 'success'}<span class="badge badge-warm">Critical success</span>{/if}
      {#if result.via === 'fail'}<span class="badge badge-urgent">Critical fail</span>{/if}
      {#if out}<span class="badge badge-neutral">Out for today</span>{/if}
      {#if brewed && !out}<span class="badge badge-fresh">Brewed today</span>{/if}
    </div>
    {#if wide}
      <p class="sub"><span class="text-muted" use:truncTip>{coffee.roaster}</span><span class="badges">{@render badges()}</span></p>
    {:else}
      <p class="text-muted">{coffee.roaster}</p>
    {/if}
    {#snippet origin()}{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}{/snippet}
    {#snippet roast()}
      <RoastBeans degrees={info?.degrees ?? 0} />
      <span class="text-muted">{coffee.roastLevel ?? 'Roast level unknown'}</span>
    {/snippet}
    {#if wide}
      <!-- origin and roast level share a line: the height goes to the detail -->
      <p class="meta"><span class="origin" use:truncTip>{@render origin()}</span><span class="roast-row">{@render roast()}</span></p>
    {:else}
      <p>{@render origin()}</p>
      <p class="roast-row">{@render roast()}</p>
    {/if}
  </div>
  {#if wide}
    <div class="detail">
      {#if stats.length}
        <div class="stat-grid">
          {#each stats as s (s.label)}
            <div class="stat">
              <span class="stat-label">{s.label}</span>
              <span class="stat-value" use:truncTip>{#if s.cost != null}<Usd n={s.cost} suffix="/g" />{/if}{s.text}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#if info?.tastingNotes}
        <div class="stat">
          <span class="stat-label">Tasting notes</span>
          <span class="stat-value notes" use:truncTip>{info.tastingNotes}</span>
        </div>
      {/if}
    </div>
  {:else}
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
    {/if}
    {@render badges()}
  {/if}
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
  .pick-card.wide { width: 100%; } /* inline: the card's whole width (the overlay's stays 280px) */
  .rest { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-body { margin-bottom: var(--space-3); }
  .name-row { display: flex; align-items: center; gap: var(--space-2); min-height: 1.9rem; }
  .name { margin: 0; padding: 0; border: 0; font-size: 1rem; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name-row .badge { flex: none; white-space: nowrap; }
  .sub { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .sub > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .meta .origin { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta .roast-row { flex: none; }
  .badges { display: flex; gap: var(--space-1); flex: none; }
  .detail { display: flex; flex-direction: column; gap: var(--space-2); }
  .detail .stat-grid { grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: var(--space-1) var(--space-3); }
  .detail .stat { min-width: 0; gap: 0; }
  .detail .stat-label { line-height: 1.2; }
  .detail .stat-value { font-size: 0.85rem; line-height: 1.3; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* same size, close together, one aligned row at the card's foot */
  .buttons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin-top: auto; }
  .buttons.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .buttons :global(.button) { margin: 0; padding: 0.35rem 0.25rem; min-height: 36px; font-size: 0.85rem; justify-content: center; white-space: nowrap; }
  @media (max-width: 640px) { .buttons :global(.button) { min-height: 44px; } }
  /* The inline card on a desktop: as tall as the D20 tray (--pick-h), the thumbnail a square of that height (the same padding all round)
     with the detail beside it. A card with an image keeps that height and spreads its groups; one without is as tall as its content.
     Narrower than the thumbnail + 300px of detail (640px of content): the vertical card. */
  @container card (min-width: 640px) {
    .pick-card.wide { width: 100%; display: grid; grid-template-columns: calc(var(--pick-h, 360px) - 2 * var(--space-4) - 2px) minmax(0, 1fr); gap: var(--space-4); }
    .pick-card.wide:not(.noimg) { height: calc(var(--pick-h, 360px) - 2 * var(--space-4) - 2px); }
    .pick-card.wide.noimg { display: block; }
    .wide .card-thumb { margin: 0; }
    .wide .card-body { margin: 0 0 var(--space-2); flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: var(--space-2); min-height: 0; overflow: hidden; }
    .wide .head :global(p) { margin: 0 0 2px; }
    .wide .name-row { min-height: 1.5rem; } /* a badge appearing never changes the height */
  }
</style>
