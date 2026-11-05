<script lang="ts" module>
  import type { Trend } from '$lib/insightsUrl';
  import type { ConsumptionTab } from '$lib/server/insights/consumption';
  import type { JumpLink } from './JumpNav.svelte';
  const TITLE: Record<Trend, string> = { brews: 'Brews over time', water: 'Water over time', rating: 'Rating over time' };
  export function jumpLinks(t: ConsumptionTab, trend: Trend | undefined): JumpLink[] {
    const empty = t.buckets.length === 0;
    return [!empty && ['consumption-chart-brewed', trend ? TITLE[trend] : 'Brewed over time'], !empty && ['consumption-chart-bought', 'Bought vs brewed'], !empty && ['consumption-chart-on-hand', 'On hand over time'], !empty && (t.timeToOpen.toOpen.n > 0 || t.timeToOpen.daysOpen.n > 0) && ['consumption-time-to-open', 'Time to open']];
  }
</script>

<script lang="ts">
  import WholeNote from './WholeNote.svelte';
  import { labelTip } from '$lib/components/labelTip';
  import { useEmptyLine } from './coffeeNote';
  import type { Snippet } from 'svelte';
  import Chart from '$lib/components/Chart.svelte';
  import { formatGrams } from '$lib/grams';
  import { AGG_LABEL, AGGS, BYS, UNITS, type Agg, type BrewFilterKey, type By, type InsightsUrlState, type Unit } from '$lib/insightsUrl';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import TimeToOpen from './TimeToOpen.svelte';

  let {
    t, wholeKeys, periodLabel, compareLabel, compareDates, unit, trend, agg, offered, choose, tiles, part, placeTip
  }: {
    part?: 'bar'; // 'bar': only the controls (rendered inside the sticky bar), else the tab
    t: ConsumptionTab; wholeKeys: BrewFilterKey[]; periodLabel: string; compareLabel: string; compareDates: string; unit: Unit; trend?: Trend; agg: Agg; offered: By[];
    choose: (c: InsightsUrlState) => void; tiles: Snippet; placeTip: (e: ToggleEvent) => void;
  } = $props();

  const CAP = (s: string) => s[0].toUpperCase() + s.slice(1);
  const g = $derived(unit === 'grams');
  const empty = $derived(t.buckets.length === 0);
  const note = $derived(t.buckets.some((b) => b.partial) ? ` · * partial ${t.by}` : '');
  // Grams axes switch to kg from 10 kg so ticks stay short; `k` is the divisor for one chart.
  const kOf = (...vs: readonly (number | null)[][]) => (g && Math.max(0, ...vs.flat().map((v) => v ?? 0)) >= 10000 ? 1000 : 1);
  const div = (vs: readonly (number | null)[], k: number) => vs.map((v) => (v === null ? null : v / k));
  const axis = (k: number) => (g ? (k === 1 ? 'g' : 'kg') : '');
  // Per day / per brew day: bars are rates (decimals); Total: whole counts.
  const avg = $derived(agg !== 'total');
  // A tip value carries its unit (ui-rules 36): "1.2kg", "3 bags", "4 brews", "1.2 L".
  const fmt = (k: number) => (v: number) => (g ? formatGrams(v * k) : `${Number.isInteger(v) ? v : v.toFixed(avg ? 2 : 1)} bag${v === 1 ? '' : 's'}`);
  const fmtBrews = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(avg ? 2 : 1)} brew${v === 1 ? '' : 's'}`;
  const fmtWater = (v: number) => `${+v.toFixed(v >= 10 ? 0 : v >= 1 ? 1 : 2)}L`;
  const fmtRating = (v: number) => `${v.toFixed(1)} avg rating`;
  // Brewed over time: the Unit's measure (grams / bags), or the toggle's Brews / Water / Rating.
  const TRENDS: [Trend | undefined, string][] = [[undefined, ''], ['brews', 'Brews'], ['water', 'Water'], ['rating', 'Rating']];
  const measures = $derived(TRENDS.map(([v, name]) => [v ?? 'unit', v ? name : CAP(unit)] as const));
  const NOUN: Record<Trend, string> = { brews: 'Brews', water: 'Litres of water poured', rating: 'Mean rating' };
  const from = $derived(trend === 'rating' ? t.ratingFrom : 0);
  // compareBrewed lines up with brewed by index only (a clipped previous window can be shorter):
  // pad/slice it to brewed's buckets. A compare window with no data adds no series.
  const compare = $derived(t.compareBrewed ? t.brewed.map((_, i) => t.compareBrewed![i] ?? null) : null);
  const k1 = $derived(trend ? 1 : kOf(t.brewed, compare ?? [], [t.compareAverage]));
  const k2 = $derived(kOf(t.bought, t.brewed));
  const k3 = $derived(kOf(t.backlog));
  const series1 = $derived([
    ...(compare?.some((v) => v)
      ? [{ label: compareLabel, values: div(compare, k1), faded: true, names: t.compareTitles ?? undefined }]
      : !t.compareBrewed && t.compareAverage
        ? [{ label: `${compareLabel} (avg)`, values: t.brewed.map(() => t.compareAverage! / k1), dashed: true, names: t.brewed.map(() => compareDates) }]
        : []),
    ...(t.trendLine ? [{ label: t.trendLabel!, values: div(t.trendLine, k1), trend: true }] : [])
  ]);
  // The rating line: its buckets start at the calibration date under Calibrated ratings (Leaderboards' Over time does too).
  const ratingValues = $derived(t.brewed.slice(from));
  const ratingSeries = $derived(
    compare?.some((v) => v) ? [{ label: compareLabel, values: compare.slice(from), faded: true, names: t.compareTitles?.slice(from) }]
    : !t.compareBrewed && t.compareAverage ? [{ label: `${compareLabel} (avg)`, values: ratingValues.map(() => t.compareAverage!), dashed: true, names: ratingValues.map(() => compareDates) }] : []
  );
  const ratingFloor = $derived.by(() => {
    const lo = Math.min(...[ratingValues, ...ratingSeries.map((x) => x.values)].flat().filter((v): v is number => v !== null));
    return Number.isFinite(lo) ? Math.max(0, Math.floor(lo) - 1) : undefined;
  });
  const noRatings = $derived(!ratingValues.some((v) => v !== null));
  // Average: every bar is a per-day rate, whatever the bucket; Per brew day: a rate per day with a brew.
  const unitNote = $derived(agg === 'total' ? `per ${t.by}` : `${agg === 'brewday' ? 'per brew day' : 'per day'}${t.by === 'day' ? '' : `, averaged by ${t.by}`}`);
  const brewedLabel = $derived(g ? 'Brewed' : 'Finished');
  const emptyLine = useEmptyLine();
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
      {#each AGGS as a (a)}<button aria-pressed={agg === a} aria-disabled={trend === 'rating'}
        use:labelTip={trend === 'rating' ? 'Applies when the Measure is not Rating' : undefined}
        onclick={() => trend !== 'rating' && choose({ agg: a })}>{AGG_LABEL[a]}</button>{/each}
    </div>
  </div>
</div>
{/snippet}

<!-- Notes that change with a control: sentence, then the suffix on its own line (a blank one when there is none), so a switch never moves the page. -->
{#snippet nwNote(main: string, suffix: string)}<p class="chart-note" data-switched-note>{main}<br>{suffix.replace(' · ', '') || '\u00a0'}</p>{/snippet}
{#snippet whole()}{#if wholeKeys.length}<WholeNote keys={wholeKeys} />{/if}{/snippet}

{#if part === 'bar'}{@render bar()}{:else}
{@render tiles()}

<!-- Nothing in the period: one short panel, not three tall blank charts (rule 28). -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No data in this period.')}</p></section>
{:else}
  <div class="insights-charts">
    <section class="chart-panel">
      <div class="chart-panel-header">
        <!-- Every measure's title stacked in one cell (only the current one visible): the heading keeps the longest one's
             width, so switching measures never rewraps the header and moves the page. -->
        <HeadingAnchor id="consumption-chart-brewed"><span class="title-stack"><span>{trend ? TITLE[trend] : 'Brewed over time'}</span>{#each ['Brewed over time', ...Object.values(TITLE)] as other}<span class="title-sizer" aria-hidden="true">{other}</span>{/each}</span></HeadingAnchor>
        <ChartToggle label="Measure" options={measures} value={trend ?? 'unit'} pick={(v) => choose({ trend: v === 'unit' ? undefined : (v as Trend) })} />
      </div>
      {#if trend === 'rating'}
        {#if noRatings}
          <p class="hl-empty">{emptyLine('No rated brews in this period.')}</p>
        {:else}
          <Chart type="line" labels={t.labels.slice(from)} values={ratingValues} datasetLabel={periodLabel} series={ratingSeries} legend
            dashGaps yMin={ratingFloor} format={fmtRating} height={260} />
        {/if}
        {@render nwNote(`Mean rating per ${t.by}${from ? ` from ${t.labels[from]}` : ''}`, `${note}${ratingValues.some((v) => v === null) ? ' · Dashed: no rated brews' : ''}`)}
      {:else}
        <Chart type="bar" vertical labels={t.labels} values={div(t.brewed, k1)} datasetLabel={periodLabel} series={series1} legend integer={(!g || !!trend) && !avg && trend !== 'water'}
          format={trend === 'brews' ? fmtBrews : trend === 'water' ? fmtWater : fmt(k1)} unit={trend === 'water' ? 'L' : trend ? '' : axis(k1)} height={260} />
        {@render nwNote(`${trend ? NOUN[trend] : g ? 'Grams brewed' : 'Bags finished'} ${unitNote}`, note)}
        {#if !g && !trend}{@render whole()}{/if}
      {/if}
    </section>
    <section class="chart-panel">
      <h2 id="consumption-chart-bought">Bought vs brewed</h2>
      <Chart type="bar" vertical labels={t.labels} values={div(t.bought, k2)} datasetLabel="Bought"
        series={[{ label: brewedLabel, values: div(t.brewed, k2) }]} legend integer={!g && !avg} format={fmt(k2)} unit={axis(k2)} height={260} />
      {@render nwNote(`${g ? 'Grams' : 'Bags'} ${unitNote}`, note)}
      {@render whole()}
    </section>
  </div>
  <section class="chart-panel">
    <h2 id="consumption-chart-on-hand">On hand over time</h2>
    <Chart type="line" labels={t.labels} values={div(t.backlog, k3)} datasetLabel="On hand" integer={!g} format={fmt(k3)} unit={axis(k3)} height={260} />
    {@render nwNote(`${g ? 'Grams left' : 'Bags'} on hand at the end of each ${t.by}`, note)}
    {@render whole()}
  </section>
  {#if t.timeToOpen.toOpen.n > 0 || t.timeToOpen.daysOpen.n > 0}
    {#snippet wholeFoot()}{@render whole()}{/snippet}
    <TimeToOpen t={t.timeToOpen} {placeTip} foot={wholeFoot} />
  {/if}
{/if}
{/if}

<style>
  .chart-panel-header :global(h2) {
    margin: 0;
  }
  .title-stack {
    display: inline-grid;
  }
  .title-stack > span {
    grid-area: 1 / 1;
  }
  .title-sizer {
    visibility: hidden;
  }
</style>
