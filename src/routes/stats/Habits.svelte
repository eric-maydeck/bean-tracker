<script lang="ts" module>
  import type { Habits } from '#lib/server/insights/habits.ts';
  import type { JumpLink } from './JumpNav.svelte';
  export function jumpLinks(h: Habits): JumpLink[] {
    const empty = h.tiles.brewDays === 0;
    return [!empty && ['habits-hour', 'By hour of day'], !empty && ['habits-weekday', 'By day of week'], !empty && ['habits-heatmap', 'Hour × weekday'], !empty && ['habits-calendar', 'Brew calendar']];
  }
</script>

<script lang="ts">
  import { labelTip } from '#lib/components/labelTip.ts';
  import { useEmptyLine } from './coffeeNote';
  import HeadingAnchor from '#lib/components/HeadingAnchor.svelte';
  import { habitsCharts, HOUR_LABELS, WEEKEND_TOKENS } from './consumptionSeries';
  import type { Snippet } from 'svelte';
  import { sampleField } from '#lib/sample.ts';
  import Chart from '#lib/components/Chart.svelte';
  import Heatmap from '#lib/components/Heatmap.svelte';
  import BrewCalendar from '#lib/components/BrewCalendar.svelte';
  import { formatGrams } from '#lib/grams.ts';
  import { hour12 } from '#lib/hours.ts';
  import { AGG_LABEL, AGGS, MEASURES, WEEKDAYS, type Agg, type InsightsUrlState, type Measure } from '#lib/insightsUrl.ts';

  let {
    h, measure, agg, comparing, periodLabel, compareLabel, choose, tiles, part
  }: {
    part?: 'bar'; // 'bar': only the controls (rendered inside the sticky bar), else the tab
    h: Habits; measure: Measure; agg: Agg; comparing: boolean; periodLabel: string; compareLabel: string;
    choose: (c: InsightsUrlState) => void; tiles: Snippet;
  } = $props();

  const LABEL: Record<Measure, string> = { brews: 'Brews', grams: 'Grams', rating: 'Rating' };
  const HOURS = HOUR_LABELS;
  // Chart tooltips: averages to one decimal, grams with their unit.
  // Avg per day values are small fractions (0.31 brews): two decimals, with " avg" after the unit.
  const avg = $derived(agg !== 'total' && measure !== 'rating');
  const unitWord = $derived(agg === 'brewday' ? 'per brew day' : 'per day');
  const textOf = (avg: boolean) => (v: number | null) => {
    const num = (n: number) =>
      measure === 'grams' ? formatGrams(n) : measure === 'rating' || !Number.isInteger(n) ? n.toFixed(avg ? 2 : 1) : String(n);
    return v === null ? 'no data'
      : measure === 'grams' ? num(v) + (avg ? ' avg' : '')
      : `${num(v)} ${measure === 'rating' ? 'avg rating' : v === 1 && !avg ? 'brew' : 'brews'}${avg ? ' avg' : ''}`;
  };
  // The same value as a tip row (ui-rules 36): what it counts, then the number ("Brews (avg)  0.31").
  const rowOf = (avg: boolean) => (v: number | null): [string, string] => [
    measure === 'rating' ? 'Avg rating' : `${measure === 'grams' ? 'Grams' : 'Brews'}${avg ? ' (avg)' : ''}`,
    v === null ? 'No data' : textOf(avg)(v).replace(/ (avg rating|brews?|avg)( avg)?$/, '')
  ];
  const text = $derived(textOf(avg));
  const dayText = $derived(textOf(false)); // the calendar is per day in either mode
  const what = $derived(measure === 'grams' ? 'Grams' : 'Brews');
  let empty = $derived(h.tiles.brewDays === 0);
  const ch = $derived(habitsCharts(h, { measure, agg, comparing, periodLabel, compareLabel }));
  const emptyLine = useEmptyLine();
</script>

{#snippet bar()}
<div class="insights-bar">
  <div class="form-field group-field">
    <span>Measure</span>
    <div class="tab-group" role="group" aria-label="Measure">
      {#each MEASURES as m (m)}<button aria-pressed={measure === m} onclick={() => choose({ measure: m })}>{LABEL[m]}</button>{/each}
    </div>
  </div>
  <!-- On Rating, Show stays (greyed, its tip says when it applies) so the bar keeps its size (user, 2026-10-23). -->
  <div class="form-field group-field">
    <span>Show</span>
    <div class="tab-group" role="group" aria-label="Show">
      {#each AGGS as a (a)}<button aria-pressed={agg === a} aria-disabled={measure === 'rating'}
        use:labelTip={measure === 'rating' ? 'Applies when the Measure is Brews or Grams' : undefined}
        onclick={() => measure !== 'rating' && choose({ agg: a })}>{AGG_LABEL[a]}</button>{/each}
    </div>
  </div>
</div>
{/snippet}

{#if part === 'bar'}{@render bar()}{:else}
{@render tiles()}

<!-- A period with no brews is one empty panel, not four empty charts (rule 28). -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No brews in this period.')}</p></section>
{:else}
  <div class="insights-charts">
    <section class="chart-panel">
      <HeadingAnchor id="habits-hour">By hour of day</HeadingAnchor>
      <Chart type="bar" vertical labels={HOURS} titles={HOURS.map((_, i) => hour12(i))} values={ch.hour.values} samples={h.bySampleHour ?? undefined} datasetLabel={periodLabel}
        series={ch.hour.series} yMin={ch.hour.yMin} format={(v) => text(v)} integer={measure === 'brews' && !avg} unit={measure === 'grams' ? 'g' : ''} height={260} />
      <!-- Switched notes: sentence, then the suffix on its own line (blank placeholder when none), so a measure switch never moves the page. -->
      <p class="chart-note" data-switched-note>{measure === 'rating' ? 'Raw mean rating, not within a bag' : `${what} ${avg ? unitWord : 'total'}`}<br>Mountain Time{h.backfilledLeftOut ? ` · ${h.backfilledLeftOut} back-filled brews left out` : ''}</p>
    </section>
    <section class="chart-panel">
      <HeadingAnchor id="habits-weekday">By day of week</HeadingAnchor>
      <Chart type="bar" vertical labels={WEEKDAYS} values={ch.weekday.values} samples={h.bySampleWeekday ?? undefined} barTokens={WEEKEND_TOKENS} datasetLabel={periodLabel}
        series={ch.weekday.series} yMin={ch.weekday.yMin} format={(v) => text(v)} integer={measure === 'brews' && !avg} unit={measure === 'grams' ? 'g' : ''}
        height={260} />
      <p class="chart-note" data-switched-note>{measure === 'rating' ? 'Raw mean rating, not within a bag' : `${what} ${avg ? (agg === 'brewday' ? 'per brew day, by weekday' : 'per weekday, averaged') : 'total'}`}<br>{'\u00a0'}</p>
    </section>
  </div>
  <section class="chart-panel">
    <HeadingAnchor id="habits-heatmap">Hour × weekday</HeadingAnchor>
    <Heatmap rows={WEEKDAYS} cols={HOURS} cells={h.heatmap} small={h.heatSample?.map((r) => r.map((x) => x.small))} {text} label={(r, c) => `${WEEKDAYS[r]} ${hour12(c)}`} ariaLabel="Hour by weekday"
      tip={(r, c) => ({ title: `${WEEKDAYS[r]} ${hour12(c)}`, rows: [rowOf(avg)(h.heatmap[r]?.[c] ?? null)], ...(h.heatSample?.[r]?.[c] ? sampleField(h.heatSample[r][c]) : {}) })} />
  </section>
  <section class="chart-panel">
    <HeadingAnchor id="habits-calendar">Brew calendar</HeadingAnchor>
    <BrewCalendar days={h.calendar} text={dayText} row={rowOf(false)} />
  </section>
{/if}
{/if}
