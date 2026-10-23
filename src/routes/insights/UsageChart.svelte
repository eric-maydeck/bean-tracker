<script lang="ts" module>
  import type { EraView } from '$lib/insightsUrl';
  export const ERA_VIEW_OPTIONS = [['bars', 'Bars'], ['lines', 'Lines']] as const satisfies readonly (readonly [EraView, string])[];
</script>

<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import type { Eras } from '$lib/server/insights/lab';
  import StackedBars from './StackedBars.svelte';
  import { seriesColors } from './multiLine';

  // Gear / Water usage over time (one monthly share per line): 100% stacked bars, or one line per item (Lines).
  let { m, view, colors, ariaLabel }: { m: Eras; view: EraView; colors?: string[]; ariaLabel: string } = $props();
  // Lines: the page's per-name colors (Water's recipes), else ui-rules 42 for strokes (2+ lines take the slots, Other gray).
  let lineColors = $derived(colors ?? seriesColors(m.lines.map((l) => l.label), true));
</script>

{#if view === 'lines'}
  <Chart type="line" labels={m.x} values={m.lines[0].values} datasetLabel={m.lines[0].label} series={m.lines.slice(1)} legend
    dots={m.x.length <= 40} yMin={0} colors={lineColors} unit="%" format={(v) => `${v}%`} height={250} />
{:else}
  <StackedBars {m} {colors} {ariaLabel} />
{/if}
