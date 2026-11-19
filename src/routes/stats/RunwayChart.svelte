<script lang="ts">
  // Grams on the shelf from today to zero, one straight line per pace, each ending on its run-out day.
  import Chart from '#lib/components/Chart.svelte';
  import { formatGrams } from '#lib/grams.ts';
  import { runwaySeries, dayLabel } from './onHandSeries';
  import { seriesToken } from '#lib/components/chartColor.ts';
  import type { Tip } from '#lib/components/TipBody.svelte';
  import type { OnHandTab } from '#lib/server/insights/onHand.ts';

  let { t, today, paces }: { t: OnHandTab; today: string; paces: { name: string; days: number | null }[] } = $props();

  const r = $derived(runwaySeries(t.onHandG, today, paces));
  const tipOf = $derived((i: number): Tip => {
    const { days, lines, left } = r!;
    const d = days[i];
    return {
      title: `${dayLabel(today, d)}${d ? ` (in ${d} day${d === 1 ? '' : 's'})` : ' (today)'}`,
      rows: lines.map((l): [string, string] => [l.name, d === l.days ? 'Runs out' : left(l, d) === null ? 'Gone' : formatGrams(left(l, d)!)]),
      marks: lines.map((_, j) => ({ color: `var(${seriesToken(j, lines.length)}-ink)`, line: true }))
    };
  });
</script>

{#if r}
  <Chart type="line" labels={r.labels} values={r.series[0].values} datasetLabel={r.series[0].label} series={r.series.slice(1)} legend yMin={0}
    format={formatGrams} tickFormat={formatGrams} tipOf={tipOf} height={240} />
  <p class="chart-note">Grams on the shelf, backlog and open bags, if you brew at that pace from today</p>
{:else}
  <p class="hl-empty">No brews to pace the shelf.</p>
{/if}
