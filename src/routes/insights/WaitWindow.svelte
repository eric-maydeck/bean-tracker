<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { SAMPLE_HELP } from '$lib/sample';
  import { useEmptyLine } from './coffeeNote';
  import LabHead from './LabHead.svelte';
  import type { WaitWindow } from '$lib/server/insights/freshness';

  let { w, placeTip }: { w: WaitWindow; placeTip: (e: ToggleEvent) => void } = $props();
  const emptyLine = useEmptyLine();

  const bags = (n: number) => `${n} bag${n === 1 ? '' : 's'}`;
  const rated = $derived(w.byWait.filter((x) => x.rating !== null));
  // Rating axis floor, as Habits' and Consumption's rating charts: a point under the lowest bar.
  const floor = $derived(rated.length ? Math.max(0, Math.floor(Math.min(...rated.map((x) => x.rating!))) - 1) : undefined);
  const windowBrews = $derived(w.window.reduce((s, x) => s + x.brews, 0));
</script>

<section class="chart-panel" data-section="brewing-rating-by-wait">
  <LabHead id="brewing-rating-by-wait" title="Rating by wait" {placeTip}
    help={['Adjusted rating of this period\'s brews, by the days a bag had rested at its first brew.', 'Freezer days are not counted.', 'It compares bags, not brews of one bag.', '', SAMPLE_HELP]} />
  {#if rated.length}
    <Chart type="bar" vertical labels={w.byWait.map((x) => x.label)} values={w.byWait.map((x) => x.rating)} datasetLabel="Rating" samples={w.byWait.map((x) => x.sample)}
      yMin={floor} format={(v) => v.toFixed(1)} tipFormat={(v, i) => `${v.toFixed(1)} · ${bags(w.byWait[i].bags)}`} height={220} />
    <p class="chart-note">Days off roast at the bag's first brew</p>
  {:else}
    <p class="hl-empty">{emptyLine('No rated brews with a roast date in this period.')}</p>
  {/if}
</section>

<section class="chart-panel" data-section="brewing-rest-window">
  <LabHead id="brewing-rest-window" title="Rest window" {placeTip}
    help={['The share of this period\'s brews made before, inside and after the roaster\'s rest window.', 'Each with its adjusted rating.', 'Brews of bags with no window are left out.', '', SAMPLE_HELP]} />
  {#if windowBrews === 0}
    <p class="hl-empty">{emptyLine('No brews with a rest window in this period.')}</p>
  {:else}
    <ul class="win">
      {#each w.window as x (x.label)}
        <li>
          <span class="k">{x.label}</span>
          <span class="track" role="img" aria-label="{Math.round(100 * x.share)}% of brews"><span class="bar" class:small-sample-mark={x.sample.small} style:width="{100 * x.share}%"></span></span>
          <span class="pct">{Math.round(100 * x.share)}%</span>
          <span class="rate" class:small-sample={x.sample.small}>{x.rating === null ? '—' : x.rating.toFixed(1)}</span>
          {#if x.sample.small}<SampleNote s={x.sample} />{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="chart-note">{w.noWindow} brew{w.noWindow === 1 ? '' : 's'} without a rest window</p>
</section>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .win li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
    font-variant-numeric: tabular-nums;
  }
  .win li:first-child {
    border-top: 0;
  }
  .k {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .win .k {
    flex: none;
    width: 4rem;
  }
  .track {
    flex: 1;
    min-width: 3rem;
    height: 0.75rem;
    background: var(--color-surface-2, var(--color-border));
    border-radius: 4px;
    overflow: hidden;
  }
  .bar {
    display: block;
    height: 100%;
    background-color: var(--chart-color-1);
    border-radius: 0 4px 4px 0;
    position: relative;
  }
  .pct {
    min-width: 2.75rem;
    text-align: right;
  }
  .rate {
    min-width: 2rem;
    text-align: right;
  }
</style>
