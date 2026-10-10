<script lang="ts">
  import { goto } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { formatGrams } from '$lib/grams';
  import { RANGES, RANGE_LABELS, insightsParams, withDefaults, type InsightsUrlState } from '$lib/insightsUrl';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let s = $derived(withDefaults(data.explicit));

  // The server computes every tile from the URL, so a toggle is a navigation.
  function choose(change: InsightsUrlState) {
    const qs = insightsParams({ ...data.explicit, ...change }).toString();
    goto(qs ? `?${qs}` : location.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  }

  const ROLLING = RANGES.filter((r) => r !== 'ytd' && r !== 'all');
  const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const count = (n: number) => Math.round(n).toLocaleString('en-US');
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const span = (p: { start: string | null; end: string }) => (p.start ? `${day(p.start)} – ${day(p.end)}` : 'All time');

  type Key = keyof PageData['tiles'];
  let tiles = $derived<{ key: Key; label: string; value: string; sub?: string; fmt: (n: number) => string }[]>([
    { key: 'brews', label: 'Brews', value: count(data.tiles.brews), fmt: count },
    { key: 'grams', label: 'Grams', value: formatGrams(data.tiles.grams), fmt: formatGrams },
    { key: 'spend', label: 'Spend', value: usdCompact.format(data.tiles.spend), fmt: usdCompact.format },
    {
      key: 'avgRating', label: 'Avg rating', value: data.tiles.avgRating?.toFixed(1) ?? '—',
      sub: `${count(data.tiles.rated)} rated`, fmt: (n) => n.toFixed(1)
    },
    { key: 'bagsFinished', label: 'Bags finished', value: count(data.tiles.bagsFinished), fmt: count },
    {
      key: 'costPerBrew', label: 'Cost per brew',
      value: data.tiles.costPerBrew === null ? '—' : usd.format(data.tiles.costPerBrew), fmt: usd.format
    }
  ]);

  function deltaText(d: { abs: number; pct: number }, fmt: (n: number) => string): string {
    if (d.abs === 0) return 'No change';
    return `${d.abs > 0 ? '▲' : '▼'} ${fmt(Math.abs(d.abs))} (${Math.abs(d.pct).toFixed(0)}%)`;
  }
</script>

<svelte:head>
  <title>Bean Tracker - Insights</title>
</svelte:head>

<div class="toolbar">
  <h1>Insights</h1>
  <ShareButton />
</div>

<div class="chart-panel-controls insights-controls">
  <label class="form-field">
    <span>Period</span>
    <select value={s.range} onchange={(e) => choose({ range: e.currentTarget.value })}>
      <optgroup label="Rolling">
        {#each ROLLING as r (r)}<option value={r}>{RANGE_LABELS[r]}</option>{/each}
      </optgroup>
      <optgroup label="Calendar">
        <option value="ytd">{RANGE_LABELS.ytd}</option>
        {#each [...data.years].reverse() as y (y)}<option value={String(y)}>{y}</option>{/each}
      </optgroup>
      <optgroup label="Everything">
        <option value="all">{RANGE_LABELS.all}</option>
      </optgroup>
    </select>
  </label>
  <div class="tab-group tab-group-compact">
    <button aria-pressed={s.compare} onclick={() => choose({ compare: !s.compare })}>Compare</button>
  </div>
  <div class="tab-group tab-group-compact" role="group" aria-label="Ratings">
    <button aria-pressed={s.ratings === 'settled'} onclick={() => choose({ ratings: 'settled' })}>Settled ratings</button>
    <button aria-pressed={s.ratings === 'all'} onclick={() => choose({ ratings: 'all' })}>All ratings</button>
  </div>
</div>

<p class="insights-period">
  {span(data.period)}{#if data.previousPeriod} · vs {span(data.previousPeriod)}{/if} · Mountain Time
</p>

<section class="chart-panel">
  <h2>Overview</h2>
  <div class="stat-row">
    {#each tiles as t (t.key)}
      {@const d = data.deltas?.[t.key]}
      <div class="stat-item">
        <span class="stat-value">{t.value}</span>
        {#if d}<span class="stat-unit insights-delta">{deltaText(d, t.fmt)}</span>{/if}
        <div class="stat-caption">
          <span class="stat-label">{t.label}</span>
          {#if t.sub}<span class="stat-label">{t.sub}</span>{/if}
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .insights-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
  }
  /* .stat-unit upper-cases; "120G" misreads as a unit. */
  .insights-delta {
    text-transform: none;
  }
  .insights-period {
    color: var(--color-text-muted);
    margin: 0 0 var(--space-3);
  }
</style>
