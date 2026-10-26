<script lang="ts" module>
  import type { SpendTab } from '$lib/server/insights/spend';
  import type { JumpLink } from './JumpNav.svelte';
  // Each panel task adds its section here.
  export function jumpLinks(t: SpendTab): JumpLink[] {
    return [t.tiles.bags > 0 && ['spend-chart', 'Spend over time']];
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState } from '$lib/insightsUrl';
  import Chart from '$lib/components/Chart.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import { usd, usdPrecise, wholeUsd } from '$lib/money';

  let { t, choose, tiles, spendView, compareLabel, compareDates, link }: {
    t: SpendTab; choose: (c: InsightsUrlState) => void; tiles: Snippet; spendView?: 'ppg';
    compareLabel: string; compareDates: string; link: (href: string) => string;
  } = $props();

  const empty = $derived(t.tiles.bags === 0);
  const emptyLine = useEmptyLine();

  const sr = $derived(t.series);
  const ppg = $derived(spendView === 'ppg');
  // Spend: One-off at the bottom of each stack, Subscription on top, the compare window's total beside it.
  const amounts = $derived([...sr.sub.map((v, i) => v + sr.oneOff[i]), ...(sr.compare ?? []), sr.compareAverage]);
  const whole = $derived(wholeUsd(amounts));
  const money = (v: number) => usd(v, whole);
  const spendCompare = $derived(
    sr.compare?.some((v) => v) ? [{ label: compareLabel, values: sr.compare, faded: true, names: sr.compareTitles ?? undefined }]
    : sr.compareAverage ? [{ label: `${compareLabel} (avg)`, values: sr.labels.map(() => sr.compareAverage), dashed: true, names: sr.labels.map(() => compareDates) }] : []
  );
  const ppgCompare = $derived(sr.comparePpg?.some((v) => v !== null) ? [{ label: compareLabel, values: sr.comparePpg, dashed: true, names: sr.compareTitles ?? undefined }] : []);
  const perG = (v: number) => `${usd(v)}/g`;
  const perGTip = (v: number) => `${usdPrecise(v) ?? usd(v)}/g`;
  const noPrice = $derived(sr.ppg.all.every((v) => v === null));
  // Two lines, the second blank when there is no suffix, so switching the view never moves the page.
  const note = $derived(`${ppg ? `$ per g in each ${sr.by}` : `$ per ${sr.by}`} · counted by roast date`);
  const partial = $derived(sr.partial ? `* partial ${sr.by}` : '\u00a0');
</script>

{@render tiles()}

<!-- Nothing bought in the period: one short line, not blank panels (rule 28). Later panels sit in the else branch. -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No bags bought in this period.')}</p></section>
{:else}
  <section class="chart-panel">
    <div class="chart-panel-header">
      <HeadingAnchor id="spend-chart">Spend over time</HeadingAnchor>
      <ChartToggle label="Show" options={[['spend', 'Spend'], ['ppg', '$ per g']]} value={ppg ? 'ppg' : 'spend'} pick={(v) => choose({ spendView: v === 'ppg' ? 'ppg' : undefined })} />
    </div>
    {#if ppg && noPrice}
      <p class="hl-empty">{emptyLine('No priced bags in this period.')}</p>
    {:else if ppg}
      <Chart type="line" labels={sr.labels} values={sr.ppg.all} datasetLabel="All" legend dashGaps format={perG} tipFormat={perGTip} titles={sr.titles}
        series={[{ label: 'Subscription', values: sr.ppg.sub }, { label: 'One-off', values: sr.ppg.oneOff }, ...ppgCompare]} height={260} />
    {:else}
      <Chart type="bar" vertical stacked labels={sr.labels} values={sr.oneOff} datasetLabel="One-off" legend format={money} tipFormat={(v) => usd(v, false)} titles={sr.titles}
        series={[{ label: 'Subscription', values: sr.sub }, ...spendCompare]} height={260} />
    {/if}
    <p class="chart-note" data-switched-note>{note}<br>{partial}</p>
    <p class="chart-note">By roaster or coffee: <a href={link('/insights?tab=leaderboards&rank=spend&chart=leaderboard-roasters#leaderboard-roasters')}>Leaderboards</a></p>
  </section>
{/if}
