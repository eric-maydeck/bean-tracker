<script lang="ts" module>
  import type { PoursTab } from '$lib/server/insights/pours';
  import type { JumpLink } from './JumpNav.svelte';
  export function jumpLinks(t: PoursTab | null): JumpLink[] {
    if (!t) return [];
    return [
      t.recipes.length && ['pours-recipes', 'Recipe report card'],
      (t.technique.length || t.agitationByProcess || t.words.length) && ['pours-technique', 'Technique'],
      Object.values(t.recipeBy).some(Boolean) && ['pours-recipe-coffee', 'Recipe × coffee'],
      (t.rest.byRecipe || t.rest.byAgitation) && [t.rest.byRecipe ? 'pours-rest' : 'pours-rest-agitation', 'Rest age']
    ];
  }
  const RECIPE_HELP = 'Each recipe against your other brews of the same bags: positive = it rated higher.';
  const TECH: Record<PoursTab['technique'][number]['key'], { id: string; title: string; help: string[] }> = {
    agitation: { id: 'pours-agitation', title: 'Agitation', help: ['High, Medium, Low or Mixed: set by a recipe or a note, else guessed from the pour speed.'] },
    pours: { id: 'pours-count', title: 'Pour count', help: ['The number of pours, bloom included.'] },
    swirls: { id: 'pours-swirls', title: 'Swirls', help: ['The number of swirls in the brew.'] },
    swirlAfter: { id: 'pours-swirl-after', title: 'Swirl after', help: ['Where in the brew the swirl came.', 'Rare placements are grouped as Other.'] },
    bloom: { id: 'pours-bloom', title: 'Bloom hold', help: ['Seconds between the bloom pour and the next pour, to the nearest 10.'] },
    contact: { id: 'pours-contact', title: 'Contact time', help: ['Time from the first pour to the end of the drawdown, in 30 second bands.'] },
    drawdown: { id: 'pours-drawdown', title: 'Drawdown', help: ['Time from the last pour to the end of the drawdown, in 30 second bands.'] },
    ratio: { id: 'pours-ratio', title: 'Ratio', help: ['Water to coffee, from the logged brew.'] }
  };
  // The rest bands under 31 days (WAIT_BUCKETS in server/insights/facts.ts; a server module can't be imported here).
  const FRESH = ['0–14', '15–30'];
</script>

<script lang="ts">
  import { page } from '$app/state';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { deltaColor, deltaInk, labDelta, signed } from '$lib/components/deltaColor';
  import { SAMPLE_HELP } from '$lib/sample';
  import { insightsParams, type InsightsView, type InsightsUrlState } from '$lib/insightsUrl';
  import type { Breakdown } from '$lib/server/insights/lab';
  import { useEmptyLine } from './coffeeNote';
  import DeltaBars, { bandRows, plural, SAME_BAG_HELP } from './DeltaBars.svelte';
  import { fitPairs } from './fitPairs';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';

  let { t, s, explicit, placeTip, choose }: {
    t: PoursTab | null; s: InsightsView; explicit: InsightsUrlState; placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();
  const emptyLine = useEmptyLine();

  // TEMPORARY preview variants (pv=card-b,tech-b,grid-b,rest-b); dropped after the round.
  let pv = $derived(new Set((page.url.searchParams.get('pv') ?? '').split(',')));
  const dotR = (n: number) => 6 + Math.min(10, Math.sqrt(n) * 1.6);
  const lineY = (v: number, m: number) => (60 - (v / m) * 52).toFixed(1);

  // Report card
  let open = $derived(s.pourThin === 'open');
  let solid = $derived(t?.recipes.filter((r) => !r.thin) ?? []);
  let thin = $derived(t?.recipes.filter((r) => r.thin) ?? []);
  let shown = $derived(!solid.length || open ? (t?.recipes ?? []) : solid); // nothing but thin rows: show them
  let ses = $derived((t?.recipes ?? []).flatMap((r) => (r.stat && r.stat.delta !== null ? [r.stat.se] : [])));
  const names = (xs: string[]) => (xs.length <= 3 ? xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] : `${xs.slice(0, 2).join(', ')} and ${xs.length - 2} more`);
  let allRatings = $derived(`?${insightsParams({ ...explicit, ratings: 'all' })}`);
  // A recipe's trend as a tiny polyline: the dot-less sparkline of its monthly mean same-bag delta.
  const spark = (v: number[]) => {
    const lo = Math.min(0, ...v), hi = Math.max(0, ...v), span = hi - lo || 1;
    const y = (x: number) => (22 - ((x - lo) / span) * 20).toFixed(1);
    return { pts: v.map((x, i) => `${((i / (v.length - 1)) * 76 + 2).toFixed(1)},${y(x)}`).join(' '), zero: y(0) };
  };

  // Technique
  type Card = { id: string; title: string; help: string[]; bd?: Breakdown; bars?: PoursTab['technique'][number] };
  let cards = $derived.by((): Card[] => {
    if (!t) return [];
    const out: Card[] = t.technique.map((x) => ({ ...TECH[x.key], bars: x }));
    if (t.agitationByProcess) out.splice(1, 0, { id: 'pours-agitation-process', title: 'Agitation by process', help: ['The same delta, per process.'], bd: t.agitationByProcess });
    return out;
  });
  let scale = $derived(Math.max(0.1, ...cards.flatMap((c) => c.bars?.bands.map((b) => Math.abs(b.delta ?? 0)) ?? [])));
  const likely = (x: PoursTab['technique'][number], label: string) => x.inferred?.[label] ?? 0;
  const maxSplit = $derived(Math.max(1, ...(t?.split ?? []).map((x) => x.pourS + x.drawdownS)));
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

  // Recipe × coffee, rest
  const BY = [['roast', 'Roast level'], ['process', 'Process'], ['roaster', 'Roaster']] as const;
  let by = $derived<'roast' | 'process' | 'roaster'>(s.recipeBy ?? 'roast');
  let byLabel = $derived(BY.find(([k]) => k === by)![1].toLowerCase());
  let thinRest = $derived(!!t && [t.rest.byRecipe, t.rest.byAgitation].some((bd) => bd && !bd.rows.some((r, i) => FRESH.includes(r) && bd.cells[i].some((c) => c && c.delta !== null && !c.sample.small))));
</script>

{#snippet ratingsNote()}
  {#if t?.hiddenByRatings.length}
    <p class="chart-note">Calibrated ratings leave out {names(t.hiddenByRatings)}. <a href={allRatings} onclick={(e) => { e.preventDefault(); choose({ ratings: 'all' }); }}>See all ratings</a></p>
  {/if}
{/snippet}
{#if !t || !(t.recipes.length || t.technique.length || t.words.length)}
  <section class="chart-panel">
    <p class="hl-empty">{emptyLine('No rated brews with pour readings in this period.')}</p>
    {@render ratingsNote()}
    {#if page.data.isAdmin}<p class="chart-note"><a href="/account/recipes">Set up recipes</a></p>{/if}
  </section>
{:else}
  {#if t.recipes.length}
    <section class="chart-panel" data-section="pours-recipes">
      <LabHead id="pours-recipes" title="Recipe report card" {placeTip} help={[RECIPE_HELP, ...SAME_BAG_HELP.slice(1)]} />
      <ul class="card" class:stack={pv.has('card-b')} aria-label="Recipes">
        {#each shown as r (r.id ?? r.name)}
          {@const d = r.stat?.delta ?? null}
          <li>
            <span class="name">
              {#if page.data.isAdmin && r.id !== null}<a href="/account/recipes?brews=r{r.id}">{r.name}</a>{:else}{r.name}{/if}
              {#if r.dripper}<span class="sub">{r.dripper}</span>{/if}
            </span>
            <span class="num">{plural(r.rated, 'rated brew')}</span>
            <span class="delta {deltaInk(d)}" class:small-sample={r.stat?.sample.small ?? r.sample.small}>{d === null ? 'no match' : labDelta(d, ses)}</span>
            {#if r.stat?.sample.small || (d === null && r.sample.small)}<SampleNote s={r.stat && d !== null ? r.stat.sample : r.sample} paired={d !== null} />{/if}
            <span class="best">
              {#each [r.best.roast, r.best.process].filter((b) => b !== null) as b, i}{i ? ' · ' : 'Best: '}<span class:small-sample={b.small}>{b.label} {signed(b.delta, 1)} ({plural(b.brews, 'brew')})</span>{/each}
            </span>
            {#if r.trend.length > 1}
              {@const sp = spark(r.trend.map((x) => x.value))}
              <svg class="spark" viewBox="0 0 80 24" role="img" aria-label="Trend by month: {r.trend.map((x) => `${x.label} ${signed(x.value)}`).join(', ')}">
                <line x1="2" x2="78" y1={sp.zero} y2={sp.zero} /><polyline points={sp.pts} />
              </svg>
            {/if}
            <span class="counts">{r.logged} logged · {r.matched + r.modified} matched</span>
          </li>
        {/each}
      </ul>
      {#if solid.length && thin.length}
        <div class="more"><button class="button button-ghost" onclick={() => choose({ pourThin: open ? undefined : 'open' })}>{open ? 'Show fewer' : `Show ${thin.length} more with few brews`}</button></div>
      {/if}
      {#if t.noFlow > 0}<p class="chart-note">{t.noFlow} rated {t.noFlow === 1 ? 'brew has' : 'brews have'} no flow data and {t.noFlow === 1 ? 'is' : 'are'} left out.</p>{/if}
      {@render ratingsNote()}
    </section>
  {/if}

  {#if cards.length || t.words.length}
    <section class="pours-technique" data-section="pours-technique">
      <LabHead id="pours-technique" title="Technique" {placeTip} help={[...SAME_BAG_HELP, 'Brews without a flow reading still set their bag\'s average.']} />
      {#if pv.has('tech-b')}
        <div class="mini-grid">
          {#each cards as c (c.id)}
            <section class="chart-panel mini" data-section={c.id}>
              <LabHead id={c.id} title={c.title} level={3} {placeTip} help={[...c.help, ...SAME_BAG_HELP]} />
              {#if c.bd}
                <LabHeatmap by={c.bd} ariaLabel="{c.title}: rating vs the same bag's other brews" />
              {:else if c.bars}
                <div class="cols" role="img" aria-label="{c.title}: {c.bars.bands.map((b) => `${b.label} ${signed(b.delta ?? 0)}`).join(', ')}">
                  {#each c.bars.bands as b (b.label)}
                    <div class="col" title="{b.label}: {signed(b.delta ?? 0)} ({b.brews} brews)">
                      <span class="half up">{#if (b.delta ?? 0) > 0}<span class="m bar" class:small-sample-mark={b.sample.small} style:height="{(100 * (b.delta ?? 0)) / scale}%"></span>{/if}</span>
                      <span class="half dn">{#if (b.delta ?? 0) < 0}<span class="m bar neg" class:small-sample-mark={b.sample.small} style:height="{(100 * -(b.delta ?? 0)) / scale}%"></span>{/if}</span>
                      <span class="v {deltaInk(b.delta)}">{signed(b.delta ?? 0, 1)}</span>
                      <span class="l">{b.label}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      {:else}
      <div class="lab-grid" use:fitPairs={[t, s]}>
        {#each cards as c, i (c.id)}
          <section class="chart-panel lab-chart" class:span={cards.length % 2 === 1 && i === cards.length - 1} data-section={c.id}>
            <LabHead id={c.id} title={c.title} level={3} {placeTip} help={[...c.help, ...SAME_BAG_HELP]} />
            <div class="fit-body">
              {#if c.bd}
                <LabHeatmap by={c.bd} ariaLabel="{c.title}: rating vs the same bag's other brews" />
              {:else if c.bars}
                {@const x = c.bars}
                <DeltaBars ariaLabel="{c.title} vs rating"
                  rows={bandRows(x.bands, undefined, 'band').map((r, j) => (likely(x, x.bands[j].label) ? { ...r, label: `${r.label} · ${likely(x, x.bands[j].label)} likely` } : r))} />
                {#if c.id === 'pours-contact' && t.split.length}
                  <ul class="split" aria-label="Pouring and drawdown time by contact band">
                    {#each t.split as g (g.label)}
                      <li><span class="k">{g.label}</span>
                        <span class="track"><span class="pour" style:width="{(100 * g.pourS) / maxSplit}%"></span><span class="draw" style:width="{(100 * g.drawdownS) / maxSplit}%"></span></span>
                        <span class="v">{clock(g.pourS)} + {clock(g.drawdownS)}</span></li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </div>
            {#if c.bars?.inferred && Object.values(c.bars.inferred).some(Boolean)}<p class="chart-note">likely = guessed from pour speed</p>{/if}
            {#if c.id === 'pours-contact' && t.split.length}<p class="chart-note">Bars: pouring time + drawdown time</p>{/if}
          </section>
        {/each}
      </div>
      {/if}
      {#if t.words.length}
        <section class="chart-panel words" data-section="pours-words">
          <LabHead id="pours-words" title="Words in brew notes" level={3} {placeTip}
            help={['The share of brews in each band whose notes mention the word.', 'Bands under 10 brews are left out.', SAMPLE_HELP]} />
          <ul>
            {#each t.words as w (w.label)}
              <li>
                <span class="w"><strong>{w.label}</strong> {plural(w.brews, 'brew')}, {plural(w.bags, 'bag')}{#if w.sample.small}<SampleNote s={w.sample} />{/if}</span>
                {#each [['Agitation', w.byAgitation], ['Contact', w.byContact]] as const as [what, xs] (what)}
                  {#if xs.length}<span class="shares"><span class="what">{what}</span>{#each xs as x (x.label)}<span class="chip" title={plural(x.brews, 'brew')}>{x.label} {Math.round(100 * x.share)}%</span>{/each}</span>{/if}
                {/each}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </section>
  {/if}

  {#if Object.values(t.recipeBy).some(Boolean)}
    <section class="chart-panel" data-section="pours-recipe-coffee">
      <LabHead id="pours-recipe-coffee" title="Recipe × coffee" {placeTip} help={[RECIPE_HELP, 'Rows: the coffees, grouped; blank: no match.', SAMPLE_HELP]}>
        <div class="tab-group tab-group-compact" role="group" aria-label="Group by">
          {#each BY as [k, name] (k)}<button aria-pressed={by === k} onclick={() => choose({ recipeBy: k === 'roast' ? undefined : k })}>{name}</button>{/each}
        </div>
      </LabHead>
      {#if t.recipeBy[by] && pv.has('grid-b')}
        {@const bd = t.recipeBy[by]!}
        <div class="dots-wrap"><div class="dots" style:--n={bd.cols.length} role="img" aria-label="Recipe by {byLabel}: dot per cell, color = delta, size = brews">
          <span></span>{#each bd.cols as c (c)}<span class="ch">{c}</span>{/each}
          {#each bd.rows as r, i (r)}
            <span class="rh">{r}</span>
            {#each bd.cols as c, j (c)}
              {@const cell = bd.cells[i][j]}
              <span class="cell" title="{r} · {c}: {cell && cell.delta !== null ? signed(cell.delta) : 'no match'}">
                {#if cell && cell.delta !== null}<span class="dot" class:thin={cell.sample.small} style:width="{2 * dotR(cell.brews)}px" style:height="{2 * dotR(cell.brews)}px" style:background={deltaColor(cell.delta)}></span><span class="dv">{signed(cell.delta, 1)}</span>{:else}<span class="dv">–</span>{/if}
              </span>
            {/each}
          {/each}
        </div></div>
      {:else if t.recipeBy[by]}
        <LabHeatmap by={t.recipeBy[by]!} ariaLabel="Recipe by {byLabel}: rating vs the same bag's other brews" />
      {:else}
        <p class="hl-empty">No {byLabel} has 3+ bags with paired brews here.</p>
      {/if}
    </section>
  {/if}

  {#if t.rest.byRecipe || t.rest.byAgitation}
    <section class="pours-rest" data-section="pours-rest-age">
      <div class="lab-grid" use:fitPairs={[t, s]}>
        {#each [['pours-rest', 'Rest age by recipe', t.rest.byRecipe], ['pours-rest-agitation', 'Rest age by agitation', t.rest.byAgitation]] as const as [id, title, bd] (id)}
          {#if bd}
            <section class="chart-panel lab-chart" class:span={!(t.rest.byRecipe && t.rest.byAgitation)} data-section={id}>
              <LabHead {id} {title} {placeTip} help={['Days off roast at the brew.', RECIPE_HELP, SAMPLE_HELP]} />
              {#if pv.has('rest-b')}
                {@const m = Math.max(0.1, ...bd.cells.flat().map((c) => Math.abs(c?.delta ?? 0)))}
                <div class="fit-body">
                  <svg class="lines" viewBox="0 0 300 120" role="img" aria-label="{title}: delta by rest band, a line per series">
                    <line x1="0" x2="300" y1="60" y2="60" />
                    {#each bd.cols as c, j (c)}
                      {@const pts = bd.rows.map((_, i) => [bd.rows.length > 1 ? 20 + (i / (bd.rows.length - 1)) * 260 : 150, bd.cells[i][j]?.delta ?? null, bd.cells[i][j]?.sample.small] as const)}
                      <polyline points={pts.filter((q) => q[1] !== null).map((q) => `${q[0]},${lineY(q[1]!, m)}`).join(' ')} style:stroke="var(--series-{j + 1}-ink, var(--series-{j + 1}))" />
                      {#each pts as q (q[0])}{#if q[1] !== null}<circle cx={q[0]} cy={lineY(q[1], m)} r="4" class:hollow={q[2]} style:stroke="var(--series-{j + 1}-ink, var(--series-{j + 1}))" style:fill={q[2] ? 'var(--color-surface, #fff)' : `var(--series-${j + 1}-ink, var(--series-${j + 1}))`} />{/if}{/each}
                    {/each}
                  </svg>
                  <div class="xl">{#each bd.rows as r (r)}<span>{r} d</span>{/each}</div>
                  <ul class="lg">{#each bd.cols as c, j (c)}<li><i style:background="var(--series-{j + 1}-ink, var(--series-{j + 1}))"></i>{c}</li>{/each}</ul>
                  <p class="chart-note">Same-bag delta by days off roast (±{m.toFixed(1)}); hollow = few brews</p>
                </div>
              {:else}
              <div class="fit-body"><LabHeatmap by={bd} ariaLabel="{title}: rating vs the same bag's other brews" /></div>
              {/if}
            </section>
          {/if}
        {/each}
      </div>
      {#if thinRest}<p class="chart-note">Few brews are under 31 days old, so fresh-coffee rows are thin.</p>{/if}
    </section>
  {/if}
{/if}

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .card li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    font-variant-numeric: tabular-nums;
  }
  .card li:first-child {
    border-top: 0;
  }
  .name {
    flex: 1 1 10rem;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .sub,
  .counts,
  .num {
    font-weight: 400;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  .sub::before {
    content: ' · ';
  }
  .delta {
    font-weight: 600;
    min-width: 3.5rem;
  }
  .best {
    flex: 1 1 12rem;
    font-size: 0.875rem;
  }
  .spark {
    width: 5rem;
    height: 1.5rem;
    flex: none;
  }
  .spark line {
    stroke: var(--color-border);
    stroke-width: 1;
  }
  .spark polyline {
    fill: none;
    stroke: var(--chart-color-1);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .more {
    display: flex;
    justify-content: center;
    padding-top: var(--space-2);
  }
  .more button {
    margin: 0;
  }
  .pours-technique,
  .pours-rest {
    margin-bottom: var(--space-5);
  }
  .words {
    margin-top: var(--space-3);
  }
  /* Fixed label and value columns: the 0 lines of side-by-side (and stacked) charts line up. */
  .lab-grid {
    --bar-label-w: 7rem;
    --bar-value-w: 7.25rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
  .lab-chart {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  @container insights (min-width: 868px) {
    .lab-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .lab-chart.span {
      grid-column: 1 / -1;
    }
  }
  .split {
    margin-top: var(--space-3);
    font-size: 0.875rem;
  }
  .split li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 2px 0;
  }
  .split .k {
    flex: none;
    width: 5.5rem;
  }
  .split .track {
    flex: 1;
    display: flex;
    min-width: 3rem;
    height: 0.75rem;
  }
  .split .pour {
    background-color: var(--series-brown-1);
  }
  .split .draw {
    background-color: var(--series-brown-3);
  }
  .split .v {
    flex: none;
    min-width: 6rem;
    text-align: right;
  }
  .words li {
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }
  .words li:first-child {
    border-top: 0;
  }
  .w {
    display: block;
  }
  .shares {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
    align-items: baseline;
    font-size: 0.875rem;
  }
  .what {
    color: var(--color-text-muted);
    min-width: 4.5rem;
  }
  .chip {
    white-space: nowrap;
  }
  .tab-group :global(button) {
    min-height: 2.25rem;
  }
  @media (max-width: 640px) {
    .tab-group :global(button),
    .more button {
      min-height: 44px;
    }
  }
  /* TEMPORARY variant styles */
  .card.stack {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--space-3);
  }
  .card.stack li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }
  .card.stack li:first-child {
    border-top: 1px solid var(--color-border);
  }
  .card.stack .name {
    grid-column: 1;
  }
  .card.stack .delta {
    grid-column: 2;
    grid-row: 1;
    font-size: 1.5rem;
    text-align: right;
  }
  .card.stack .best,
  .card.stack .counts,
  .card.stack .num,
  .card.stack .spark {
    grid-column: 1 / -1;
  }
  .mini-grid {
    --bar-label-w: 5rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--space-3);
  }
  .mini {
    margin: 0;
  }
  .cols {
    display: flex;
    gap: var(--space-1);
    align-items: stretch;
  }
  .col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .half {
    height: 3rem;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .half.up {
    align-items: flex-end;
    border-bottom: 1px solid var(--color-border);
  }
  .half.dn {
    align-items: flex-start;
  }
  .m {
    width: min(70%, 1.5rem);
    background-color: var(--div-high);
  }
  .m.neg {
    background-color: var(--div-low);
  }
  .col .v {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
  .col .l {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
    line-height: 1.15;
  }
  .dots-wrap {
    overflow-x: auto;
  }
  .dots {
    min-width: max-content;
    display: grid;
    grid-template-columns: minmax(4rem, 8rem) repeat(var(--n), minmax(3.25rem, 1fr));
    align-items: center;
    gap: var(--space-1);
    font-size: 0.8rem;
  }
  .dots .rh {
    position: sticky;
    left: 0;
    background: var(--color-surface, inherit);
  }
  .dots .ch {
    text-align: center;
    overflow-wrap: anywhere;
    line-height: 1.15;
  }
  .dots .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 2.75rem;
    justify-content: center;
  }
  .dots .dot {
    border-radius: 50%;
    display: block;
  }
  .dots .dot.thin {
    outline: 2px dashed var(--color-text-muted);
    outline-offset: 1px;
  }
  .dots .dv {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }
  .lines {
    width: 100%;
    height: auto;
    display: block;
  }
  .lines line {
    stroke: var(--color-border);
  }
  .lines polyline {
    fill: none;
    stroke-width: 2;
  }
  .lines circle {
    stroke-width: 2;
  }
  .xl {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0 2%;
  }
  .lg {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    font-size: 0.8rem;
    margin-top: var(--space-2);
  }
  .lg i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 4px;
  }
</style>
