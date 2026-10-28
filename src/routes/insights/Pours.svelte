<script lang="ts" module>
  import type { PoursTab } from '$lib/server/insights/pours';
  import type { JumpLink } from './JumpNav.svelte';
  export function jumpLinks(t: PoursTab | null): JumpLink[] {
    if (!t) return [];
    return [
      t.recipes.length && ['pours-recipes', 'Recipe report card'],
      (t.technique.length || t.agitationByProcess || t.words.length) && ['pours-technique', 'Technique'],
      (Object.values(t.recipeBy).some(Boolean) || Object.values(t.recipeMeans).some(Boolean)) && ['pours-recipe-coffee', 'Recipe × coffee'],
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
  import { labelTip } from '$lib/components/labelTip';
  import { assignCols, sortAgitation, sortContact } from './pourCols';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { deltaInk, labDelta, signed } from '$lib/components/deltaColor';
  import { SAMPLE_HELP, TIP_TITLE, sampleField } from '$lib/sample';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import { insightsParams, type InsightsView, type InsightsUrlState } from '$lib/insightsUrl';
  import type { Breakdown } from '$lib/server/insights/lab';
  import { useEmptyLine } from './coffeeNote';
  import DeltaBars, { bandRows, plural, SAME_BAG_HELP } from './DeltaBars.svelte';
  import LabHead from './LabHead.svelte';
  import LabHeatmap from './LabHeatmap.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';

  let { t, s, explicit, placeTip, choose }: {
    t: PoursTab | null; s: InsightsView; explicit: InsightsUrlState; placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();
  const emptyLine = useEmptyLine();

  // An ellipsized name shows its full text in the shared tip on hover and focus (ui-rules 36, 39: no native title); only
  // while it is actually cut, and then it is a tab stop (a link already is one).
  function cutTip(node: HTMLElement, text: string) {  // `text` is kept current by update()
    let tip: ReturnType<typeof labelTip> | null = null;
    const sync = () => {
      const cut = node.scrollWidth > node.clientWidth + 1;
      if (cut && !tip) {
        if (!node.matches('a')) node.tabIndex = 0;
        tip = labelTip(node, text);
      } else if (!cut && tip) {
        tip.destroy();
        tip = null;
        if (!node.matches('a')) node.removeAttribute('tabindex');
        node.style.cursor = '';
      }
    };
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    sync();
    return { update: (t: string) => { text = t; tip?.update(t); sync(); }, destroy: () => (ro.disconnect(), tip?.destroy()) };
  }

  const COUNTS_TIP = { title: 'Logged and matched', lines: ['Logged: the brew\'s note names the recipe.', 'Matched: the site recognized the recipe from the brew\'s pour reading, including modified (the pour pattern and ratio agree, but something like pour count or bloom time differs).'] };

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
  type Card = { id: string; title: string; help: string[]; bd?: Breakdown; bars?: PoursTab['technique'][number]; split?: boolean };
  let cards = $derived.by((): Card[] => {
    if (!t) return [];
    const out: Card[] = t.technique.map((x) => ({ ...TECH[x.key], bars: x }));
    if (t.agitationByProcess) out.splice(1, 0, { id: 'pours-agitation-process', title: 'Agitation by process', help: ['The same delta, per process.'], bd: t.agitationByProcess });
    // Pouring vs drawdown time: its own card after Contact time, on the same band labels.
    const at = out.findIndex((c) => c.id === 'pours-contact');
    if (at >= 0 && t.split.length) out.splice(at + 1, 0, { id: 'pours-split', title: 'Pouring vs drawdown', help: ['Mean pouring time and drawdown time of the brews in each contact band.', 'Pouring: first pour to the last.', 'Drawdown: the last pour to the end.'], split: true });
    return out;
  });
  // Two columns of cards at the same top and (about) the same bottom: assigned by height (estimated at first, then the
  // measured natural heights), and the shorter column's bars stretch a little (balance, capped 1.3x). On one column
  // (narrow) the cards keep reading order (their order index).
  let heights = $state<Record<string, number>>({});
  const est = (c: Card) => c.bd ? 150 + 36 * c.bd.rows.length : c.split ? 110 + 32 * (t?.split.length ?? 0) : 110 + 32 * (c.bars?.bands.length ?? 0) + (c.bars?.inferred ? 30 : 0);
  let cols = $derived(assignCols(cards.map((c) => c.id), (id) => heights[id] ?? est(cards.find((c) => c.id === id)!)));
  const order = (id: string) => cards.findIndex((c) => c.id === id);
  function balance(node: HTMLElement, _deps: unknown) {
    let raf = 0, w = -1;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const els = [...node.querySelectorAll<HTMLElement>('[data-card]')];
        for (const c of els) (c.style.removeProperty('--bar-rows'), c.style.removeProperty('--split-row'));
        const nat = Object.fromEntries(els.map((c) => [c.dataset.card!, Math.round(c.offsetHeight)]));
        if (els.some((c) => heights[c.dataset.card!] !== nat[c.dataset.card!])) return void (heights = nat); // reassign; update() runs again
        const cs = [...node.querySelectorAll<HTMLElement>('.col')];
        if (cs.length !== 2 || getComputedStyle(cs[0]).display === 'contents') return;
        const hs = cs.map((c) => c.getBoundingClientRect().height);
        const rows = [...cs[hs[0] < hs[1] ? 0 : 1].querySelectorAll<HTMLElement>('[data-stretch]')].map((c) => ({ c, rs: [...c.querySelectorAll<HTMLElement>('.bar-row, .split li')] })).filter((x) => x.rs.length);
        const total = rows.reduce((n, x) => n + x.rs.reduce((m, r) => m + r.offsetHeight, 0), 0);
        if (!total) return;
        const k = Math.min(1.3, 1 + Math.abs(hs[0] - hs[1]) / total);
        for (const { c, rs } of rows) c.style.setProperty(c.dataset.stretch === 'split' ? '--split-row' : '--bar-rows', `${rs[0].offsetHeight * k}px`);
      });
    };
    const ro = new ResizeObserver(() => { if (node.clientWidth !== w) { w = node.clientWidth; run(); } }); // width only: a stretch changes heights
    ro.observe(node);
    run();
    return { update: run, destroy: () => (ro.disconnect(), cancelAnimationFrame(raf)) };
  }
  // A bar's tip gains how many of its brews had their agitation guessed (the label stays the band's name).
  const techRows = (x: PoursTab['technique'][number]) => bandRows(x.bands, undefined, 'band').map((r, j) => {
    const n = x.inferred?.[x.bands[j].label] ?? 0;
    return n ? { ...r, tip: { ...r.tip, rows: [...(r.tip.rows ?? []), ['Guessed from pour speed', `${n} of ${x.bands[j].plainBrews}`] as [string, string]] } } : r;
  });
  const wordCols = (key: 'byAgitation' | 'byContact') => (key === 'byAgitation' ? sortAgitation : sortContact)((t?.words ?? []).flatMap((w) => w[key].map((x) => x.label)));
  const maxShare = $derived(Math.max(0.01, ...(t?.words ?? []).flatMap((w) => [...w.byAgitation, ...w.byContact].map((x) => x.share))));
  const maxSplit = $derived(Math.max(1, ...(t?.split ?? []).map((x) => x.pourS + x.drawdownS)));
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

  // Recipe × coffee, rest
  const BY = [['roast', 'Roast level'], ['process', 'Process'], ['roaster', 'Roaster']] as const;
  let by = $derived<'roast' | 'process' | 'roaster'>(s.recipeBy ?? 'roast');
  let byLabel = $derived(BY.find(([k]) => k === by)![1].toLowerCase());
  // Recipe × coffee's comparison: the same bags (a paired delta), the rest of the row, the same recipe elsewhere, or the plain average.
  const VS = [['same', 'Same bags'], ['group', 'Same roaster'], ['recipe', 'Same recipe'], ['avg', 'Average']] as const;
  let vsMode = $derived<'same' | 'group' | 'recipe' | 'avg'>(s.recipeVs ?? 'same');
  const VS_TEXT = {
    same: { help: RECIPE_HELP, vs: 'same bag', scale: ["Below the bag's average", 'Above'] as [string, string] },
    group: { help: "Each cell's average rating minus the average of every other brew in its row, on any bag.", vs: 'the rest of its row', scale: ['Below the rest of its row', 'Above'] as [string, string] },
    recipe: { help: "Each cell's average rating minus the same recipe's average in the other rows.", vs: 'the recipe in other rows', scale: ['Below the recipe elsewhere', 'Above'] as [string, string] },
    avg: { help: "Each cell's average rating against your average for these brews.", vs: 'your average', scale: ['Below your average', 'Above'] as [string, string] }
  };
  let grid = $derived(t?.recipeMeans[by] ?? null);
  // "Same roaster" / "Same recipe" as a Breakdown for the shared heatmap; a cell with brews always has its counts in the tip.
  let vsBd = $derived.by((): Breakdown | null => {
    if (!grid || (vsMode !== 'group' && vsMode !== 'recipe')) return null;
    const key = vsMode === 'group' ? 'vsGroup' : 'vsRecipe';
    return { rows: grid.rows, cols: grid.cols, cells: grid.cells.map((row) => row.map((c) => c && ({ delta: c[key], solid: !c.sample.small, sample: c.sample, brews: c.brews, bags: c.bags, ...(c[key] === null ? { plain: { brews: c.brews, bags: c.bags } } : {}) }))) };
  });
  const overall = $derived(t?.overallMean ?? null);
  const avgTip = (r: number, c: number): Tip => {
    const cell = grid!.cells[r][c], title = `${grid!.rows[r]} · ${grid!.cols[c]}`;
    return cell ? { title, rows: [['Average rating', cell.mean.toFixed(1)], ['vs your average', signed(cell.vsAll, 1), deltaInk(cell.vsAll)], ['Brews', `${cell.brews}`], ['Bags', `${cell.bags}`]] as Tip['rows'], ...sampleField(cell.sample) } : { title, note: 'No brews.' };
  };
  let thinRest = $derived(!!t && [t.rest.byRecipe, t.rest.byAgitation].some((bd) => bd && !bd.rows.some((r, i) => FRESH.includes(r) && bd.cells[i].some((c) => c && c.delta !== null && !c.sample.small))));
</script>

{#snippet ratingsNote()}
  {#if t?.hiddenByRatings.length}
    <p class="chart-note">Calibrated ratings leave out {names(t.hiddenByRatings)}. <a href={allRatings} onclick={(e) => { e.preventDefault(); choose({ ratings: 'all' }); }}>See all ratings</a></p>
  {/if}
{/snippet}
{#if !t || !(t.recipes.length || cards.length || t.words.length || Object.values(t.recipeBy).some(Boolean) || Object.values(t.recipeMeans).some(Boolean) || t.rest.byRecipe || t.rest.byAgitation)}
  <section class="chart-panel">
    <p class="hl-empty">{emptyLine('No rated brews with pour readings in this period.')}</p>
    {@render ratingsNote()}
    {#if page.data.isAdmin}<p class="chart-note empty-link"><a href="/account/recipes">Set up recipes</a></p>{/if}
  </section>
{:else}
  {#if t.recipes.length}
    <section class="chart-panel" data-section="pours-recipes">
      <LabHead id="pours-recipes" title="Recipe report card" {placeTip} help={[RECIPE_HELP, ...SAME_BAG_HELP.slice(1)]} />
      <ul class="card" aria-label="Recipes">
        {#each shown as r (r.id ?? r.name)}
          {@const d = r.stat?.delta ?? null}
          <li>
            <span class="name">
              {#if page.data.isAdmin && r.id !== null}<a class="nm" href="/account/recipes?brews=r{r.id}" use:cutTip={r.name}>{r.name}</a>{:else}<span class="nm" use:cutTip={r.name}>{r.name}</span>{/if}
              {#if r.dripper}<span class="sub" use:cutTip={r.dripper}>{r.dripper}</span>{:else}<span class="sub"></span>{/if}
            </span>
            <span class="num">{plural(r.rated, 'rated brew')}</span>
            <span class="delta {deltaInk(d)}" class:small-sample={r.stat?.sample.small ?? r.sample.small}>{d === null ? 'no match' : labDelta(d, ses)}</span>
            <span class="mark">{#if r.stat?.sample.small || (d === null && r.sample.small)}<SampleNote icon s={r.stat && d !== null ? r.stat.sample : r.sample} paired={d !== null} />{/if}</span>
            <span class="best">
              {#each [r.best.roast, r.best.process].filter((b) => b !== null) as b, i}{i ? ' · ' : 'Best: '}<span class:small-sample={b.small}>{b.label} {signed(b.delta, 1)} ({plural(b.brews, 'brew')})</span>{/each}
            </span>
            {#if r.trend.length > 1}
              {@const sp = spark(r.trend.map((x) => x.value))}
              <svg class="spark" viewBox="0 0 80 24" role="img" aria-label="Trend by month: {r.trend.map((x) => `${x.label} ${signed(x.value)}`).join(', ')}">
                <line x1="2" x2="78" y1={sp.zero} y2={sp.zero} /><polyline points={sp.pts} />
              </svg>
            {:else}<span class="spark"></span>{/if}
            <span class="counts">{#if r.id !== null}<span use:labelTip={COUNTS_TIP}>{r.logged} logged · {r.matched + r.modified} matched</span>{/if}</span>
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
      <div class="tech-cols" use:balance={cols}>
        {#each cols as col, ci (ci)}
          <div class="col">
            {#each col as id (id)}
              {@const c = cards.find((x) => x.id === id)!}
              <section class="chart-panel" data-section={c.id} data-card={c.id} data-stretch={c.split ? 'split' : c.bars ? 'bars' : undefined} style:order={order(id)}>
                <LabHead id={c.id} title={c.title} level={3} {placeTip} help={[...c.help, ...(c.split ? [] : SAME_BAG_HELP)]} />
                {#if c.bd}
                  <LabHeatmap by={c.bd} ariaLabel="{c.title}: rating vs the same bag's other brews" />
                {:else if c.split}
                  <ul class="split" aria-label="Pouring and drawdown time by contact band">
                    {#each t.split as g (g.label)}
                      <li><span class="k">{g.label}</span>
                        <span class="track"><span class="pour" style:width="{(100 * g.pourS) / maxSplit}%"></span><span class="draw" style:width="{(100 * g.drawdownS) / maxSplit}%"></span></span>
                        <span class="v">{clock(g.pourS)} + {clock(g.drawdownS)}</span></li>
                    {/each}
                  </ul>
                  <p class="chart-note"><i class="sw pour"></i>Pouring <i class="sw draw"></i>Drawdown, mean time per contact band</p>
                {:else if c.bars}
                  <DeltaBars ariaLabel="{c.title} vs rating" rows={techRows(c.bars)} />
                  {#if c.bars.inferred && Object.values(c.bars.inferred).some(Boolean)}<p class="chart-note">Agitation a recipe or note doesn't set is guessed from pour speed; a bar's tip says how many.</p>{/if}
                {/if}
              </section>
            {/each}
          </div>
        {/each}
      </div>
      {#if t.words.length}
        <section class="chart-panel words" data-section="pours-words">
          <LabHead id="pours-words" title="Words in brew notes" level={3} {placeTip}
            help={['The share of brews in each band whose notes mention the word.', 'Bands under 10 brews are left out.', SAMPLE_HELP]} />
          {#each [['By agitation', 'byAgitation'], ['By contact time', 'byContact']] as const as [what, key] (key)}
            {@const cols = wordCols(key)}
            {#if cols.length}
              <div class="wscroll">
                <table>
                  <caption>{what}</caption>
                  <thead><tr><th scope="col">Word</th>{#each cols as c (c)}<th scope="col">{c}</th>{/each}</tr></thead>
                  <tbody>
                    {#each t.words as w (w.label)}
                      <tr>
                        <th scope="row"><strong>{w.label}</strong> <span class="sub">{plural(w.brews, 'brew')} · {plural(w.bags, 'bag')}</span>{#if w.sample.small}<SampleNote icon s={w.sample} />{/if}</th>
                        {#each cols as c (c)}
                          {@const x = w[key].find((y) => y.label === c)}
                          <td style:background={x ? `color-mix(in srgb, var(--chart-color-1) ${Math.round(Math.min(1, x.share / maxShare) * 45)}%, transparent)` : undefined}>{x ? `${Math.round(100 * x.share)}%` : '–'}</td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          {/each}
        </section>
      {/if}
    </section>
  {/if}

  {#if Object.values(t.recipeBy).some(Boolean) || Object.values(t.recipeMeans).some(Boolean)}
    <section class="chart-panel" data-section="pours-recipe-coffee">
      <LabHead id="pours-recipe-coffee" title="Recipe × coffee" {placeTip} help={[vsMode === 'avg' && overall !== null ? `Each cell's average rating against your average of ${overall.toFixed(1)} for these brews.` : VS_TEXT[vsMode].help, ...(vsMode === 'avg' ? ['It reflects which coffees you used the recipe on, so it is not a ranking of recipes.'] : []), 'Rows: the coffees, grouped.', ...(vsMode === 'same' ? ['Blank: no brews, or no match.', 'No match: no bag has 2+ brews of another recipe; the tip shows the cell\'s own brews.'] : []), SAMPLE_HELP]}>
        <div class="form-field group-field">
          <span>Group by</span>
          <div class="tab-group tab-group-compact" role="group" aria-label="Group by">
            {#each BY as [k, name] (k)}<button aria-pressed={by === k} onclick={() => choose({ recipeBy: k === 'roast' ? undefined : k })}>{name}</button>{/each}
          </div>
        </div>
        <div class="form-field group-field">
          <span>Compare with</span>
          <div class="tab-group tab-group-compact" role="group" aria-label="Compare with">
            {#each VS as [k, name] (k)}<button aria-pressed={vsMode === k} onclick={() => choose({ recipeVs: k === 'same' ? undefined : k })}>{name}</button>{/each}
          </div>
        </div>
      </LabHead>
      {#if vsMode === 'same' && t.recipeBy[by]}
        <LabHeatmap by={t.recipeBy[by]!} noun="recipe" ariaLabel="Recipe by {byLabel}: rating vs the same bag's other brews" />
      {:else if vsBd}
        <LabHeatmap by={vsBd} noun="recipe" vs={VS_TEXT[vsMode].vs} scale={VS_TEXT[vsMode].scale} ariaLabel="Recipe by {byLabel}: rating vs {VS_TEXT[vsMode].vs}" />
      {:else if vsMode === 'avg' && grid}
        <Heatmap diverging rows={grid.rows} cols={grid.cols} cells={grid.cells.map((r) => r.map((c) => c?.vsAll ?? null))}
          small={grid.cells.map((r) => r.map((c) => !!c && c.sample.small))} scale={VS_TEXT.avg.scale}
          text={(v, r, c) => { const cell = grid!.cells[r][c]; return v === null || !cell ? 'No brews' : `${cell.mean.toFixed(1)}, ${signed(v, 1)} vs your average${cell.sample.small ? ` (${TIP_TITLE})` : ''}`; }}
          label={(r, c) => `${grid!.rows[r]} · ${grid!.cols[c]}`} tip={avgTip} ariaLabel="Recipe by {byLabel}: average rating" />
      {:else}
        <p class="hl-empty">No {byLabel} has 3+ bags {vsMode === 'same' ? 'with paired brews' : 'brewed with a recipe'} here.</p>
      {/if}
    </section>
  {/if}

  {#if t.rest.byRecipe || t.rest.byAgitation}
    <section class="pours-rest" data-section="pours-rest-age">
      {#each [['pours-rest', 'Rest age by recipe', t.rest.byRecipe], ['pours-rest-agitation', 'Rest age by agitation', t.rest.byAgitation]] as const as [id, title, bd] (id)}
        {#if bd}
          <section class="chart-panel" data-section={id}>
            <LabHead {id} {title} {placeTip} help={['Days off roast at the brew.', RECIPE_HELP, SAMPLE_HELP]} />
            <LabHeatmap by={bd} ariaLabel="{title}: rating vs the same bag's other brews" />
          </section>
        {/if}
      {/each}
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
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
    font-variant-numeric: tabular-nums;
  }
  .card li:first-child {
    border-top: 0;
  }
  /* The name and its dripper are two lines, each one line (never wrapped mid-phrase). */
  .name {
    flex: 1 1 8rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .nm,
  .sub {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nm {
    font-weight: 600;
  }
  .sub {
    min-height: 1.2em;
  }
  .sub,
  .counts,
  .num {
    font-weight: 400;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  /* Fixed-width cells (the marker's included, empty or not): every row's columns line up. */
  .num {
    width: 6.75rem;
    white-space: nowrap;
  }
  .delta {
    font-weight: 600;
    width: 3.5rem;
  }
  .mark {
    width: 1.5rem;
    display: flex;
    justify-content: center;
  }
  .counts {
    width: 9.5rem;
    white-space: nowrap;
    text-align: right;
  }
  .best {
    flex: 3 1 12rem;
    font-size: 0.875rem;
  }
  /* One Best item never splits ("Light +0.4 (8 brews)"): a narrow row wraps between items. */
  .best > span {
    white-space: nowrap;
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
  /* Phones: the name takes a line, the numbers a line, Best a line, the trend and counts a line. */
  @media (max-width: 640px) {
    .name,
    .best {
      flex: 1 1 100%;
    }
    .counts {
      flex: 1 1 auto;
      width: auto;
    }
  }
  .more {
    display: flex;
    justify-content: center;
    padding-top: var(--space-2);
  }
  .more button {
    margin: 0;
  }
  .empty-link {
    text-align: center;
  }
  .pours-technique {
    margin-bottom: var(--space-5);
  }
  /* Cards at their own height, two balanced columns when there is room (assignCols + balance); one column keeps reading order. */
  .tech-cols {
    --bar-label-w: 7rem;
    --bar-value-w: 7.25rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
  .col {
    display: contents;
  }
  .tech-cols section {
    margin: 0;
  }
  @container insights (min-width: 868px) {
    .tech-cols {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  }
  .words {
    margin-top: var(--space-3);
  }
  .split li {
    display: grid;
    grid-template-columns: var(--bar-label-w) minmax(0, 1fr) var(--bar-value-w);
    align-items: center;
    gap: var(--space-2);
    padding: 6px 0;
    min-height: var(--split-row, 0);
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  .split .k {
    text-align: right;
  }
  .split .track {
    display: flex;
    height: 0.75rem;
  }
  .split .pour,
  .sw.pour {
    background-color: var(--series-brown-1);
  }
  .split .draw,
  .sw.draw {
    background-color: var(--series-brown-3);
  }
  .sw {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin: 0 4px 0 8px;
  }
  .sw:first-child {
    margin-left: 0;
  }
  /* Words: a table per grouping; the row labels stay put while the bands scroll sideways on a phone. */
  .wscroll {
    overflow-x: auto;
    margin-bottom: var(--space-3);
  }
  table {
    border-collapse: collapse;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  caption {
    text-align: left;
    font-weight: 600;
    padding-bottom: var(--space-1);
  }
  th,
  td {
    padding: 6px 8px;
    text-align: center;
    white-space: nowrap;
  }
  thead th {
    font-weight: 400;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
  tbody th {
    text-align: left;
    font-weight: 400;
    position: sticky;
    left: 0;
    background: var(--color-surface, var(--color-bg, inherit));
  }
  tbody tr {
    border-top: 1px solid var(--color-border);
  }
  tbody th .sub {
    display: block;
    min-height: 0;
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
</style>
