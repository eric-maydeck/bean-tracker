<script lang="ts">
  // Grams on the shelf from today to zero, one straight line per pace, each ending on its run-out day.
  import Chart from '$lib/components/Chart.svelte';
  import { formatGrams } from '$lib/grams';
  import { seriesToken } from '$lib/components/chartColor';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import type { OnHandTab } from '$lib/server/insights/onHand';

  let { t, today, paces }: { t: OnHandTab; today: string; paces: { name: string; days: number | null }[] } = $props();

  const POINTS = 40;
  const date = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000);
  const label = (n: number) => date(n).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const lines = $derived(paces.flatMap((p) => (p.days === null ? [] : [{ name: p.name, days: p.days }])));
  const last = $derived(Math.max(0, ...lines.map((l) => l.days)));
  // Evenly spaced days, plus today and every run-out day, so each line lands exactly on zero.
  const days = $derived([...new Set([...Array.from({ length: POINTS + 1 }, (_, i) => Math.round((last * i) / POINTS)), ...lines.map((l) => l.days)])].sort((a, b) => a - b));
  const left = (l: { days: number }, d: number) => (d > l.days ? null : (t.onHandG * (l.days - d)) / l.days);
  const series = $derived(lines.map((l) => ({ label: `${l.name} · out ${label(l.days)}`, values: days.map((d) => left(l, d)) })));
  const tipOf = $derived((i: number): Tip => {
    const d = days[i];
    return {
      title: `${label(d)}${d ? ` (in ${d} day${d === 1 ? '' : 's'})` : ' (today)'}`,
      rows: lines.map((l): [string, string] => [l.name, d === l.days ? 'Runs out' : left(l, d) === null ? 'Gone' : formatGrams(left(l, d)!)]),
      marks: lines.map((_, j) => ({ color: `var(${seriesToken(j, lines.length)}-ink)`, line: true }))
    };
  });
</script>

{#if lines.length}
  <Chart type="line" labels={days.map(label)} values={series[0].values} datasetLabel={series[0].label} series={series.slice(1)} legend yMin={0}
    format={formatGrams} tickFormat={formatGrams} tipOf={tipOf} height={240} />
  <p class="chart-note">Grams on the shelf, backlog and open bags, if you brew at that pace from today</p>
{:else}
  <p class="hl-empty">No brews to pace the shelf.</p>
{/if}
