<script lang="ts" module>
  import type { GearTab } from '#lib/server/insights/lab.ts';
  import type { JumpLink } from './JumpNav.svelte';
  export function jumpLinks(t: GearTab, panel: object | null): JumpLink[] {
    return [
      panel && ['gear-trophies', 'Your gear'],
      t.drippers.length && ['gear-drippers', 'Dripper ratings'],
      t.filters.length && ['gear-filters', 'Filter ratings'],
      t.matrix && ['gear-matrix', 'Filters per dripper'],
      t.byRoast && ['gear-roast', 'Dripper × roast'],
      t.speeds.length && ['gear-speeds', 'Grind speed ratings'],
      t.speedByGroup && ['gear-speed-coffee', 'Speed × coffee group'],
      t.eras && ['gear-eras', 'Usage over time']
    ];
  }
</script>

<script lang="ts">
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState, InsightsView } from '#lib/insightsUrl.ts';
  import { SAMPLE_HELP } from '#lib/sample.ts';
  import { SAME_BAG_HELP, STRENGTH_LINE } from './DeltaBars.svelte';
  import GearPanel from './GearPanel.svelte';
  import type { ComponentProps } from 'svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import TextTip from '#lib/components/TextTip.svelte';
  import SpeedChart from './SpeedChart.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import UsageChart, { ERA_VIEW_OPTIONS } from './UsageChart.svelte';
  import { fitPairs } from './fitPairs';

  let { t, s, panel, placeTip, choose }: {
    t: GearTab; s: InsightsView; panel: ComponentProps<typeof GearPanel>['panel'] | null;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.drippers.length && !t.filters.length && !t.matrix && !t.byRoast && !t.speeds.length && !t.speedByGroup && !t.eras && !t.grinderEras);
  const ERA_BY_OPTIONS = [['dripper', 'Dripper'], ['grinder', 'Grinder']] as const;
  let gearBy = $derived(s.gearBy ?? 'dripper');
  let eras = $derived(gearBy === 'grinder' ? t.grinderEras : t.eras);
  // The matrix fills the shorter board's column when both boards are there (ui-rules 40).
  let stack = $derived(!!t.matrix && t.drippers.length > 0 && t.filters.length > 0);
  let underDrippers = $derived(t.drippers.length < t.filters.length);
  const BOARD_HELP = [...SAME_BAG_HELP, STRENGTH_LINE, 'Columns: rated brews, bags, average rating, SD (narrow screens drop SD, then bags).',
    'No match: never brewed on the same bag as anything else.'];
  const SPEED_HELP = ["Each brew's score is its rating minus your average rating on that grinder in this period.", "A speed's value is the average of its bags' average scores (each bag counts once).",
    'Columns: rated brews, bags, average rating, SD (narrow screens drop SD, then bags).', 'Speeds are rounded to the nearest 250 RPM.'];
  const SPEED_BY_OPTIONS = [['roast', 'Roast'], ['process', 'Process'], ['origin', 'Origin']] as const;
  let speedBy = $derived(s.speedBy ?? 'roast');
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

{#if panel}<GearPanel {panel} />{/if}
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

  <!-- Grind speed (RPM): the chart + board and the heatmap side by side from 768 px; the chart tile sets the row height and the heatmap's rows shrink to fit it (.confine, from 768 px; no fitPairs: its 2× cap would make the board scroll inside). Each one short line when there is nothing to show. -->
  <div class="gear-pair">
  <section class="chart-panel" data-section="gear-speeds">
    <LabHead id="gear-speeds" title="Ratings by grind speed" help={SPEED_HELP} {placeTip} />
    {#if t.speeds.length}
      {#if t.speedPlot}<SpeedChart m={t.speedPlot} />{/if}
      <div class="fit-body"><LabBoard rows={t.speeds} slots={0} noun="grind speed" vs="vs avg" paired={false} {placeTip} /></div>
    {:else}
      <p class="hl-empty">{emptyLine('No rated brews with a grind speed in this period.')}</p>
    {/if}
  </section>
  <section class="chart-panel" class:confine={!!t.speedByGroup} data-section="gear-speed-coffee">
    <LabHead id="gear-speed-coffee" title="Grind speed × coffee group" {placeTip}
      help={['Rows: coffees grouped by roast, process or origin (3+ bags, 2+ speeds); the 10 with the most brews, A–Z.', "A cell: the group's value at that speed vs its value over all speeds.", 'Values are scores vs the grinder average, averaged over bags.',
        SAMPLE_HELP, 'Blank: never brewed at that speed.']}>
      <ChartToggle label="Group by" options={SPEED_BY_OPTIONS} value={speedBy} pick={(v) => choose({ speedBy: v === 'process' || v === 'origin' ? v : undefined })} />
    </LabHead>
    {#if t.speedByGroup}
      <div class="fit-body"><LabHeatmap by={t.speedByGroup} noun="grind speed for this group" vs="group avg, all speeds" scale={['Worse than its other speeds', 'Better']} ariaLabel="Grind speed by coffee group" /></div>
      {#if t.speedOmitted.length}
        <p class="chart-note">{t.speedOmitted.length} more <TextTip label="groups not shown" tip={{ title: 'Not shown (fewer brews)', rows: t.speedOmitted.map((o) => [o.label, `${o.brews} brews`] as [string, string]) }}>not shown</TextTip>.</p>
      {/if}
    {:else}
      <p class="hl-empty">{emptyLine(t.speeds.length ? 'No coffee group with 3+ bags brewed at 2+ grind speeds in this period.' : 'No rated brews with a grind speed in this period.')}</p>
    {/if}
  </section>
  </div>

  {#if t.eras || t.grinderEras}
    <section class="chart-panel" data-section="gear-eras">
      <LabHead id="gear-eras" title="Gear usage over time" {placeTip}
        help={[`Each ${gearBy}'s share of the month's brews, rated or not.`, 'Shows when you switched.', 'Bars stack to 100%; Lines draw each one on its own.']}>
        <ChartToggle label="Gear" options={ERA_BY_OPTIONS} value={gearBy} pick={(v) => choose({ gearBy: v === 'grinder' ? 'grinder' : undefined })} />
        <ChartToggle label="Bars or lines" options={ERA_VIEW_OPTIONS} value={s.gearView ?? 'bars'} pick={(v) => choose({ gearView: v === 'lines' ? 'lines' : undefined })} />
      </LabHead>
      {#if eras}
        <UsageChart m={eras} view={s.gearView ?? 'bars'} ariaLabel="Gear usage over time: each {gearBy}'s share of brews by month" />
      {:else}
        <p class="hl-empty">{emptyLine(`No ${gearBy} with 20+ brews a month for 3 months in this period.`)}</p>
      {/if}
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
    /* The speed heatmap never stretches the pair: size containment drops its height from the row, so the chart tile sets it and the heatmap rows split what is left (10 rows max, lab.ts SPEED_ROWS). Only with a heatmap, so an empty tile's line and toggle can't clip. */
    .confine {
      contain: size;
    }
    .confine :global(:is(.fit-body, .heatmap, .frame)) {
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .confine :global(.diverging .grid) {
      flex: 1 1 0;
      min-height: 0;
      grid-template-rows: auto;
      grid-auto-rows: minmax(0, 1fr);
    }
  }
</style>
