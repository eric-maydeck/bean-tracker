<script lang="ts">
  import type { Snippet } from 'svelte';
  import Chart from '$lib/components/Chart.svelte';
  import { formatGrams } from '$lib/grams';
  import { BYS, UNITS, type By, type InsightsUrlState, type Unit } from '$lib/insightsUrl';
  import type { ConsumptionTab } from '$lib/server/insights/consumption';

  let {
    t, periodLabel, compareLabel, unit, offered, choose, tiles
  }: {
    t: ConsumptionTab; periodLabel: string; compareLabel: string; unit: Unit; offered: By[];
    choose: (c: InsightsUrlState) => void; tiles: Snippet;
  } = $props();

  const CAP = (s: string) => s[0].toUpperCase() + s.slice(1);
  const g = $derived(unit === 'grams');
  const empty = $derived(t.buckets.length === 0);
  const note = $derived(t.buckets.some((b) => b.partial) ? ` · * partial ${t.by}` : '');
  // Grams axes switch to kg from 10 kg so ticks stay short; `k` is the divisor for one chart.
  const kOf = (...vs: (number | null)[][]) => (g && Math.max(0, ...vs.flat().map((v) => v ?? 0)) >= 10000 ? 1000 : 1);
  const div = (vs: (number | null)[], k: number) => vs.map((v) => (v === null ? null : v / k));
  const axis = (k: number) => (g ? (k === 1 ? 'g' : 'kg') : '');
  const fmt = (k: number) => (v: number) => (g ? formatGrams(v * k) : Number.isInteger(v) ? String(v) : v.toFixed(1));
  // compareBrewed lines up with brewed by index only (a clipped previous window can be shorter):
  // pad/slice it to brewed's buckets. A compare window with no data adds no series.
  const compare = $derived(t.compareBrewed ? t.brewed.map((_, i) => t.compareBrewed![i] ?? null) : null);
  const k1 = $derived(kOf(t.brewed, compare ?? [], [t.compareAverage]));
  const k2 = $derived(kOf(t.bought, t.brewed));
  const k3 = $derived(kOf(t.backlog));
  const series1 = $derived(
    compare?.some((v) => v)
      ? [{ label: compareLabel, values: div(compare, k1), faded: true }]
      : !t.compareBrewed && t.compareAverage
        ? [{ label: `${compareLabel} (avg)`, values: t.brewed.map(() => t.compareAverage! / k1), dashed: true }]
        : []
  );
  const brewedLabel = $derived(g ? 'Brewed' : 'Finished');
</script>

<div class="consumption-bar">
  <div class="tab-group" role="group" aria-label="Unit">
    {#each UNITS as u (u)}<button aria-pressed={unit === u} onclick={() => choose({ unit: u })}>{CAP(u)}</button>{/each}
  </div>
  <div class="tab-group" role="group" aria-label="By">
    {#each BYS as b (b)}
      <button
        aria-pressed={t.by === b}
        disabled={!offered.includes(b)}
        title={offered.includes(b) ? undefined : b === 'day' ? 'Too many bars for this period' : 'Too few bars for this period'}
        onclick={() => choose({ by: b })}>{CAP(b)}</button
      >
    {/each}
  </div>
</div>

{@render tiles()}

<div class="consumption-charts">
  <section class="chart-panel">
    <h2>Brewed over time</h2>
    {#if empty}
      <p class="empty">No data in this period</p>
    {:else}
      <Chart type="bar" vertical labels={t.labels} values={div(t.brewed, k1)} datasetLabel={periodLabel} series={series1} legend integer={!g}
        format={fmt(k1)} unit={axis(k1)} height={260} />
      <p class="chart-note">{g ? 'Grams brewed' : 'Bags finished'} per {t.by}{note}</p>
    {/if}
  </section>
  <section class="chart-panel">
    <h2>Bought vs brewed</h2>
    {#if empty}
      <p class="empty">No data in this period</p>
    {:else}
      <Chart type="bar" vertical labels={t.labels} values={div(t.bought, k2)} datasetLabel="Bought"
        series={[{ label: brewedLabel, values: div(t.brewed, k2) }]} legend integer={!g} format={fmt(k2)} unit={axis(k2)} height={260} />
      <p class="chart-note">{g ? 'Grams' : 'Bags'} per {t.by}{note}</p>
    {/if}
  </section>
</div>
<section class="chart-panel">
  <h2>On hand over time</h2>
  {#if empty}
    <p class="empty">No data in this period</p>
  {:else}
    <Chart type="line" labels={t.labels} values={div(t.backlog, k3)} datasetLabel="On hand" dots={t.labels.length <= 40} monotone integer={!g} format={fmt(k3)} unit={axis(k3)} height={260} />
    <p class="chart-note">{g ? 'Grams left' : 'Bags'} on hand at the end of each {t.by}{note}</p>
  {/if}
</section>

<style>
  .consumption-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .consumption-charts {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: minmax(0, 1fr);
    margin-bottom: var(--space-5);
  }
  @media (min-width: 900px) {
    .consumption-charts {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .consumption-charts .chart-panel {
    margin: 0;
  }
  .empty {
    height: 260px;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--color-text-muted);
  }
  .chart-note {
    margin: var(--space-2) 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
</style>
