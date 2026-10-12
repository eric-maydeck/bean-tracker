<script lang="ts">
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { GearTab } from '$lib/server/insights/lab';
  import { SAME_BAG_HELP } from './DeltaBars.svelte';
  import { STRENGTH_HELP } from './Insights.svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import MultiLine from './MultiLine.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';

  let { t, s, ratingsHelp, placeTip, choose }: {
    t: GearTab; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.drippers.length && !t.filters.length && !t.matrix && !t.byRoast && !t.eras);
  const BOARD_HELP = `${SAME_BAG_HELP} ${STRENGTH_HELP.solid} ${STRENGTH_HELP.hint} Under the name: rated brews and bags, the plain bag-weighted average, and ±: how much ratings swing within the same bag (the spread of the same-bag deltas; smaller is more consistent). Unpaired: no bag was brewed with it and something else.`;
</script>

<div class="insights-bar">
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews with gear recorded in this period.</p></section>
{:else}
  {#if t.drippers.length || t.filters.length}
    <!-- Side by side from 768 px, one height: the shorter list shows placeholder slots (hidden when stacked). -->
    <div class="gear-pair" style:--row-h="3rem">
      {#if t.drippers.length}
        <section class="chart-panel" data-section="gear-drippers">
          <LabHead id="gear-drippers" title="Drippers" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.drippers} spread slots={t.filters.length} />
        </section>
      {/if}
      {#if t.filters.length}
        <section class="chart-panel" data-section="gear-filters">
          <LabHead id="gear-filters" title="Filters" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.filters} spread slots={t.drippers.length} />
        </section>
      {/if}
    </div>
  {/if}

  {#if t.matrix}
    <section class="chart-panel" data-section="gear-matrix">
      <LabHead id="gear-matrix" title="Dripper × filter" help={`Each dripper and filter pairing as one band: its same-bag delta. ${SAME_BAG_HELP} Faded cells have few brews, blank cells no paired brews (or none at all).`} {placeTip} />
      <LabHeatmap by={t.matrix} ariaLabel="Dripper by filter" />
    </section>
  {/if}

  {#if t.byRoast}
    <section class="chart-panel" data-section="gear-roast">
      <LabHead id="gear-roast" title="Dripper × roast level" help={`Each dripper's same-bag delta within one roast level (rows with 3+ bags). ${SAME_BAG_HELP} Faded cells have few brews, blank cells no paired brews.`} {placeTip} />
      <LabHeatmap by={t.byRoast} ariaLabel="Dripper by roast level" />
    </section>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="gear-eras">
      <LabHead id="gear-eras" title="Gear eras" help={"Each dripper's share of the month's brews (rated or not), so you can see when you switched."} {placeTip} />
      <MultiLine m={t.eras} ariaLabel="Gear eras: each dripper's share of brews by month" format={(n) => `${n}%`} thin />
    </section>
  {/if}
{/if}

<style>
  .gear-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .gear-pair > .chart-panel {
    margin: 0;
  }
  /* Stacked, each list is its own height. */
  @media (max-width: 767px) {
    .gear-pair :global(.placeholder) {
      display: none;
    }
  }
  @media (min-width: 768px) {
    .gear-pair {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
