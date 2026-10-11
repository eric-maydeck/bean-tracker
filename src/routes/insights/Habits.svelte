<script lang="ts">
  import type { Snippet } from 'svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';
  import BrewCalendar from '$lib/components/BrewCalendar.svelte';
  import { formatGrams } from '$lib/grams';
  import { MEASURES, type InsightsUrlState, type Measure, type Ratings } from '$lib/insightsUrl';
  import type { Habits } from '$lib/server/insights/habits';

  let {
    h, measure, ratings, comparing, ratingsHelp, choose, tiles
  }: {
    h: Habits; measure: Measure; ratings: Ratings; comparing: boolean;
    ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void; tiles: Snippet;
  } = $props();

  const LABEL: Record<Measure, string> = { brews: 'Brews', grams: 'Grams', rating: 'Rating' };
  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Chart tooltips: averages to one decimal, grams with their unit.
  const num = (v: number) =>
    measure === 'grams' ? formatGrams(v) : measure === 'rating' || !Number.isInteger(v) ? v.toFixed(1) : String(v);
  const text = (v: number | null) =>
    v === null ? 'no data' : measure === 'grams' ? num(v) : `${num(v)} ${measure === 'rating' ? 'avg rating' : v === 1 ? 'brew' : 'brews'}`;
  let empty = $derived(h.tiles.brewDays === 0);
  // A compare window with no data adds no series (and no legend entry).
  const compare = (values: (number | null)[] | null) =>
    comparing && values?.some((v) => v) ? [{ label: 'Compare', values, faded: true }] : [];
  // Ratings sit high on a 1–10 scale: fit the axis floor a point below the lowest bar.
  const yMin = (...vs: ((number | null)[] | null)[]) => {
    if (measure !== 'rating') return undefined;
    const lo = Math.min(...vs.flatMap((v) => v ?? []).filter((v): v is number => v !== null));
    return Number.isFinite(lo) ? Math.max(0, Math.floor(lo) - 1) : undefined;
  };
</script>

<div class="habits-bar">
  <div class="tab-group" role="group" aria-label="Measure">
    {#each MEASURES as m (m)}<button aria-pressed={measure === m} onclick={() => choose({ measure: m })}>{LABEL[m]}</button>{/each}
  </div>
  {#if measure === 'rating'}
    <div class="tab-group" role="group" aria-label="Ratings">
      {#each ['current', 'all'] as const as m (m)}
        <button
          aria-pressed={ratings === m}
          title={ratingsHelp[m]}
          aria-describedby="ratings-help-{m}"
          onclick={() => choose({ ratings: m })}>{m === 'all' ? 'All' : 'Current'}</button
        >
      {/each}
    </div>
  {/if}
</div>

{@render tiles()}

<div class="habits-charts">
  <section class="chart-panel">
    <h2>By hour of day</h2>
    {#if empty}
      <p class="empty">No brews in this period</p>
    {:else}
      <Chart type="bar" vertical labels={HOURS.map((x) => `${x}:00`)} values={h.byHour} datasetLabel={LABEL[measure]}
        series={compare(h.compareHour)} yMin={yMin(h.byHour, h.compareHour)} format={num} unit={measure === 'grams' ? 'g' : ''} height={260} />
    {/if}
    <p class="chart-note">Mountain Time{h.backfilledLeftOut ? ` · ${h.backfilledLeftOut} back-filled brews left out` : ''}</p>
  </section>
  <section class="chart-panel">
    <h2>By day of week</h2>
    {#if empty}
      <p class="empty">No brews in this period</p>
    {:else}
      <Chart type="bar" vertical labels={WEEKDAYS} values={h.byWeekday} datasetLabel={LABEL[measure]}
        series={compare(h.compareWeekday)} yMin={yMin(h.byWeekday, h.compareWeekday)} format={num} unit={measure === 'grams' ? 'g' : ''}
        height={260} />
    {/if}
    <p class="chart-note">{measure === 'rating' ? 'Mean rating' : 'Average per weekday'}</p>
  </section>
</div>
<section class="chart-panel">
  <h2>Hour × weekday</h2>
  {#if empty}
    <p class="empty">No brews in this period</p>
  {:else}
    <Heatmap rows={WEEKDAYS} cols={HOURS} cells={h.heatmap} {text} label={(r, c) => `${WEEKDAYS[r]} ${HOURS[c]}:00`} ariaLabel="Hour by weekday" />
  {/if}
</section>
<section class="chart-panel">
  <h2>Brew calendar</h2>
  {#if empty}
    <p class="empty">No brews in this period</p>
  {:else}
    <BrewCalendar days={h.calendar} {text} />
  {/if}
</section>

<style>
  .habits-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .habits-charts {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: minmax(0, 1fr);
    margin-bottom: var(--space-5);
  }
  @media (min-width: 900px) {
    .habits-charts {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .habits-charts .chart-panel {
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
