<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import { EXACT_PARAM, type InsightsUrlState, type InsightsView, type Ratings, type Slice } from '$lib/insightsUrl';
  import type { BrewingTab, BrewVar, LabOptions, VarChart } from '$lib/server/insights/lab';
  import DeltaBars, { bandRows, SAME_BAG_HELP, signed } from './DeltaBars.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import GrinderSelect from './GrinderSelect.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';

  let { t, lab, s, ratingsHelp, placeTip, choose }: {
    t: BrewingTab; lab: LabOptions; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let grinderName = $derived((lab.grinders.find((g) => g.slug === s.grinder) ?? lab.grinders[0])?.name ?? '');
  let empty = $derived(!t.rest && !t.dialIn.length && !t.bestAt.length && !t.drift.length && !t.vars.length);
  // Fixed slots (G9/B5): a toggle or Break down by never moves a chart. Pairs share a row (one height); Brew
  // time is full width; Grind drift sits beside Grind. A slot with no data leaves its partner the full row.
  const SLOTS: (BrewVar | 'drift')[][] = [['temp', 'ratio'], ['dose', 'bloom'], ['time'], ['grind', 'drift']];
  let slots = $derived(SLOTS.map((row) => row.filter((k) => (k === 'drift' ? t.drift.length : t.vars.some((v) => v.key === k)))).filter((r) => r.length));
  const chartOf = (k: BrewVar) => t.vars.find((v) => v.key === k)!;

  const NOTABLE = ['85 °C', '88 °C', '91 °C', '92 °C', '94 °C']; // the user's notable temps, bold in Exact (spec)
  const TITLE: Record<BrewVar, string> = { temp: 'Temp', ratio: 'Ratio', dose: 'Dose', time: 'Brew time', bloom: 'Bloom', grind: 'Grind' };
  const BY: [Slice | '', string][] = [['', 'None'], ['roast', 'Roast level'], ['process', 'Process'], ['origin', 'Origin'], ['roaster', 'Roaster']];
</script>

<div class="insights-bar brewing-bar">
  <!-- One Grinder for the tab: it drives Grind drift and the Grind chart. -->
  <GrinderSelect grinders={lab.grinders} grinder={s.grinder} {choose} />
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews in this period.</p></section>
{:else}
  {#if t.rest}
    <section class="chart-panel" data-section="brewing-rest">
      <LabHead id="brewing-rest" title="Rest curve" {placeTip}
        help={"Rows are roast levels, columns are days off roast. A cell is that roast level's bags' average rating in the window (each bag counts once), minus the roast level's usual, so rows compare.\nGreen: better than usual; red: worse. Outlined: the row's best window (2+ solid cells). Faded: under 3 bags or 30 brews.\nA bag is mostly brewed at one rest, so this compares bags rather than brews of the same bag: it also moves with which coffees were rested longer."} />
      <LabHeatmap by={t.rest} best={t.rest.best} vs="usual" noun="rest window" scale={['Below the roast level\'s usual', 'Above']}
        ariaLabel="Rest curve: rating vs the roast level's usual by days off roast, one row per roast level" />
    </section>
  {/if}

  {#if t.dialIn.length || t.bestAt.length}
    <div class="lab-grid">
      {#if t.dialIn.length}
        <section class="chart-panel lab-chart" class:span={!t.bestAt.length} data-section="brewing-dialin">
          <LabHead id="brewing-dialin" title="Dial-in" level={3} help={SAME_BAG_HELP} {placeTip} />
          <DeltaBars rows={bandRows(t.dialIn, undefined, 'brew number')} ariaLabel="Dial-in: same-bag delta by brew number in the bag" />
        </section>
      {/if}
      {#if t.bestAt.length}
        <section class="chart-panel lab-chart best-chart" class:span={!t.dialIn.length} data-section="brewing-best">
          <LabHead id="brewing-best" title="Brews until dialed" level={3} help={"For each bag with 5+ rated brews this period: the brew number of its best-rated brew (the earliest on a tie)."} {placeTip} />
          <Chart type="bar" vertical labels={t.bestAt.map((b) => b.label)} values={t.bestAt.map((b) => b.bags)} datasetLabel="Bags"
            integer format={(v) => `${v} bag${v === 1 ? '' : 's'}`} height={240} />
          <p class="chart-note">Brew number of each bag's best brew (bags with 5+ rated brews)</p>
        </section>
      {/if}
    </div>
  {/if}

  {#if slots.length}
    <section class="brewing-vars" data-section="brewing-vars">
      <LabHead id="brewing-vars" title="Variables vs rating" {placeTip}
        help={`${SAME_BAG_HELP}\nBands or Exact: each chart groups its setting into bands, or lists each value (rounded: ratio and dose to 0.5, brew time to 5 s).\nBreak down by: the same delta per roast level, process, origin or roaster (rows with 3+ bags); faded cells have few brews, blank cells no match.`} />
      <div class="lab-grid">
        {#each slots as row (row.join())}
          {#each row as k (k)}
            {#if k === 'drift'}
              <section class="chart-panel lab-chart" class:span={row.length === 1} data-section="brewing-drift">
                <LabHead id="brewing-drift" title="Grind drift" level={3} {placeTip}
                  help={"Mean change in grind setting vs each bag's first brew this period on this grinder, by brew number.\nPale: under 3 bags."} />
                <DeltaBars colors="direction" ariaLabel="Grind drift by brew number"
                  rows={t.drift.map((d) => ({ label: d.label, value: d.value, text: signed(d.value), pale: !d.solid,
                    tip: { title: d.label, rows: [['Bags', `${d.bags}`], ...(d.solid ? [] : [['Strength', 'Few bags']])] as [string, string][] } }))} />
                <p class="chart-note">Negative = finer. {grinderName}</p>
              </section>
            {:else}
              {@const v = chartOf(k)}
              {@const by = s[`${v.key}By`]}
              {@const ek = EXACT_PARAM[v.key]}
              <section class="chart-panel lab-chart heat-fill" class:span={row.length === 1} data-section="brewing-{v.key}">
                <div class="var-head">
                  <HeadingAnchor id="brewing-{v.key}" level={3}>{TITLE[v.key]}</HeadingAnchor>
                  <div class="var-ctls">
                    <label class="form-field group-field">
                      <span>Break down by</span>
                      <select class="ctl-select" aria-label="Break down by" value={by ?? ''}
                        onchange={(e) => choose({ [`${v.key}By`]: (e.currentTarget.value as Slice) || undefined } as InsightsUrlState)}>
                        {#each BY as [val, name] (val)}<option value={val}>{name}</option>{/each}
                      </select>
                    </label>
                    <div class="form-field group-field">
                      <span>Show</span>
                      <div class="tab-group tab-group-compact" role="group" aria-label="{TITLE[v.key]} bands">
                        <button aria-pressed={s[ek] !== 'exact'} onclick={() => choose({ [ek]: undefined })}>Bands</button>
                        <button aria-pressed={s[ek] === 'exact'} onclick={() => choose({ [ek]: 'exact' })}>Exact</button>
                      </div>
                    </div>
                  </div>
                </div>
                {#if v.by}
                  <LabHeatmap by={v.by} ariaLabel="{TITLE[v.key]} by {BY.find(([k]) => k === by)?.[1]}" />
                {:else if by}
                  <p class="hl-empty">No {BY.find(([k]) => k === by)?.[1].toLowerCase()} has 3+ bags here.</p>
                {:else}
                  <DeltaBars rows={bandRows(v.bands, (l) => v.key === 'temp' && s.temp === 'exact' && NOTABLE.includes(l))} ariaLabel="{TITLE[v.key]} vs rating" />
                {/if}
                {#if v.key === 'grind'}<p class="chart-note">{grinderName}</p>{/if}
              </section>
            {/if}
          {/each}
        {/each}
      </div>
    </section>
  {/if}
{/if}

<style>
  .brewing-bar {
    align-items: end;
  }
  .brewing-vars {
    margin-bottom: var(--space-5);
  }
  /* Fixed label and value columns: the 0 lines of side-by-side (and stacked) charts line up. */
  .lab-grid {
    --bar-label-w: 5.25rem;
    --bar-value-w: 5.75rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .brewing-vars .lab-grid {
    margin-bottom: 0;
  }
  /* A pair is one height: the chart takes the panel's spare height, its rows stretching up to 3rem each
     (centred past that), so the shorter chart of a pair leaves no gap. */
  .lab-chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    --bar-rows: minmax(0, 1fr);
  }
  .lab-chart > .hl-empty {
    margin-block: auto;
  }
  .lab-chart > :global(.delta-bars) {
    flex: 1 1 auto;
    max-height: calc(var(--n) * 3rem);
    margin-block: auto;
  }
  /* Brews until dialed fills its tile's height beside Dial-in (B2); 240px is its floor. */
  .best-chart > :global(.chart-container) {
    flex: 1 1 auto;
    height: auto !important; /* over Chart's inline height, which stays the minimum */
    min-height: 240px;
    position: relative;
  }
  @media (min-width: 900px) {
    .lab-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .lab-chart.span {
      grid-column: 1 / -1;
    }
  }
  /* Title left, toggles right: one row, wrapping only on phones. */
  .var-head {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }
  .var-head :global(h3) {
    margin: 0;
    align-self: center;
  }
  .var-ctls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-2) var(--space-3);
  }
  .var-ctls .form-field {
    margin-bottom: 0;
  }
  .var-ctls .tab-group {
    flex-wrap: nowrap;
  }
  /* The select's height, so the two controls share a baseline (ui-rules 32): 44px where .ctl-select is. */
  .var-ctls .tab-group button {
    min-height: 2.25rem;
  }
  @media (max-width: 640px) {
    .var-ctls .tab-group button {
      min-height: 44px;
    }
  }
</style>
