<script lang="ts">
  import { usd, wholeUsd } from '$lib/money';
  import { signed, deltaInk } from '$lib/components/deltaColor';
  import { countText } from '$lib/sample';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import type { PlanPanel } from '$lib/server/insights/spend';

  let { p, link }: { p: PlanPanel; link: (href: string) => string } = $props();

  // One scale for every bar and the one-off line.
  const max = $derived(Math.max(0, ...p.rows.map((r) => r.ppg ?? 0), p.oneOffPpg ?? 0));
  const whole = $derived(wholeUsd([...p.rows.map((r) => r.perMonth), p.total.perMonth]));
  const bagsText = (n: number) => `${countText(n)} bag${n === 1 ? '' : 's'}`;
  // $/g: lower is better; a gap under 2% of the one-off price is plain ink.
  const PPG_NOISE = 0.02;
  const ppgInk = (v: number, one: number) => (Math.abs(v - one) < PPG_NOISE * one ? '' : v < one ? 'ink-better' : 'ink-worse');
  const ppgGap = (v: number, one: number) => `${v < one ? '−' : '+'}${usd(Math.abs(v - one))}`;
</script>

{#snippet vs(r: { ppg: number | null; rating: number | null; sample?: import('$lib/sample').Sample })}
  <span class="vs">
    {#if r.ppg !== null}
      <span>{usd(r.ppg)}/g{#if p.oneOffPpg !== null}{' '}<span class={ppgInk(r.ppg, p.oneOffPpg)}>vs {usd(p.oneOffPpg)}/g one-off ({ppgGap(r.ppg, p.oneOffPpg)})</span>{/if}</span>
    {/if}
    {#if r.rating !== null}
      <span class:small-sample={r.sample?.small}>{r.rating.toFixed(1)}{#if p.oneOffRating !== null}{' '}<span class={r.sample?.small ? '' : deltaInk(r.rating - p.oneOffRating)}>vs {p.oneOffRating.toFixed(1)} one-off ({signed(r.rating - p.oneOffRating, 1)})</span>{/if}</span>
      {#if r.sample?.small}<SampleNote s={r.sample} />{/if}
    {/if}
  </span>
{/snippet}

<ul class="plans">
  {#each p.rows as r (r.id)}
    <li>
      <div class="head">
        <span class="name">{r.name}</span>
        {#if r.paused}<span class="badge badge-neutral">Paused</span>{/if}
        <span class="money">{r.perMonth === null ? '—' : `${usd(r.perMonth, whole)}/mo`}<span class="sr-only"> per month</span></span>
        <span class="bags">{bagsText(r.bags)}</span>
      </div>
      {#if r.bags > 0}
        {#if r.ppg !== null && max > 0}
          <div class="track" role="img" aria-label="{usd(r.ppg)} per gram{p.oneOffPpg !== null ? `, one-off ${usd(p.oneOffPpg)} per gram` : ''}">
            <div class="bar" style:width="{(100 * r.ppg) / max}%"></div>
            {#if p.oneOffPpg !== null}<div class="ref" style:left="{(100 * p.oneOffPpg) / max}%"></div>{/if}
          </div>
        {/if}
        {@render vs(r)}
      {/if}
    </li>
  {/each}
  <li class="total">
    <div class="head">
      <span class="name">Total</span>
      <span class="money">{p.total.perMonth === null ? '—' : `${usd(p.total.perMonth, whole)}/mo`}</span>
      <span class="bags">{bagsText(p.total.bags)}</span>
    </div>
    {#if p.total.bags > 0}{@render vs(p.total)}{/if}
  </li>
</ul>
<p class="chart-note">Bags counted by roast date. <a href={link('/subscriptions')}>Manage plans</a></p>

<style>
  .plans {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }
  li:first-child {
    border-top: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-variant-numeric: tabular-nums;
  }
  .name {
    flex: 0 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 600;
  }
  .badge {
    white-space: nowrap;
    flex: none;
  }
  .money {
    margin-left: auto;
    white-space: nowrap;
  }
  .bags {
    flex: none;
    min-width: 4.5rem;
    text-align: right;
    white-space: nowrap;
    color: var(--color-text-muted);
  }
  .track {
    position: relative;
    height: 0.75rem;
  }
  .bar {
    height: 100%;
    border-radius: 0 3px 3px 0;
    background: var(--series-brown-2);
  }
  .ref {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    background: var(--color-text);
  }
  .vs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-3);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }
  .total .name,
  .total .money {
    font-weight: 700;
  }
</style>
