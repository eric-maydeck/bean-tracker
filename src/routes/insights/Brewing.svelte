<script lang="ts">
  import { useEmptyLine } from './coffeeNote';
  import Chart from '$lib/components/Chart.svelte';
  import { EXACT_PARAM, type InsightsUrlState, type InsightsView, type Slice } from '$lib/insightsUrl';
  import type { BrewingTab, BrewVar, LabOptions } from '$lib/server/insights/lab';
  import { SAMPLE_HELP, sampleField } from '$lib/sample';
  import DeltaBars, { bandRows, SAME_BAG_HELP } from './DeltaBars.svelte';
  import { signed } from '$lib/components/deltaColor';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import GrinderSelect from './GrinderSelect.svelte';
  import { fitPairs } from './fitPairs';
  import BarLabels from './BarLabels.svelte';
  import { settleTip } from './settleTip';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody, { tipText } from '$lib/components/TipBody.svelte';

  let { t, lab, s, placeTip, choose }: {
    t: BrewingTab; lab: LabOptions; s: InsightsView;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let grinderName = $derived((lab.grinders.find((g) => g.slug === s.grinder) ?? lab.grinders[0])?.name ?? '');
  let empty = $derived(!t.rest && !t.dialIn.length && !t.bestAt.length && !t.settle.roast.length && !t.settle.process.length && !t.drift.length && !t.vars.length);
  // Brews until dialed in, by roast level and by process (gate P4): a pair under Dial-in; a lone one spans the row.
  const SETTLE = [['roast', 'roast level'], ['process', 'process']] as const;
  // Fixed slots (G9/B5): a toggle or Break down by never moves a chart. Pairs share a row (one height); Brew
  // time is full width; Grind drift sits beside Grind. A slot with no data leaves its partner the full row.
  const SLOTS: (BrewVar | 'drift')[][] = [['temp', 'ratio'], ['dose', 'bloom'], ['time'], ['grind', 'drift']];
  let slots = $derived(SLOTS.map((row) => row.filter((k) => (k === 'drift' ? t.drift.length : t.vars.some((v) => v.key === k)))).filter((r) => r.length));
  const chartOf = (k: BrewVar) => t.vars.find((v) => v.key === k)!;
  // Brews until dialed's window (lab.ts BEST_WINDOW, server-only): one bar per brew number in it.
  let win = $derived(t.bestAt.length);

  const NOTABLE = ['85 °C', '88 °C', '91 °C', '92 °C', '94 °C']; // the user's notable temps, bold in Exact (spec)
  const TITLE: Record<BrewVar, string> = { temp: 'Temp', ratio: 'Ratio', dose: 'Dose', time: 'Brew time', bloom: 'Bloom', grind: 'Grind' };
  const BY: [Slice | '', string][] = [['', 'None'], ['roast', 'Roast level'], ['process', 'Process'], ['origin', 'Origin'], ['roaster', 'Roaster']];
  const emptyLine = useEmptyLine();
  type SettleRow = BrewingTab['settle']['roast'][number];
  let settleOpen = $state<{ el: HTMLElement; g: SettleRow; hover: boolean } | null>(null);
</script>

<div class="insights-bar brewing-bar">
  <!-- One Grinder for the tab: it drives Grind drift and the Grind chart. -->
  <GrinderSelect grinders={lab.grinders} grinder={s.grinder} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No rated brews in this period.')}</p></section>
{:else}
  {#if t.rest}
    <section class="chart-panel" data-section="brewing-rest">
      <LabHead id="brewing-rest" title="Rest curve" {placeTip}
        help={["A cell: the roast level's bags' average rating in that window (each bag once), minus its usual.",
          'Green: better than usual.', 'Red: worse.', "Outlined: the row's best window (2+ well-sampled cells).", SAMPLE_HELP,
          'It compares bags, not brews of one bag, so it also moves with which coffees rested longer.']} />
      <LabHeatmap by={t.rest} best={t.rest.best} vs="usual" noun="rest window" scale={['Below the roast level\'s usual', 'Above']}
        ariaLabel="Rest curve: rating vs the roast level's usual by days off roast, one row per roast level" />
    </section>
  {/if}

  {#if t.dialIn.length || t.bestAt.length || t.settle.roast.length || t.settle.process.length}
    <div class="lab-grid" use:fitPairs={t}>
      {#if t.dialIn.length}
        <section class="chart-panel lab-chart" class:span={!t.bestAt.length} data-section="brewing-dialin">
          <LabHead id="brewing-dialin" title="Dial-in" help={SAME_BAG_HELP} {placeTip} />
          <div class="fit-body"><DeltaBars rows={bandRows(t.dialIn, undefined, 'brew number')} ariaLabel="Dial-in: same-bag delta by brew number in the bag" /></div>
          {#if s.dial === 'dialed'}<p class="chart-note"><span class="setting-name">Always all brews</span></p>{/if}
        </section>
      {/if}
      {#if t.bestAt.length}
        <section class="chart-panel lab-chart best-chart" class:span={!t.dialIn.length} data-section="brewing-best">
          <LabHead id="brewing-best" title="Brews until dialed" help={[`Each bag with 5+ rated brews among its first ${win} this period: the brew number of its best-rated brew.`, `Only the first ${win} count, so a bag brewed longer gets no extra chances at a late best.`, 'A tie: the earliest.']} {placeTip}
            cut={{ lead: `Only the first ${win} brews are shown.`, tip: t.bestLater.length
              ? { title: `Best brew after #${win}`, rows: t.bestLater.map((x) => [x.label, `${x.bags} bag${x.bags === 1 ? '' : 's'}`]), note: `Bags whose best brew came later, beating their first ${win}.` }
              : { title: `Best brew after #${win}`, note: `No bag's best brew came after its first ${win}.` } }} />
          <div class="fit-body">
            <Chart type="bar" vertical labels={t.bestAt.map((b) => b.label)} values={t.bestAt.map((b) => b.bags)} datasetLabel="Bags"
              integer format={(v) => `${v} bag${v === 1 ? '' : 's'}`} height={240} />
          </div>
          <p class="chart-note">Brew number of each bag's best brew, within its first {win} (bags with 5+ rated there){#if s.dial === 'dialed'} · <span class="setting-name">Always all brews</span>{/if}</p>
        </section>
      {/if}
      {#each SETTLE as [k, by] (k)}
        {@const rows = t.settle[k]}
        {#if rows.length}
          {@const max = Math.max(...rows.map((g) => g.value))}
          <section class="chart-panel lab-chart" class:span={!t.settle[k === 'roast' ? 'process' : 'roast'].length} data-section="brewing-settle-{k}">
            <LabHead id="brewing-settle-{k}" title="Brews until dialed in, by {by}" {placeTip}
              help={["Each bag's settle brew: within its first 6 rated brews, the first within 0.5 of their best half's average.", `Per ${by}: the middle bag's, in whole brews.`,
                'Bags with 6+ rated brews that started this period.', SAMPLE_HELP]} />
            <div class="fit-body">
              <div class="settle">
                <div class="settle-cols" role="group" aria-label="Brews until dialed in by {by}">
                  {#each rows as g (g.label)}<button type="button" class="col" aria-label={tipText(settleTip(g))}
                    onpointerenter={(e) => e.pointerType === 'mouse' && (settleOpen = { el: e.currentTarget.firstElementChild as HTMLElement, g, hover: true })}
                    onpointerleave={(e) => e.pointerType === 'mouse' && settleOpen?.hover && (settleOpen = null)}
                    onfocus={(e) => e.currentTarget.matches(':focus-visible') && (settleOpen = { el: e.currentTarget.firstElementChild as HTMLElement, g, hover: false })}
                    onblur={() => (settleOpen = null)}
                    onclick={(e) => (settleOpen = { el: e.currentTarget.firstElementChild as HTMLElement, g, hover: false })}
                    ><span class="bar" class:small-sample-mark={g.sample.small} style:height="{(g.value / max) * 100}%"></span></button>{/each}
                </div>
                <BarLabels series={rows} full />
              </div>
            </div>
            <p class="chart-note">Median settle brew per {by}{#if s.dial === 'dialed'} · <span class="setting-name">Always all brews</span>{/if}</p>
          </section>
        {/if}
      {/each}
      {#if settleOpen}<FloatTip anchor={settleOpen.el} onclose={() => (settleOpen = null)}><TipBody tip={settleTip(settleOpen.g)} /></FloatTip>{/if}
    </div>
  {/if}

  {#if slots.length}
    <section class="brewing-vars" data-section="brewing-vars">
      <LabHead id="brewing-vars" title="Variables vs rating" {placeTip}
        help={[...SAME_BAG_HELP, 'Bands · Exact: group a setting into bands, or list each value (rounded).',
          'Break down by: the same delta per roast level, process, origin or roaster (rows with 3+ bags).', 'Blank: no match.']} />
      <div class="lab-grid" use:fitPairs={[t, s]}>
        {#each slots as row (row.join())}
          {#each row as k (k)}
            {#if k === 'drift'}
              <section class="chart-panel lab-chart" class:span={row.length === 1} data-section="brewing-drift">
                <LabHead id="brewing-drift" title="Grind drift" level={3} {placeTip}
                  help={["Mean change in grind setting vs each bag's first brew this period, on this grinder.", 'One row per brew number in the bag.', SAMPLE_HELP]} />
                <div class="fit-body">
                  <DeltaBars colors="direction" ariaLabel="Grind drift by brew number"
                    rows={t.drift.map((d) => ({ label: d.label, value: d.value, text: signed(d.value), small: d.sample.small,
                      tip: { title: d.label, rows: d.sample.small ? [] : [['Bags', `${d.bags}`]], ...sampleField(d.sample) } }))} />
                </div>
                <p class="chart-note">Negative = finer. {grinderName}{#if s.dial === 'dialed'} · <span class="setting-name">Always all brews</span>{/if}</p>
              </section>
            {:else}
              {@const v = chartOf(k)}
              {@const by = s[`${v.key}By`]}
              {@const ek = EXACT_PARAM[v.key]}
              <section class="chart-panel lab-chart" class:span={row.length === 1} data-section="brewing-{v.key}">
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
                <div class="fit-body">
                  {#if v.by}
                    <LabHeatmap by={v.by} ariaLabel="{TITLE[v.key]} by {BY.find(([k]) => k === by)?.[1]}" />
                  {:else if by}
                    <p class="hl-empty">No {BY.find(([k]) => k === by)?.[1].toLowerCase()} has 3+ bags with paired brews here.</p>
                  {:else}
                    <DeltaBars rows={bandRows(v.bands, (l) => v.key === 'temp' && s.temp === 'exact' && NOTABLE.includes(l))} ariaLabel="{TITLE[v.key]} vs rating" />
                  {/if}
                </div>
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
    --bar-value-w: 7.25rem; /* fits "-0.18" plus the Possible pill */
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .brewing-vars .lab-grid {
    margin-bottom: 0;
  }
  /* A pair is one height (fitPairs, ui-rules 37): the chart body fills the card. */
  .lab-chart {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  /* Brews until dialed fills its tile's height beside Dial-in (B2); 240px is its floor. The canvas is taken
     out of flow, so the card's natural height is the floor, not the last drawn size. */
  .best-chart :global(.chart-container) {
    height: auto !important; /* over Chart's inline height, which stays the minimum */
    min-height: 240px;
    position: relative;
  }
  .best-chart :global(.chart-container canvas) {
    position: absolute;
    inset: 0;
  }
  /* Brews until dialed in: columns from a zero baseline, filling the card's spare height (fitPairs). */
  .settle {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .settle-cols {
    flex: 1 0 8rem;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    align-items: end;
    gap: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }
  .settle-cols .col {
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    border: 0;
    padding: 0;
    background: none;
    cursor: help;
  }
  .settle-cols .col:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  /* One series, no categories: the lone-highlight brown (ui-rules 42). */
  .settle-cols .bar {
    width: min(100%, 3rem);
    border-radius: 3px 3px 0 0;
    background-color: var(--chart-color-1);
  }
  /* A panel has room for whole names: they wrap under their column instead of an ellipsis. */
  .settle :global(.bar-labels.full span) {
    font-size: 0.75rem;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  /* viewport 900px (no rail; the rail narrows it) */
  @container insights (min-width: 868px) {
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
