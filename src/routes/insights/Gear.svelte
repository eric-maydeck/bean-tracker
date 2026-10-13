<script lang="ts">
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { GearTab } from '$lib/server/insights/lab';
  import { SAME_BAG_HELP, STRENGTH_LINE } from './DeltaBars.svelte';
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
  // The matrix fills the shorter board's column when both boards are there (ui-rules 40).
  let stack = $derived(!!t.matrix && t.drippers.length > 0 && t.filters.length > 0);
  const BOARD_HELP = [...SAME_BAG_HELP, STRENGTH_LINE, 'Columns: rated brews, bags, average rating, SD.', 'Narrow screens drop SD, then bags.',
    'No match: never brewed on the same bag as anything else.'];
</script>

{#snippet matrix()}
  <section class="chart-panel" data-section="gear-matrix">
    <LabHead id="gear-matrix" title="Filters within each dripper" {placeTip}
      help={['Rows: drippers you used with 2+ filters.', "A cell: that filter's same-bag delta vs the dripper's other filters.", 'Counts only brews on that dripper.',
        'Striped: few brews · blank: no match, or never used together.']} />
    <LabHeatmap by={t.matrix!} noun="filter on this dripper" scale={['Worse than its other filters', 'Better']} ariaLabel="Filters within each dripper" />
  </section>
{/snippet}

<div class="insights-bar">
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews with gear recorded in this period.</p></section>
{:else}
  {#if t.drippers.length || t.filters.length}
    <!-- Side by side from 768 px. With both boards and the matrix, the matrix stacks under the board with fewer
         rows, beside the longer one (ui-rules 40): real content fills that column, the shorter board's rows
         stretch for any rest. Without the matrix the shorter list shows placeholder slots (rule 31). -->
    <div class="gear-pair" class:stack class:under-drippers={stack && t.drippers.length < t.filters.length} style:--row-h="3rem">
      {#if t.drippers.length}
        <section class="chart-panel" data-section="gear-drippers">
          <LabHead id="gear-drippers" title="Ratings by dripper" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.drippers} slots={stack ? 0 : t.filters.length} noun="dripper" {placeTip} />
        </section>
      {/if}
      {#if t.filters.length}
        <section class="chart-panel" data-section="gear-filters">
          <LabHead id="gear-filters" title="Ratings by filter" help={BOARD_HELP} {placeTip} />
          <LabBoard rows={t.filters} slots={stack ? 0 : t.drippers.length} noun="filter" {placeTip} />
        </section>
      {/if}
      {#if stack}{@render matrix()}{/if}
    </div>
  {/if}

  {#if t.matrix && !stack}{@render matrix()}{/if}

  {#if t.byRoast}
    <section class="chart-panel" data-section="gear-roast">
      <LabHead id="gear-roast" title="Dripper × roast level" help={["Each dripper's same-bag delta within one roast level (rows with 3+ bags).", ...SAME_BAG_HELP, 'Blank: no match.']} {placeTip} />
      <LabHeatmap by={t.byRoast} noun="dripper" ariaLabel="Dripper by roast level" />
    </section>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="gear-eras">
      <LabHead id="gear-eras" title="Gear usage over time" help={["Each dripper's share of the month's brews, rated or not.", 'Shows when you switched.']} {placeTip} />
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
  /* A card is a column: its board takes the spare height and its rows stretch (LabBoard: minmax(--row-h, 1fr)). */
  .gear-pair > .chart-panel {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .gear-pair :global(.lab-board) {
    flex: 1 0 auto;
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
    /* The matrix under the board with fewer rows; the longer board spans both rows. The first row is the
       flexible one, so any height left over goes to the shorter board's rows, never under the matrix. */
    .gear-pair.stack {
      grid-template-areas: 'drippers filters' 'drippers matrix';
      grid-template-rows: 1fr auto;
    }
    .gear-pair.stack.under-drippers {
      grid-template-areas: 'drippers filters' 'matrix filters';
    }
    .stack > [data-section='gear-drippers'] {
      grid-area: drippers;
    }
    .stack > [data-section='gear-filters'] {
      grid-area: filters;
    }
    .stack > [data-section='gear-matrix'] {
      grid-area: matrix;
    }
  }
</style>
