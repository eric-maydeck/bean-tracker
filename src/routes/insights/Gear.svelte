<script lang="ts">
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState, InsightsView } from '$lib/insightsUrl';
  import type { GearTab } from '$lib/server/insights/lab';
  import { SAMPLE_HELP } from '$lib/sample';
  import { SAME_BAG_HELP, STRENGTH_LINE } from './DeltaBars.svelte';
  import TrophyCase from './TrophyCase.svelte';
  import type { Trophy } from '$lib/server/insights/trophies';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import StackedBars from './StackedBars.svelte';
  import { fitPairs } from './fitPairs';

  let { t, trophies, s, placeTip, choose }: {
    t: GearTab; trophies: Trophy[] | null; s: InsightsView;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.drippers.length && !t.filters.length && !t.matrix && !t.byRoast && !t.eras);
  // The matrix fills the shorter board's column when both boards are there (ui-rules 40).
  let stack = $derived(!!t.matrix && t.drippers.length > 0 && t.filters.length > 0);
  let underDrippers = $derived(t.drippers.length < t.filters.length);
  const BOARD_HELP = [...SAME_BAG_HELP, STRENGTH_LINE, 'Columns: rated brews, bags, average rating, SD (narrow screens drop SD, then bags).',
    'No match: never brewed on the same bag as anything else.'];
  const emptyLine = useEmptyLine();
</script>

{#snippet matrix()}
  <section class="chart-panel" data-section="gear-matrix">
    <LabHead id="gear-matrix" title="Filters within each dripper" {placeTip}
      help={['Rows: drippers you used with 2+ filters.', "A cell: that filter's same-bag delta vs the dripper's other filters.", 'Counts only brews on that dripper.',
        SAMPLE_HELP, 'Blank: no match, or never used together.']} />
    <div class="fit-body"><LabHeatmap by={t.matrix!} noun="filter on this dripper" scale={['Worse than its other filters', 'Better']} ariaLabel="Filters within each dripper" /></div>
  </section>
{/snippet}

{#snippet board(key: 'drippers' | 'filters')}
  {@const [rows, other, title, noun] = key === 'drippers' ? [t.drippers, t.filters, 'Ratings by dripper', 'dripper'] : [t.filters, t.drippers, 'Ratings by filter', 'filter']}
  <section class="chart-panel" data-section="gear-{key}">
    <LabHead id="gear-{key}" {title} help={BOARD_HELP} {placeTip} />
    <div class="fit-body"><LabBoard {rows} slots={stack ? 0 : other.length} {noun} {placeTip} /></div>
  </section>
{/snippet}

<!-- Jump links past the big showcase: one chip per section on the tab (the page's scroll-padding clears the sticky bar). -->
{#snippet jump()}
  {@const links = [
    trophies ? ['gear-trophies', 'Gear showcase'] : null,
    t.drippers.length ? ['gear-drippers', 'Dripper ratings'] : null,
    t.filters.length ? ['gear-filters', 'Filter ratings'] : null,
    t.matrix ? ['gear-matrix', 'Filters per dripper'] : null,
    t.byRoast ? ['gear-roast', 'Dripper × roast'] : null,
    t.eras ? ['gear-eras', 'Usage over time'] : null
  ].filter((l) => l !== null)}
  {#if links.length > 1}
    <nav class="board-jump" aria-label="Jump to a section">
      <span>Jump to</span>
      {#each links as [id, label] (id)}<a href="#{id}">{label}</a>{/each}
    </nav>
  {/if}
{/snippet}
{@render jump()}

{#if trophies}<TrophyCase list={trophies} {s} {choose} {placeTip} />{/if}

{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No rated brews with gear recorded in this period.')}</p></section>
{:else}
  {#if t.drippers.length || t.filters.length}
    <!-- Side by side from 768 px, one height (fitPairs, ui-rules 37/40). With both boards and the matrix, the matrix
         stacks under the board with fewer rows: real content fills that column; any height left stretches the shorter
         column's rows, and a column past the 2× cap scrolls inside. Without the matrix the shorter list shows
         placeholder slots (rule 31). -->
    <div class="gear-pair" class:stack use:fitPairs={[t, stack]} style:--row-h="3rem">
      {#if stack}
        <div class="fit-col">{@render board('drippers')}{#if underDrippers}{@render matrix()}{/if}</div>
        <div class="fit-col">{@render board('filters')}{#if !underDrippers}{@render matrix()}{/if}</div>
      {:else}
        {#if t.drippers.length}{@render board('drippers')}{/if}
        {#if t.filters.length}{@render board('filters')}{/if}
      {/if}
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
  /* A card is a column: its .fit-body takes the spare height and the board's rows stretch (LabBoard: minmax(--row-h, 1fr)). */
  .gear-pair :global(.chart-panel) {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  /* Stacked (phones), each list is its own height; the matrix follows both boards. */
  @media (max-width: 767px) {
    .gear-pair :global(.placeholder) {
      display: none;
    }
    .gear-pair :global(.fit-col) {
      display: contents;
    }
    .gear-pair :global([data-section='gear-matrix']) {
      order: 1;
    }
  }
  @media (min-width: 768px) {
    .gear-pair {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
