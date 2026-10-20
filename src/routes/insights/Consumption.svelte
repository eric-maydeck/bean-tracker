<script lang="ts">
  import { useTabBar } from './tabBar';
  import { labelTip } from '$lib/components/labelTip';
  import { useEmptyLine } from './coffeeNote';
  import type { Snippet } from 'svelte';
  import Chart from '$lib/components/Chart.svelte';
  import { formatGrams } from '$lib/grams';
  import { AGG_LABEL, AGGS, BYS, UNITS, type Agg, type By, type InsightsUrlState, type Unit } from '$lib/insightsUrl';
  import type { ConsumptionTab } from '$lib/server/insights/consumption';

  let {
    t, periodLabel, compareLabel, compareDates, unit, agg, offered, choose, tiles
  }: {
    t: ConsumptionTab; periodLabel: string; compareLabel: string; compareDates: string; unit: Unit; agg: Agg; offered: By[];
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
  const avg = $derived(agg === 'average');
  // A tip value carries its unit (ui-rules 36): "1.2kg", "3 bags".
  const fmt = (k: number) => (v: number) => (g ? formatGrams(v * k) : `${Number.isInteger(v) ? v : v.toFixed(avg ? 2 : 1)} bag${v === 1 ? '' : 's'}`);
  // compareBrewed lines up with brewed by index only (a clipped previous window can be shorter):
  // pad/slice it to brewed's buckets. A compare window with no data adds no series.
  const compare = $derived(t.compareBrewed ? t.brewed.map((_, i) => t.compareBrewed![i] ?? null) : null);
  const k1 = $derived(kOf(t.brewed, compare ?? [], [t.compareAverage]));
  const k2 = $derived(kOf(t.bought, t.brewed));
  const k3 = $derived(kOf(t.backlog));
  const series1 = $derived(
    compare?.some((v) => v)
      ? [{ label: compareLabel, values: div(compare, k1), faded: true, names: t.compareTitles ?? undefined }]
      : !t.compareBrewed && t.compareAverage
        ? [{ label: `${compareLabel} (avg)`, values: t.brewed.map(() => t.compareAverage! / k1), dashed: true, names: t.brewed.map(() => compareDates) }]
        : []
  );
  // Average: every bar is a per-day rate, whatever the bucket.
  const unitNote = $derived(avg ? `per day${t.by === 'day' ? '' : `, averaged by ${t.by}`}` : `per ${t.by}`);
  const brewedLabel = $derived(g ? 'Brewed' : 'Finished');
  const emptyLine = useEmptyLine();
  const registerBar = useTabBar();
  $effect(() => registerBar(bar));
</script>

{#snippet bar()}
<div class="insights-bar">
  <div class="form-field group-field">
    <span>Unit</span>
    <div class="tab-group" role="group" aria-label="Unit">
      {#each UNITS as u (u)}<button aria-pressed={unit === u} onclick={() => choose({ unit: u })}>{CAP(u)}</button>{/each}
    </div>
  </div>
  <div class="form-field group-field">
    <span>Group by</span>
    <div class="tab-group" role="group" aria-label="Group by">
      {#each BYS as b (b)}
        <button
          aria-pressed={t.by === b}
          aria-disabled={!offered.includes(b)}
          use:labelTip={offered.includes(b) ? undefined : b === 'day' ? 'Too many bars for this period' : 'Too few bars for this period'}
          onclick={() => offered.includes(b) && choose({ by: b })}>{CAP(b)}</button
        >
      {/each}
    </div>
  </div>
  <div class="form-field group-field">
    <span>Show</span>
    <div class="tab-group" role="group" aria-label="Show">
      {#each AGGS as a (a)}<button aria-pressed={agg === a} onclick={() => choose({ agg: a })}>{AGG_LABEL[a]}</button>{/each}
    </div>
  </div>
</div>
{/snippet}

{@render tiles()}

<!-- Nothing in the period: one short panel, not three tall blank charts (rule 28). -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No data in this period.')}</p></section>
{:else}
  <div class="insights-charts">
    <section class="chart-panel">
      <h2>Brewed over time</h2>
      <Chart type="bar" vertical labels={t.labels} values={div(t.brewed, k1)} datasetLabel={periodLabel} series={series1} legend integer={!g && !avg}
        format={fmt(k1)} unit={axis(k1)} height={260} />
      <p class="chart-note">{g ? 'Grams brewed' : 'Bags finished'} {unitNote}{note}</p>
    </section>
    <section class="chart-panel">
      <h2>Bought vs brewed</h2>
      <Chart type="bar" vertical labels={t.labels} values={div(t.bought, k2)} datasetLabel="Bought"
        series={[{ label: brewedLabel, values: div(t.brewed, k2) }]} legend integer={!g && !avg} format={fmt(k2)} unit={axis(k2)} height={260} />
      <p class="chart-note">{g ? 'Grams' : 'Bags'} {unitNote}{note}</p>
    </section>
  </div>
  <section class="chart-panel">
    <h2>On hand over time</h2>
    <Chart type="line" labels={t.labels} values={div(t.backlog, k3)} datasetLabel="On hand" dots={t.labels.length <= 40} monotone integer={!g} format={fmt(k3)} unit={axis(k3)} height={260} />
    <p class="chart-note">{g ? 'Grams left' : 'Bags'} on hand at the end of each {t.by}{note}</p>
  </section>
{/if}
