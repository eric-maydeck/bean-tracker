<script lang="ts">
  import { useEmptyLine } from './coffeeNote';
  import { bottomInView } from '$lib/scrollToBottom';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import TipBody, { type Tip } from '$lib/components/TipBody.svelte';
  import type { InsightsUrlState, InsightsView } from '$lib/insightsUrl';
  import type { WaterTab } from '$lib/server/insights/lab';
  import { deltaInk, signed } from '$lib/components/deltaColor';
  import DeltaBars, { bandRows, SAME_BAG_HELP, STRENGTH_LINE } from './DeltaBars.svelte';
  import LabBoard from './LabBoard.svelte';
  import LabHead from './LabHead.svelte';
  import JumpNav from './JumpNav.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import MineralMap from './MineralMap.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { BAG_MIN_BREWS, single } from '$lib/sample';
  import ChartToggle from './ChartToggle.svelte';
  import UsageChart, { ERA_VIEW_OPTIONS } from './UsageChart.svelte';
  import { inkOf, nameColors } from './multiLine';
  import { fitPairs } from './fitPairs';

  let { t, s, placeTip, choose }: {
    t: WaterTab; s: InsightsView;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  let empty = $derived(!t.recipes.length && !t.map && !t.gh.length && !t.byRoast && !t.byProcess && !t.eras && !t.pairs.length);
  // One color per recipe for the whole tab (ui-rules 42): usage bars, pair headers, every swatch.
  let recipeColor = $derived(nameColors(t.eras?.lines.map((l) => l.label) ?? [], t.pairs));
  const colorOf = (r: string) => recipeColor.get(r) ?? 'var(--series-other)';
  // The two heatmaps share their columns (the recipes). Side by side from 1150 px only when both exist and
  // neither would scroll there: a column takes ≥ 3.25rem, so 7 recipes fit beside a roast/process label.
  // ponytail: column-count estimate, not a measurement; measure the grids if long row labels ever scroll.
  let heatPair = $derived(!!t.byRoast && !!t.byProcess && t.byRoast.cols.length <= 7);

  // W7: the pair's average gap, from A's side; "even" when it rounds to 0.
  const gap = (d: number) => (Math.abs(d) < 0.005 ? 'even' : `${signed(d)} on average`);
  // A pair is low confidence when over half its bags have a side under 4 rated brews (the single rule, the thinner side).
  const thinBags = (p: WaterTab['pairs'][number]) => p.bags.filter((b) => Math.min(b.na, b.nb) < BAG_MIN_BREWS).length;
  const thin = (p: WaterTab['pairs'][number]) => thinBags(p) * 2 > p.bags.length;
  const thinTip = (p: WaterTab['pairs'][number]): Tip => ({ title: '', caution: {
    lines: [`Small sample: in ${thinBags(p)} of ${p.bags.length} bags, one of the two waters has fewer than ${BAG_MIN_BREWS} rated brews, so a single brew can swing that bag's comparison.`],
    rows: [['Bags compared', `${p.bags.length}`], [`Under ${BAG_MIN_BREWS} rated brews on one water`, `${thinBags(p)}`]] } });
  // W7: a pair shows its 5 biggest gaps (the server sorts by |a − b|); "Show all" puts its slug in `pairs`.
  const SHOWN = 5;
  // Pair blocks flow in balanced columns (ui-rules 40); only an expanded block (Show all, a long list) spans both.
  const spans = $derived(t.pairs.map((p) => !!s.pairs?.includes(p.slug) && p.bags.length > SHOWN));
  // A truncated recipe name in a pair header: hover or focus shows it whole in the shared tip; only a truncated name is a tab stop.
  let nameTip = $state<{ el: Element; name: string } | null>(null);
  const showName = (e: Event, name: string) => {
    const el = e.currentTarget as HTMLElement, text = el.querySelector('.pair-name') as HTMLElement;
    nameTip = text.scrollWidth > text.clientWidth ? { el, name } : null;
  };
  function focusIfClipped(node: HTMLElement) {
    const text = node.querySelector('.pair-name') as HTMLElement;
    const ro = new ResizeObserver(() => {
      if (text.scrollWidth > text.clientWidth) node.tabIndex = 0;
      else node.removeAttribute('tabindex');
    });
    ro.observe(text);
    return { destroy: () => ro.disconnect() };
  }
  async function togglePair(slug: string, e: MouseEvent) {
    const open = s.pairs?.includes(slug);
    const next = open ? (s.pairs ?? []).filter((x) => x !== slug) : [...(s.pairs ?? []), slug];
    await bottomInView(e.currentTarget as HTMLElement, () => choose({ pairs: next.length ? next : undefined }));
  }
  const emptyLine = useEmptyLine();
</script>

{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No rated brews with a water recipe in this period.')}</p></section>
{:else}
  <JumpNav links={[
    t.recipes.length && ['water-recipes', 'Ratings by recipe'],
    t.gh.length && ['water-gh', 'GH vs rating'],
    t.map && ['water-minerals', 'Recipe mineral map'],
    t.byRoast && ['water-roast', 'Water × roast level'],
    t.byProcess && ['water-process', 'Water × process'],
    t.eras && ['water-eras', 'Water usage over time'],
    t.pairs.length && ['water-pairs', 'Same bag, different water']
  ]} />
  {#if t.recipes.length || t.gh.length}
    <!-- Ratings by recipe beside GH vs rating (W3): half slots, one height. -->
    <div class="insights-charts water-pair" use:fitPairs={t}>
      {#if t.recipes.length}
        <section class="chart-panel" class:span={!t.gh.length} data-section="water-recipes" style:--row-h="3rem">
          <LabHead id="water-recipes" title="Ratings by recipe" {placeTip}
            help={[...SAME_BAG_HELP, STRENGTH_LINE, 'Columns: rated brews, bags, average rating, SD; under the name, the months used.',
              'No match: never brewed on the same bag as another recipe.']} />
          <div class="fit-body"><LabBoard rows={t.recipes} noun="recipe" {placeTip} /></div>
        </section>
      {/if}
      {#if t.gh.length}
        <section class="chart-panel gh-chart" class:span={!t.recipes.length} data-section="water-gh">
          <LabHead id="water-gh" title="GH vs rating" help={["The recipe's general hardness (ppm as CaCO₃), one row per value used.", ...SAME_BAG_HELP]} {placeTip} />
          <div class="fit-body"><DeltaBars rows={bandRows(t.gh, undefined, 'hardness')} ariaLabel="GH vs rating: same-bag delta by hardness" /></div>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.map}
    <section class="chart-panel" data-section="water-minerals">
      <LabHead id="water-minerals" title="Recipe mineral map" {placeTip}
        help={['Each recipe with an entered water profile, best vs usual first, no match last.', 'vs usual: its same-bag delta, from Ratings by recipe.', 'A dash: no match.',
          'A mineral cell is shaded within its column: light = little · dark = the most any recipe used.',
          'Strongly tied to era and roast level: the water changed with time and with what you brewed.', 'Read the minerals as leads, not causes.']} />
      <MineralMap map={t.map} />
    </section>
  {/if}

  {#if t.byRoast || t.byProcess}
    <div class="heat-grid" class:paired={heatPair} use:fitPairs={[t, heatPair]}>
      {#if t.byRoast}
        <section class="chart-panel heat-panel" data-section="water-roast">
          <LabHead id="water-roast" title="Water × roast level" help={["Each recipe's same-bag delta within one roast level (rows with 3+ bags).", ...SAME_BAG_HELP, 'Blank: no match.']} {placeTip} />
          <div class="fit-body"><LabHeatmap by={t.byRoast} noun="recipe" ariaLabel="Water recipe by roast level" /></div>
        </section>
      {/if}
      {#if t.byProcess}
        <section class="chart-panel heat-panel" data-section="water-process">
          <LabHead id="water-process" title="Water × process" help={["Each recipe's same-bag delta within one process (rows with 3+ bags).", ...SAME_BAG_HELP, 'Blank: no match.']} {placeTip} />
          <div class="fit-body"><LabHeatmap by={t.byProcess} noun="recipe" ariaLabel="Water recipe by process" /></div>
        </section>
      {/if}
    </div>
  {/if}

  {#if t.eras}
    <section class="chart-panel" data-section="water-eras">
      <LabHead id="water-eras" title="Water usage over time" help={["Each recipe's share of the month's brews, rated or not.", 'Shows when you switched.', 'Bars stack to 100%; Lines draw each recipe on its own.']} {placeTip}>
        <ChartToggle label="Usage view" options={ERA_VIEW_OPTIONS} value={s.waterView ?? 'bars'} pick={(v) => choose({ waterView: v === 'lines' ? 'lines' : undefined })} />
      </LabHead>
      <UsageChart m={t.eras} view={s.waterView ?? 'bars'} colors={t.eras.lines.map((l) => colorOf(l.label))} ariaLabel="Water usage over time: each recipe's share of brews by month" />
    </section>
  {/if}

  {#if t.pairs.length}
    <section class="chart-panel" data-section="water-pairs">
      <LabHead id="water-pairs" title="Same bag, different water" {placeTip}
        help={['Every two recipes used on the same bag (2+ rated brews each), most shared bags first.', "Headline: the bags each recipe won and the average gap, from the first recipe's side.",
          'Under it: the 5 bags with the biggest gap; Show all lists every bag.', "Each bag's two average ratings; the winner's is bold and green."]} />
      <div class="pairs">
        {#each t.pairs as p, i (p.slug)}
          {@const all = !!s.pairs?.includes(p.slug)}
          <!-- Each pair is its own bordered group: a headline, then column headers naming the two recipes in their
               usage-over-time colors, then each bag's two plain ratings, the winner's bold and green. -->
          <div class="pair" class:span={spans[i]} style:--ca={colorOf(p.a)} style:--cb={colorOf(p.b)} style:--ia={inkOf(colorOf(p.a))} style:--ib={inkOf(colorOf(p.b))}>
            <h4 class="pair-title"><span class="pair-a">{p.a}</span> vs <span class="pair-b">{p.b}</span></h4>
            {#if thin(p)}<p class="pair-note"><SampleNote s={single(1)} label="Small samples" tip={thinTip(p)} /></p>{/if}
            <p class="pair-sum"
              >{p.a} won {p.won} of {p.bags.length} bag{p.bags.length === 1 ? '' : 's'}{p.tied ? ` (${p.tied} tied)` : ''} · <span
                class="delta-text {deltaInk(p.delta)}">{gap(p.delta)}</span
              ></p>
            <div class="pair-row pair-cols">
              <span class="bag-h">Bag</span>
              {#each [[p.a, 'a'], [p.b, 'b']] as [name, side] (side)}
                <!-- svelte-ignore a11y_no_static_element_interactions (a truncated name is focusable so its full text shows in the tip) -->
                <span class="pair-col {side}" use:focusIfClipped onpointerenter={(e) => e.pointerType === 'mouse' && showName(e, name)}
                  onpointerleave={() => (nameTip = null)} onfocus={(e) => showName(e, name)} onblur={() => (nameTip = null)}
                  ><span class="swatch" aria-hidden="true"></span><span class="pair-name">{name}</span></span>
              {/each}
            </div>
            <ol class="pair-bags">
              {#each all ? p.bags : p.bags.slice(0, SHOWN) as b, j (j)}
                <li class="pair-row">
                  <span class="bag">{#if b.href}<a href={b.href}><CoffeeName text={b.label} /></a>{:else}<CoffeeName text={b.label} />{/if}
{#if b.tag}<small> {b.tag}</small>{/if}</span>
                  <span class="score a" class:win={b.win === 'a'}>{b.a.toFixed(2)}</span>
                  <span class="score b" class:win={b.win === 'b'}>{b.b.toFixed(2)}</span>
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
      {#if nameTip}<FloatTip anchor={nameTip.el} onclose={() => (nameTip = null)}><TipBody tip={{ title: nameTip.name }} /></FloatTip>{/if}
    </section>
  {/if}
{/if}

<style>
  .water-pair > .chart-panel {
    display: flex;
    flex-direction: column;
  }
  /* viewport 900px (no rail; the rail narrows it) */
  @container insights (min-width: 868px) {
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
  /* viewport 1150px (no rail; the rail narrows it) */
  @container insights (min-width: 1118px) {
    .heat-grid.paired {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  /* Same bag, different water (W7): one bordered block per recipe pair, balanced over two columns when wide;
     the borders and the gap between blocks show where one pair ends and the next starts. */
  /* Balanced columns (two when two 22rem blocks fit, one on phones): no empty space beside a shorter block. */
  .pairs {
    columns: 2 22rem;
    column-gap: var(--space-4);
  }
  .pair {
    break-inside: avoid;
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3) var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .pair.span {
    column-span: all;
  }
  /* The pair's heading: "A vs B" bold, each name in its recipe's ink color (text-safe, 4.5:1). */
  .pair-title {
    margin: 0 0 var(--space-1);
    font-size: 0.95rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .pair-a {
    color: var(--ia);
  }
  .pair-b {
    color: var(--ib);
  }
  .pair-note {
    margin: 0.15rem 0 0;
  }
  .pair-sum {
    margin: 0 0 var(--space-2);
    font-size: 0.85rem;
    line-height: 1.3;
  }
  /* Bag | recipe A | recipe B: the header and every bag row share the columns. */
  .pair-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 7rem 7rem;
    align-items: baseline;
    gap: var(--space-2);
  }
  .pair-cols {
    align-items: end;
    padding-bottom: var(--space-1);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-text-muted);
  }
  /* A recipe name never wraps: one line, ellipsis (the full name is the hover/focus tip). */
  .pair-col {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    white-space: nowrap;
  }
  .pair-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 480px) {
    .pair-row {
      grid-template-columns: minmax(0, 1fr) 5.5rem 5.5rem;
    }
  }
  /* Each recipe's color (as in Water usage over time): a block before its name. */
  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    flex: none;
    margin-right: 0.3rem;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px var(--ia);
    background: var(--ca);
  }
  .pair-col.b .swatch {
    box-shadow: inset 0 0 0 1px var(--ib);
    background: var(--cb);
  }
  .pair-bags {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pair-bags li {
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
  /* The bag's winner: bold and green. */
  .score.win {
    font-weight: 700;
    color: var(--div-high-ink);
  }
</style>
