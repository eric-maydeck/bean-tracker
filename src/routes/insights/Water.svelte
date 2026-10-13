<script lang="ts">
  import { tick } from 'svelte';
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { WaterTab } from '$lib/server/insights/lab';
  import DeltaBars, { bandRows, SAME_BAG_HELP, signed } from './DeltaBars.svelte';
  import { STRENGTH_HELP } from './Insights.svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import MineralMap from './MineralMap.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';
  import StackedBars from './StackedBars.svelte';
  import { seriesColors } from './multiLine';
  import { fitPairs } from './fitPairs';

  let { t, s, ratingsHelp, placeTip, choose }: {
    t: WaterTab; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.recipes.length && !t.map && !t.gh.length && !t.byRoast && !t.byProcess && !t.eras && !t.pairs.length);
  // A recipe's color, the same as in Water usage over time (its line's series slot); a recipe folded into
  // "Other" there takes the muted Other color.
  let recipeColor = $derived.by(() => {
    const labels = t.eras?.lines.map((l) => l.label) ?? [];
    const c = new Map(labels.map((l, i) => [l, seriesColors(labels)[i]]));
    return (recipe: string) => c.get(recipe) ?? 'var(--series-other)';
  });
  // The two heatmaps share their columns (the recipes). Side by side from 1150 px only when both exist and
  // neither would scroll there: a column takes ≥ 3.25rem, so 7 recipes fit beside a roast/process label.
  // ponytail: column-count estimate, not a measurement; measure the grids if long row labels ever scroll.
  let heatPair = $derived(!!t.byRoast && !!t.byProcess && t.byRoast.cols.length <= 7);

  const BADGE_HELP = `${STRENGTH_HELP.solid} ${STRENGTH_HELP.hint}`;
  // W7: the pair's average gap, from A's side; "even" when it rounds to 0.
  const gap = (d: number) => (Math.abs(d) < 0.005 ? 'even' : `${signed(d)} on average`);
  const TIE = 0.005;
  // W7: a pair shows its 5 biggest gaps (the server sorts by |a − b|); "Show all" puts its slug in `pairs`.
  const SHOWN = 5;
  async function togglePair(slug: string, e: MouseEvent) {
    const open = s.pairs?.includes(slug);
    const next = open ? (s.pairs ?? []).filter((x) => x !== slug) : [...(s.pairs ?? []), slug];
    const block = (e.currentTarget as HTMLElement).closest('.pair');
    choose({ pairs: next.length ? next : undefined });
    if (open) { await tick(); block?.scrollIntoView({ block: 'nearest' }); } // collapsing: keep the pair in view
  }
</script>

<div class="insights-bar">
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
</div>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">No rated brews with a water recipe in this period.</p></section>
{:else}
  {#if t.recipes.length || t.gh.length}
    <!-- Ratings by recipe beside GH vs rating (W3): half slots, one height. -->
    <div class="insights-charts water-pair" use:fitPairs={t}>
      {#if t.recipes.length}
        <section class="chart-panel" class:span={!t.gh.length} data-section="water-recipes" style:--row-h="3rem">
          <LabHead id="water-recipes" title="Ratings by recipe" {placeTip}
            help={`Each recipe's same-bag delta.\n${SAME_BAG_HELP}\n${BADGE_HELP}\nColumns: rated brews and bags, the plain bag-weighted average rating and the SD of its ratings. Under the name: the months it was used.\nNo match: never brewed on the same bag as another recipe.`} />
          <div class="fit-body"><LabBoard rows={t.recipes} noun="recipe" {placeTip} /></div>
        </section>
      {/if}
      {#if t.gh.length}
        <section class="chart-panel gh-chart" class:span={!t.recipes.length} data-section="water-gh">
          <LabHead id="water-gh" title="GH vs rating" help={`General hardness (ppm as CaCO₃) of the recipe, one row per value used.\n${SAME_BAG_HELP}`} {placeTip} />
          <div class="fit-body"><DeltaBars rows={bandRows(t.gh, undefined, 'hardness')} ariaLabel="GH vs rating: same-bag delta by hardness" /></div>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.map}
    <section class="chart-panel" data-section="water-minerals">
      <LabHead id="water-minerals" title="Recipe mineral map" {placeTip}
        help={"Each recipe with an entered water profile, best rating vs usual first (the same-bag delta from Ratings by recipe; no match last), and its minerals. A mineral cell is shaded within its column: light = little, dark = the most any recipe used.\nStrongly tied to era and roast level: the water changed with time and with what you were brewing, so read the minerals as leads, not causes."} />
      <MineralMap map={t.map} />
    </section>
  {/if}

  {#if t.byRoast || t.byProcess}
    <div class="heat-grid" class:paired={heatPair} use:fitPairs={[t, heatPair]}>
      {#if t.byRoast}
        <section class="chart-panel heat-panel" data-section="water-roast">
          <LabHead id="water-roast" title="Water × roast level" help={`Each recipe's same-bag delta within one roast level (rows with 3+ bags).\n${SAME_BAG_HELP}\nFaded: few brews. Blank: no match.`} {placeTip} />
          <div class="fit-body"><LabHeatmap by={t.byRoast} noun="recipe" ariaLabel="Water recipe by roast level" /></div>
        </section>
      {/if}
      {#if t.byProcess}
        <section class="chart-panel heat-panel" data-section="water-process">
          <LabHead id="water-process" title="Water × process" help={`Each recipe's same-bag delta within one process (rows with 3+ bags).\n${SAME_BAG_HELP}\nFaded: few brews. Blank: no match.`} {placeTip} />
          <div class="fit-body"><LabHeatmap by={t.byProcess} noun="recipe" ariaLabel="Water recipe by process" /></div>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="water-eras">
      <LabHead id="water-eras" title="Water usage over time" help={"Each recipe's share of the month's brews (rated or not), so you can see when you switched."} {placeTip} />
      <StackedBars m={t.eras} ariaLabel="Water usage over time: each recipe's share of brews by month" />
    </section>
  {/if}

  {#if t.pairs.length}
    <section class="chart-panel" data-section="water-pairs">
      <LabHead id="water-pairs" title="Same bag, different water" {placeTip}
        help={"Every two recipes used on the same bag (2+ rated brews each), most shared bags first.\nThe headline counts the bags each recipe won and the average gap, from the first recipe's side. Under it, the 5 bags with the biggest gap (Show all lists every bag): each bag's two average ratings, the first recipe's first; the higher one is bold."} />
      <div class="pairs">
        {#each t.pairs as p (p.slug)}
          {@const all = !!s.pairs?.includes(p.slug)}
          <div class="pair" style:--ca={recipeColor(p.a)} style:--cb={recipeColor(p.b)}>
            <p class="pair-head">
              <span class="pair-names"
                ><span class="swatch a" aria-hidden="true"></span><strong>{p.a}</strong> vs <span class="swatch b" aria-hidden="true"></span>{p.b}</span
              >
              <span class="pair-sum">{p.a} won {p.won} of {p.bags.length} bag{p.bags.length === 1 ? '' : 's'}{p.tied ? ` (${p.tied} tied)` : ''} · {gap(p.delta)}</span>
            </p>
            <ol class="pair-bags">
              {#each all ? p.bags : p.bags.slice(0, SHOWN) as b, j (j)}
                <li>
                  <span class="bag">{#if b.href}<a href={b.href}>{b.label}</a>{:else}{b.label}{/if}{#if b.tag}<small> {b.tag}</small>{/if}</span>
                  <span class="score a" class:win={b.a - b.b >= TIE}>{b.a.toFixed(2)}</span>
                  <span class="sep" aria-hidden="true">·</span>
                  <span class="score b" class:win={b.b - b.a >= TIE}>{b.b.toFixed(2)}</span>
                </li>
              {/each}
            </ol>
            {#if p.bags.length > SHOWN}
              <button class="button button-ghost pair-more" type="button" aria-expanded={all} onclick={(e) => togglePair(p.slug, e)}>
                {all ? 'Show fewer' : `Show all ${p.bags.length}`}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<style>
  .water-pair > .chart-panel {
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 900px) {
    .water-pair > .span {
      grid-column: 1 / -1;
    }
  }
  .heat-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  .heat-panel {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 1150px) {
    .heat-grid.paired {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  /* Same bag, different water (W7): one block per recipe pair, balanced over two columns when wide. */
  .pairs {
    columns: 2 22rem;
    column-gap: var(--space-5);
  }
  .pair {
    break-inside: avoid;
    padding-bottom: var(--space-3);
  }
  .pair-head {
    display: grid;
    margin: 0 0 var(--space-1);
    line-height: 1.3;
  }
  /* Each recipe's color (as in Water usage over time): a swatch at its name, an underline under its ratings. */
  .swatch {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    margin-right: 0.3rem;
    border-radius: 2px;
    background: var(--ca);
  }
  .swatch.b {
    background: var(--cb);
  }
  .score.a {
    text-decoration: underline 3px var(--ca);
    text-underline-offset: 3px;
  }
  .score.b {
    text-decoration: underline 3px var(--cb);
    text-underline-offset: 3px;
  }
  .pair-sum {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .pair-bags {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pair-bags li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 2.5rem 0.5rem 2.5rem;
    align-items: baseline;
    gap: var(--space-1);
    min-height: 2rem;
    padding: 0.3rem 0;
    border-top: 1px solid var(--color-border);
    font-size: 0.85rem;
  }
  .pair-more {
    padding-inline: var(--space-2);
    font-size: 0.8rem;
  }
  @media (min-width: 641px) {
    .pair-more {
      min-height: 2rem;
    }
  }
  .bag {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bag a {
    color: inherit;
    text-decoration: none;
  }
  @media (hover: hover) {
    .bag a:hover {
      text-decoration: underline;
    }
  }
  .bag small {
    color: var(--color-text-muted);
  }
  .score {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .score.win {
    font-weight: 700;
  }
  .sep {
    text-align: center;
    color: var(--color-text-muted);
  }
</style>
