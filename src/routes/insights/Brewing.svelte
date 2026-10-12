<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { InsightsUrlState, InsightsView, Ratings, Slice } from '$lib/insightsUrl';
  import type { BandStat, BrewingTab, BrewVar, LabOptions, VarChart } from '$lib/server/insights/lab';
  import DeltaBars, { SAME_BAG_HELP } from './DeltaBars.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import MultiLine from './MultiLine.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';

  let { t, lab, s, ratingsHelp, placeTip, choose }: {
    t: BrewingTab; lab: LabOptions; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let defaultGrinder = $derived(lab.grinders[0]?.slug);
  let grinderName = $derived((lab.grinders.find((g) => g.slug === s.grinder) ?? lab.grinders[0])?.name ?? '');
  let empty = $derived(!t.rest && !t.dialIn.length && !t.vars.length);
  // A long chart (9+ bars or heatmap rows; prod Grind has ~45) takes a full row; the short ones pair up first,
  // so a pair is never a 200px chart beside a 1500px one. An odd short one out spans too (full rows).
  const long = (v: VarChart) => v.bands.length > 8 || (v.by?.rows.length ?? 0) > 8;
  let vars = $derived([...t.vars.filter((v) => !long(v)), ...t.vars.filter(long)]);
  let shortN = $derived(t.vars.filter((v) => !long(v)).length);

  // True minus sign; a value that rounds to 0 reads "0.00", never "−0.00".
  const signed = (x: number) => (Math.abs(x) < 0.005 ? '0.00' : (x > 0 ? '+' : '−') + Math.abs(x).toFixed(2));
  const NOTABLE = ['85 °C', '88 °C', '91 °C', '92 °C', '94 °C']; // the user's notable temps, bold in Exact (spec)
  const TITLE: Record<BrewVar, string> = { temp: 'Temp', ratio: 'Ratio', dose: 'Dose', time: 'Brew time', bloom: 'Bloom', grind: 'Grind' };
  const BY: [Slice | '', string][] = [['', 'None'], ['roast', 'Roast level'], ['process', 'Process'], ['origin', 'Origin'], ['roaster', 'Roaster']];

  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const rowsOf = (bands: BandStat[], bold = false) => bands.map((b) => ({
    label: b.label, value: b.delta, text: b.delta === null ? '' : signed(b.delta), pale: !b.solid, strength: b.strength,
    bold: bold && NOTABLE.includes(b.label),
    tip: `${b.label}: ${b.delta === null ? 'few brews' : `${signed(b.delta)} vs same bag`} · ${n(b.brews, 'brew')}, ${n(b.bags, 'bag')} · avg ${b.adjusted.toFixed(2)} (${n(b.plainBrews, 'brew')}, ${n(b.plainBags, 'bag')})`
  }));
  // Every thin or empty cell is blank; its words say which: no brews at all, brews but none from a bag
  // brewed in two bands (nothing to compare), or a few paired brews.
  const cellText = (v: VarChart) => (x: number | null, r: number, c: number) => {
    const cell = v.by!.cells[r][c];
    return x !== null ? signed(x) : !cell ? 'No brews' : cell.brews ? 'few brews' : 'No paired brews';
  };
  const cellLabel = (v: VarChart) => (r: number, c: number) => {
    const by = v.by!, cell = by.cells[r][c];
    return `${by.rows[r]} · ${by.cols[c]}${cell?.brews ? ` · ${n(cell.brews, 'brew')}, ${n(cell.bags, 'bag')}` : ''}`;
  };
</script>

{#snippet head(id: string, title: string, help: string)}
  <div class="lab-head">
    <HeadingAnchor {id}>{title}</HeadingAnchor>
    <button class="mode-tip-button" popovertarget="{id}-help" aria-label="About {title}" aria-describedby="{id}-help"><Icon name="question" /></button>
    <div class="mode-tip" id="{id}-help" popover onbeforetoggle={placeTip}>{help}</div>
  </div>
{/snippet}

<div class="insights-bar brewing-bar">
  {#if lab.grinders.length > 1}
    <!-- One Grinder for the tab (ui-rules 6): it drives Grind drift and the Grind chart. -->
    <label class="form-field group-field">
      <span>Grinder</span>
      <select class="ctl-select" aria-label="Grinder" value={s.grinder ?? defaultGrinder}
        onchange={(e) => choose({ grinder: e.currentTarget.value === defaultGrinder ? undefined : e.currentTarget.value })}>
        {#each lab.grinders as g (g.slug)}<option value={g.slug}>{g.name}</option>{/each}
      </select>
    </label>
  {/if}
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews in this period.</p></section>
{:else}
  {#if t.rest}
    <section class="chart-panel" data-section="brewing-rest">
      {@render head('brewing-rest', 'Rest curve', `${SAME_BAG_HELP} Rest moves with dial-in too: later brews of a bag are older and better dialled.`)}
      <MultiLine m={t.rest} ariaLabel="Rest curve: same-bag delta by days off roast, one line per roast level" format={signed} />
    </section>
  {/if}

  {#if t.dialIn.length || t.bestAt.length}
    <div class="insights-charts brewing-pair">
      {#if t.dialIn.length}
        <section class="chart-panel" data-section="brewing-dialin">
          {@render head('brewing-dialin', 'Dial-in', SAME_BAG_HELP)}
          <DeltaBars rows={rowsOf(t.dialIn)} ariaLabel="Dial-in: same-bag delta by brew number in the bag" />
        </section>
      {/if}
      {#if t.bestAt.length}
        <section class="chart-panel" data-section="brewing-best">
          {@render head('brewing-best', 'Brews to your best', "For each bag with 5+ rated brews this period: the brew number of its best-rated brew (the earliest on a tie).")}
          <Chart type="bar" vertical labels={t.bestAt.map((b) => b.label)} values={t.bestAt.map((b) => b.bags)} datasetLabel="Bags"
            integer format={(v) => `${v} bag${v === 1 ? '' : 's'}`} height={260} />
          <p class="chart-note">Brew number of each bag's best brew (bags with 5+ rated brews)</p>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.drift.length}
    <section class="chart-panel" data-section="brewing-drift">
      {@render head('brewing-drift', 'Grind drift', "Mean change in grind setting vs each bag's first brew this period on this grinder, by brew number. Pale: under 3 bags.")}
      <DeltaBars colors="direction" ariaLabel="Grind drift by brew number"
        rows={t.drift.map((d) => ({ label: d.label, value: d.value, text: signed(d.value), pale: !d.solid,
          tip: `${d.label}: ${signed(d.value)} vs the first brew's setting · ${n(d.bags, 'bag')}` }))} />
      <p class="chart-note">Negative = finer. {grinderName}</p>
    </section>
  {/if}

  {#if t.vars.length}
    <section class="brewing-vars" data-section="brewing-vars">
      {@render head('brewing-vars', 'Variables vs rating', `${SAME_BAG_HELP} Break down by: the same delta per roast level, process, origin or roaster (rows with 3+ bags); blank cells have few brews or none.`)}
      <div class="var-grid">
        {#each vars as v, i (v.key)}
          {@const by = s[`${v.key}By`]}
          <section class="chart-panel var-chart" class:span={i >= shortN || (shortN % 2 === 1 && i === shortN - 1)} data-section="brewing-{v.key}">
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
                {#if v.key === 'temp'}
                  <div class="form-field group-field">
                    <span>Show</span>
                    <div class="tab-group tab-group-compact" role="group" aria-label="Temp bands">
                      <button aria-pressed={s.temp !== 'exact'} onclick={() => choose({ temp: undefined })}>Bands</button>
                      <button aria-pressed={s.temp === 'exact'} onclick={() => choose({ temp: 'exact' })}>Exact</button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            {#if v.by}
              <Heatmap diverging rows={v.by.rows} cols={v.by.cols} cells={v.by.cells.map((r) => r.map((c) => c?.delta ?? null))}
                text={cellText(v)} label={cellLabel(v)} ariaLabel="{TITLE[v.key]} by {BY.find(([k]) => k === by)?.[1]}" />
            {:else if by}
              <p class="hl-empty">No {BY.find(([k]) => k === by)?.[1].toLowerCase()} has 3+ bags here.</p>
            {:else}
              <DeltaBars rows={rowsOf(v.bands, v.key === 'temp' && s.temp === 'exact')} ariaLabel="{TITLE[v.key]} vs rating" />
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
  .lab-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .lab-head :global(h2) {
    margin: 0;
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
    align-items: start;
  }
  .var-chart {
    margin: 0;
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
