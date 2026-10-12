<script lang="ts">
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { WaterTab } from '$lib/server/insights/lab';
  import DeltaBars, { bandRows, plural, SAME_BAG_HELP } from './DeltaBars.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import { STRENGTH_HELP } from './Insights.svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import MultiLine from './MultiLine.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';
  import { rowVars } from './rows';

  let { t, s, ratingsHelp, placeTip, choose }: {
    t: WaterTab; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.recipes.length && !t.minerals.length && !t.gh.length && !t.byRoast && !t.byProcess && !t.eras && !t.pairs.length);
  let mineralVars = $derived(rowVars(t.minerals.length));
  // The two heatmaps share their columns (the recipes). Side by side from 1150 px only when both exist and
  // neither would scroll there: a column takes ≥ 3.25rem, so 7 recipes fit beside a roast/process label.
  // ponytail: column-count estimate, not a measurement; measure the grids if long row labels ever scroll.
  let heatPair = $derived(!!t.byRoast && !!t.byProcess && t.byRoast.cols.length <= 7);

  const UNIT: Record<string, string> = { gh: 'ppm', kh: 'ppm', mgca: '', mgk: '' };
  const unitOf = (key: string) => UNIT[key] ?? 'mg/L';
  const BADGE_HELP = `${STRENGTH_HELP.solid} ${STRENGTH_HELP.hint}`;
</script>

<div class="insights-bar">
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews with a water recipe in this period.</p></section>
{:else}
  {#if t.recipes.length}
    <section class="chart-panel" data-section="water-recipes" style:--rows={t.recipes.length} style:--row-h="3rem">
      <LabHead id="water-recipes" title="Recipes" help={`Each recipe's same-bag delta. ${SAME_BAG_HELP} ${BADGE_HELP} Under the name: the months it was used, its rated brews and bags, and its plain bag-weighted average. Unpaired: no bag was brewed with it and another recipe.`} {placeTip} />
      <LabBoard rows={t.recipes} />
    </section>
  {/if}

  {#if t.minerals.length}
    <section class="chart-panel" data-section="water-minerals">
      <LabHead id="water-minerals" title="Minerals vs rating" help={"For each value of a mineral used in your water recipes: the plain bag-weighted average rating of the brews made with it. Bars run above or below your average for this mineral (every rated brew whose recipe lists it), shown as the centre line. These are not same-bag comparisons: the water changed with time and with what you were brewing, so read them as leads, not causes. Pale: under 3 bags or 30 brews."} {placeTip} />
      <p class="chart-note mineral-note">Strongly tied to era and roast level: these are plain averages, not same-bag comparisons.</p>
      <div class="hl-grid mineral-grid">
        {#each t.minerals as m, i (m.key)}
          {@const unit = unitOf(m.key)}
          <div class="hl-card mineral-card" style={mineralVars[i]}>
            <HeadingAnchor id="water-{m.key}" level={3}>{m.name}{#if unit}<small class="unit">{unit}</small>{/if}</HeadingAnchor>
            <DeltaBars ariaLabel="{m.name} vs rating, against an average of {m.overall.toFixed(2)}"
              rows={m.bars.map((b) => ({ label: b.label, value: b.value - m.overall, text: b.value.toFixed(2), pale: !b.solid,
                tip: `${b.label}${unit ? ` ${unit}` : ''}: avg ${b.value.toFixed(2)} (${plural(b.brews, 'brew')}, ${plural(b.bags, 'bag')}) · overall ${m.overall.toFixed(2)}` }))} />
            <p class="chart-note">Centre: avg {m.overall.toFixed(2)}</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if t.gh.length}
    <section class="chart-panel" data-section="water-gh">
      <LabHead id="water-gh" title="GH vs rating" help={`General hardness (ppm as CaCO₃) of the recipe, in bands. ${SAME_BAG_HELP}`} {placeTip} />
      <DeltaBars rows={bandRows(t.gh)} ariaLabel="GH vs rating: same-bag delta by hardness band" />
    </section>
  {/if}

  {#if t.byRoast || t.byProcess}
    <div class="heat-grid" class:paired={heatPair}>
      {#if t.byRoast}
        <section class="chart-panel heat-panel heat-fill" data-section="water-roast">
          <LabHead id="water-roast" title="Water × roast level" help={`Each recipe's same-bag delta within one roast level (rows with 3+ bags). ${SAME_BAG_HELP} Faded cells have few brews, blank cells no paired brews.`} {placeTip} />
          <LabHeatmap by={t.byRoast} ariaLabel="Water recipe by roast level" />
        </section>
      {/if}
      {#if t.byProcess}
        <section class="chart-panel heat-panel heat-fill" data-section="water-process">
          <LabHead id="water-process" title="Water × process" help={`Each recipe's same-bag delta within one process (rows with 3+ bags). ${SAME_BAG_HELP} Faded cells have few brews, blank cells no paired brews.`} {placeTip} />
          <LabHeatmap by={t.byProcess} ariaLabel="Water recipe by process" />
        </section>
      {/if}
    </div>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="water-eras">
      <LabHead id="water-eras" title="Water eras" help={"Each recipe's share of the month's brews (rated or not), so you can see when you switched."} {placeTip} />
      <MultiLine m={t.eras} ariaLabel="Water eras: each recipe's share of brews by month" format={(n) => `${n}%`} thin />
    </section>
  {/if}

  {#if t.pairs.length}
    <section class="chart-panel" data-section="water-pairs">
      <LabHead id="water-pairs" title="Same bag, different water" help={"Bags brewed with two or more recipes (2+ rated brews each): the best recipe's average rating against the others'. The gap is best vs runner-up. Top 10 by gap."} {placeTip} />
      <ol class="board-rows" style:--rows={t.pairs.length} style:--row-h="3rem">
        {#each t.pairs as p, i (i)}
          <li class="board-row">
            <span class="rank">{i + 1}</span>
            <span class="who">
              {#if p.href}<a href={p.href}>{p.label}</a>{:else}<span class="name">{p.label}</span>{/if}
              <!-- A repurchase's tag ("roasted May 5") leads, so the ellipsis never hides it. -->
              <small>{[p.tag, `${p.best.water} ${p.best.mean.toFixed(2)} vs ${p.others.map((o) => `${o.water} ${o.mean.toFixed(2)}`).join(', ')}`].filter(Boolean).join(' · ')}</small>
            </span>
            <span></span>
            <span class="val">+{p.gap.toFixed(2)}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
{/if}

<style>
  .mineral-note {
    margin: calc(-1 * var(--space-2)) 0 var(--space-3);
  }
  /* A mineral card is a small chart: title left, the bars taking its spare height so a row's cards match. */
  .mineral-card {
    align-items: stretch;
    text-align: start;
    gap: var(--space-2);
    --bar-rows: minmax(0, 1fr);
  }
  .mineral-card :global(h3) {
    margin: 0;
    font-size: 0.95rem;
  }
  .unit {
    margin-left: 0.3em;
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-muted);
  }
  .mineral-card > :global(.delta-bars) {
    flex: 1 1 auto;
    max-height: calc(var(--n) * 3rem);
  }
  .mineral-card > .chart-note {
    margin: auto 0 0;
  }
  .heat-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .heat-panel {
    margin: 0;
  }
  @media (min-width: 1150px) {
    .heat-grid.paired {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
