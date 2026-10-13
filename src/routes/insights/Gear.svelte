<script lang="ts">
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { GearTab } from '$lib/server/insights/lab';
  import { SAME_BAG_HELP } from './DeltaBars.svelte';
  import { STRENGTH_HELP } from './Insights.svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import StackedBars from './StackedBars.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';

  let { t, s, ratingsHelp, placeTip, choose }: {
    t: GearTab; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.drippers.length && !t.filters.length && !t.matrix && !t.byRoast && !t.eras);
  const BOARD_HELP = `${SAME_BAG_HELP}\n${STRENGTH_HELP.solid} ${STRENGTH_HELP.hint}\nColumns: rated brews and bags, the plain bag-weighted average rating, and SD: how widely its ratings vary (smaller is more consistent). Narrow screens drop SD, then bags.\nNo match: never brewed on the same bag as anything else.`;
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
          <LabHead id="gear-drippers" title="Ratings by dripper" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.drippers} slots={t.filters.length} noun="dripper" {placeTip} />
        </section>
      {/if}
      {#if t.filters.length}
        <section class="chart-panel" data-section="gear-filters">
          <LabHead id="gear-filters" title="Ratings by filter" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.filters} slots={t.drippers.length} noun="filter" {placeTip} />
        </section>
      {/if}
    </div>
  {/if}

  {#if t.matrix}
    <section class="chart-panel" data-section="gear-matrix">
      <LabHead id="gear-matrix" title="Filters within each dripper" {placeTip}
        help={"Rows are drippers you used with 2+ filters. A cell is that filter's same-bag delta against the dripper's other filters, counting only brews on that dripper (same bag, same dripper, different filter).\nFaded: few brews. Blank: no match, or never used together."} />
      <LabHeatmap by={t.matrix} noun="filter on this dripper" scale={['Worse than its other filters', 'Better']} ariaLabel="Filters within each dripper" />
    </section>
  {/if}

  {#if t.byRoast}
    <section class="chart-panel" data-section="gear-roast">
      <LabHead id="gear-roast" title="Dripper × roast level" help={`Each dripper's same-bag delta within one roast level (rows with 3+ bags).\n${SAME_BAG_HELP}\nFaded: few brews. Blank: no match.`} {placeTip} />
      <LabHeatmap by={t.byRoast} noun="dripper" ariaLabel="Dripper by roast level" />
    </section>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="gear-eras">
      <LabHead id="gear-eras" title="Gear usage over time" help={"Each dripper's share of the month's brews (rated or not), so you can see when you switched."} {placeTip} />
      <StackedBars m={t.eras} ariaLabel="Gear usage over time: each dripper's share of brews by month" />
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
