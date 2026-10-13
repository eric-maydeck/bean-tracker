<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import { EXACT_PARAM, type InsightsUrlState, type InsightsView, type Ratings, type Slice } from '$lib/insightsUrl';
  import type { BrewingTab, BrewVar, LabOptions, VarChart } from '$lib/server/insights/lab';
  import DeltaBars, { bandRows, plural, SAME_BAG_HELP, signed } from './DeltaBars.svelte';
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
  // A long chart (9+ bars or heatmap rows; prod Grind has ~45) takes a full row. Short ones pair up first,
  // each with the one nearest its row count (pairs and their two charts keep the page order), and a pair
  // stretches the shorter chart's rows to the same height. An odd short one out spans too (full rows).
  // A breakdown that has no rows (no slice with 3+ bags) is a one-line message: size 1, always short.
  const noRows = (v: VarChart) => !!s[`${v.key}By`] && !v.by;
  const long = (v: VarChart) => !noRows(v) && (v.bands.length > 8 || (v.by?.rows.length ?? 0) > 8);
  const size = (v: VarChart) => (noRows(v) ? 1 : (v.by?.rows.length ?? v.bands.length));
  let vars = $derived.by(() => {
    const at = (v: VarChart) => t.vars.indexOf(v), order = (a: VarChart, b: VarChart) => at(a) - at(b);
    const short = t.vars.filter((v) => !long(v)).sort((a, b) => size(a) - size(b) || order(a, b));
    const pairs: VarChart[][] = [];
    for (let i = 0; i + 1 < short.length; i += 2) pairs.push([short[i], short[i + 1]].sort(order));
    pairs.sort((a, b) => order(a[0], b[0]));
    const rest = [...(short.length % 2 ? [short.at(-1)!] : []), ...t.vars.filter(long)];
    return [...pairs.flat().map((v) => ({ v, span: false })), ...rest.map((v) => ({ v, span: true }))];
  });

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
      <LabHead id="brewing-rest" title="Rest curve" help={"Each line is a roast level: its bags' average rating per rest band (each bag counts once), minus that roast level's average, so the lines compare. A bag is mostly brewed at one rest, so this compares bags rather than brews of the same bag: it also moves with which coffees were rested longer. Solid: 3+ bags and 30+ brews in the band; a line needs two solid bands."} {placeTip} />
      <!-- ponytail: crude heatmap until the UI dispatch draws t.rest.best (round 1, B1). -->
      <LabHeatmap by={t.rest} ariaLabel="Rest curve: rating vs the roast level's average by days off roast, one row per roast level" />
    </section>
  {/if}

  {#if t.dialIn.length || t.bestAt.length}
    <div class="insights-charts brewing-pair">
      {#if t.dialIn.length}
        <section class="chart-panel" data-section="brewing-dialin">
          <LabHead id="brewing-dialin" title="Dial-in" help={SAME_BAG_HELP} {placeTip} />
          <DeltaBars rows={bandRows(t.dialIn)} ariaLabel="Dial-in: same-bag delta by brew number in the bag" />
        </section>
      {/if}
      {#if t.bestAt.length}
        <section class="chart-panel" data-section="brewing-best">
          <LabHead id="brewing-best" title="Brews to your best" help={"For each bag with 5+ rated brews this period: the brew number of its best-rated brew (the earliest on a tie)."} {placeTip} />
          <Chart type="bar" vertical labels={t.bestAt.map((b) => b.label)} values={t.bestAt.map((b) => b.bags)} datasetLabel="Bags"
            integer format={(v) => `${v} bag${v === 1 ? '' : 's'}`} height={260} />
          <p class="chart-note">Brew number of each bag's best brew (bags with 5+ rated brews)</p>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.drift.length}
    <section class="chart-panel" data-section="brewing-drift">
      <LabHead id="brewing-drift" title="Grind drift" help={"Mean change in grind setting vs each bag's first brew this period on this grinder, by brew number. Pale: under 3 bags."} {placeTip} />
      <DeltaBars colors="direction" ariaLabel="Grind drift by brew number"
        rows={t.drift.map((d) => ({ label: d.label, value: d.value, text: signed(d.value), pale: !d.solid,
          tip: `${d.label}: ${signed(d.value)} vs the first brew's setting · ${plural(d.bags, 'bag')}` }))} />
      <p class="chart-note">Negative = finer. {grinderName}</p>
    </section>
  {/if}

  {#if t.vars.length}
    <section class="brewing-vars" data-section="brewing-vars">
      <LabHead id="brewing-vars" title="Variables vs rating" help={`${SAME_BAG_HELP} Break down by: the same delta per roast level, process, origin or roaster (rows with 3+ bags); faded cells have few brews, blank cells no paired brews. Bands with no paired brews are left out (exact temps list every °C used).`} {placeTip} />
      <div class="var-grid">
        {#each vars as { v, span } (v.key)}
          {@const by = s[`${v.key}By`]}
          {@const ek = EXACT_PARAM[v.key]}
          <section class="chart-panel var-chart heat-fill" class:span data-section="brewing-{v.key}">
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
  .var-grid,
  .brewing-pair {
    --bar-label-w: 5.25rem;
    --bar-value-w: 5.75rem;
  }
  .var-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
  /* A pair is one height: the chart takes the panel's spare height, its rows stretching up to 3rem each
     (centred past that), so the shorter chart of a pair leaves no gap. */
  .var-chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    --bar-rows: minmax(0, 1fr);
  }
  .var-chart > .hl-empty {
    margin-block: auto;
  }
  .var-chart > :global(.delta-bars) {
    flex: 1 1 auto;
    max-height: calc(var(--n) * 3rem);
    margin-block: auto;
  }
  @media (min-width: 900px) {
    .var-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .var-chart.span {
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
