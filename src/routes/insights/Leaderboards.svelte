<script lang="ts">
  import WholeNote from './WholeNote.svelte';
  import { bottomInView } from '$lib/scrollToBottom';
  import { setting } from '$lib/settingName';
  import Usd from '$lib/components/Usd.svelte';
  import { usd, wholeUsd } from '$lib/money';
  import { useEmptyLine } from './coffeeNote';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { formatGrams } from '$lib/grams';
  import WorldMap from '$lib/components/WorldMap.svelte';
  import { BAG_MIN_BREWS, POOLED_MIN_BAGS, POOLED_MIN_BREWS, scoredLine, withinNoise } from '$lib/sample';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import { BAG_BOARDS, BOARD_NOUN, BOARD_VIEWS, LIKE_BOARDS, VIEW_BOARDS, COFFEES_AVG, DEFAULT_AVG, RANKS, boardAvg, type Avg, type Board, type BrewFilterKey, type BoardView, type BoardViews, type InsightsUrlState, type Rank } from '$lib/insightsUrl';
  import LikeLine from './LikeLine.svelte';
  import BarLabels from './BarLabels.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import type { BoardSeries } from '$lib/server/insights/leaderboards';
  import { deltaColor, deltaInk, likeGap } from '$lib/components/deltaColor';
  import type { PageData } from './$types';

  type Rows = NonNullable<PageData['boards']>;
  let {
    boards, wholeKeys, cut, rank, avg, open, views, series, roastOrder, comparing, perPerson, placeTip, choose, link, part
  }: {
    part?: 'bar'; // 'bar': only the Rank by / Score controls (rendered inside the sticky bar), else the boards
    // avg: the URL's Score; undefined = each board's default (boardAvg).
    boards: Rows; wholeKeys: BrewFilterKey[]; cut: Board[]; rank: Rank; avg: Avg | undefined; open: Board | undefined; comparing: boolean; perPerson: boolean;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
    // views: the small boards' List / Bars / Over time pick (URL); series: Over time's lines (server, only boards on it);
    // roastOrder: the roast levels lightest to darkest (Bars).
    views: BoardViews | undefined; series: Record<string, BoardSeries> | null; roastOrder: string[];
    link: (href: string) => string; // the page's Period, Ratings and Coffees filter carried onto a row's link
  } = $props();

  const TITLE: Record<Board, string> = {
    roasters: 'Roasters', coffees: 'Coffees', origins: 'Origins', process: 'Process group', roast: 'Roast level',
    water: 'Water', dripper: 'Dripper', filter: 'Filter', grinder: 'Grinder'
  };
  const RANK_LABEL: Record<Rank, string> = { rating: 'Rating', brews: 'Brews', grams: 'Grams', spend: 'Spend', ppg: '$/g', like: 'vs like coffees' };
  // Top 10 where there are many items, top 5 for small sets (spec "Boards").
  const SIZE = (b: Board) => (b === 'roasters' || b === 'coffees' || b === 'origins' ? 10 : 5);
  const BANDS: Board[][] = [['roasters', 'coffees'], ['origins'], ['process', 'roast', 'water', 'dripper', 'filter', 'grinder']];

  const VIEW_LABEL: Record<'list' | BoardView, string> = { list: 'List', bars: 'Bars', time: 'Over time' };
  const BARS = 10; // columns shown (the biggest list is 10)
  const setView = (b: Board, v: 'list' | BoardView) => {
    const next = { ...views, [b]: v === 'list' ? undefined : v };
    choose({ views: Object.values(next).some(Boolean) ? next : undefined });
  };

  const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
  // `whole`: the board's money format (ui-rules 46: one per list).
  function fmt(v: number, whole?: boolean): string {
    if (rank === 'like') return likeGap(v);
    if (rank === 'rating') return v.toFixed(1);
    if (rank === 'grams') return formatGrams(v);
    if (rank === 'spend') return usd(v, whole);
    if (rank === 'ppg') return `${usd(v, whole)}/g`;
    return perPerson && v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  }
  type Row = Rows[Board][number];
  const detail = (r: Row, costWhole?: boolean) =>
    [
      r.sub,
      ...(avg?.startsWith('best') && rank === 'rating' && r.atBest
        ? [`${plural(r.atBest, 'brew')} at ${r.best?.toFixed(1)}`, plural(r.bags, 'bag')]
        : rank === 'ppg' && r.cost !== undefined
          ? [plural(r.bags, 'bag'), usd(r.cost, costWhole), formatGrams(r.grams!)]
          : [plural(r.bags, 'bag'), r.brews ? plural(r.brews, 'brew') : null])
    ].filter(Boolean).join(' · ');
  const move = (m: Row['move']) =>
    m === undefined ? null
    : m === 'new' ? { text: 'new', cls: '', label: 'new' }
    : m > 0 ? { text: `▲${m}`, cls: 'trend-good', label: `up ${m} ${m === 1 ? 'place' : 'places'}` }
    : m < 0 ? { text: `▼${-m}`, cls: 'trend-bad', label: `down ${-m} ${m === -1 ? 'place' : 'places'}` }
    : { text: '=', cls: '', label: 'unchanged' };
  const RANK_HELP: Record<Rank, string> = {
    rating: 'Average of your ratings.',
    brews: 'Number of brews.',
    grams: 'Grams brewed.',
    spend: 'Money spent on bags bought in the period.',
    ppg: 'Price per gram of bags bought in the period.',
    like: "Rating minus similar coffees' (same roast; process, roaster and origin too when there are enough)."
  };
  const AVG_LABEL: Record<Avg, string> = {
    raw: 'Raw average', min3: 'Average (3+ bags)', k2: 'Confidence adj. (light)', adjusted: 'Confidence adj. (strong)',
    best: 'Best brew', 'best-k2': 'Best, conf. adj. (light)', 'best-k5': 'Best, conf. adj. (strong)'
  };
  const AVG_HELP: Record<Avg, string> = {
    raw: "Average of each bag's rating, all groups ranked together.",
    min3: 'Leaves out coffees with under 4 rated brews and groups under 3 bags or 10 rated brews.',
    k2: "Adjusted for confidence: pulled toward your overall average until a group has about 2 bags, a coffee about 2 brews (light).",
    adjusted: 'Adjusted for confidence: pulled strongly toward your overall average until a group has about 5 bags, a coffee about 5 brews (strong).',
    best: 'The highest single brew rating in the group.',
    'best-k2': 'Best single brew, adjusted for confidence: pulled toward your overall average until the group has hit that score about 2 times (light).',
    'best-k5': 'Best single brew, adjusted for confidence: pulled toward your overall average until the group has hit that score about 5 times (strong).'
  };
  // How scores work dialog: examples assume an overall average of 7.0 and use the real formulas.
  const HOW: { group: string; items: { id: Avg; text: string; eg: string }[] }[] = [
    { group: 'Average', items: [
      { id: 'raw', text: "The average of each bag's rating; a bag counts once, weighted by its rated brews (n/(n+2): 1 brew a third, 4 brews two thirds, 10 brews 0.83), so a sachet brewed once can't outvote a full bag.", eg: 'Bags at 9 (10 brews) and 6 (1 brew) → 8.1. A one-bag roaster at 9.5 ranks above them.' },
      { id: 'min3', text: 'The same average; rows marked Low confidence are left out: coffees with under 4 rated brews, groups under 3 bags or 10 rated brews.', eg: 'A one-bag roaster at 9.5 is not listed; a 3-bag, 12-brew roaster at 8 is.' },
      { id: 'k2', text: "Adjusted for confidence: the average pulled toward your overall average, as if every group had 2 extra bags at that average (light). A coffee (one bag) gets 2 extra brews instead, so one lucky brew can't top the board.", eg: "A roaster's one 10-brew bag at 10 → 7.9; four at 9.5 → 8.6. A coffee at 9 over 6 brews → 8.5." },
      { id: 'adjusted', text: 'The same, with 5 extra bags, or 5 extra brews for a coffee (strong): small groups stay close to your overall average.', eg: 'One 10-brew bag at 10 → 7.4; four at 9.5 → 8.0. A coffee at 9 over 6 brews → 8.1.' }
    ] },
    { group: 'Peak', items: [
      { id: 'best', text: 'The highest single brew rating in the group.', eg: 'Brews of 8, 9 and 10 → 10.' },
      { id: 'best-k2', text: 'The best brew, pulled toward your overall average as if you had 2 extra brews at that average. A score hit repeatedly counts for more than a single lucky one.', eg: 'One 10 → 8.0. Four 9.5s → 8.7.' },
      { id: 'best-k5', text: 'The same, with 5 extra brews.', eg: 'One 10 → 7.5. Four 9.5s → 8.1.' }
    ] }
  ];
  const DEFAULT_HELP = `Coffees: ${AVG_LABEL[COFFEES_AVG]}. Other boards: ${AVG_LABEL[DEFAULT_AVG]}.`;
  // A rating row's value tip: a Coffees row under k2/adjusted shows the shrunk score beside the plain average it came
  // from (2 decimals: they can round to the same 1-decimal value); a group row its score ± 1 SE (user ruling
  // 2026-10-17). null: no tip (other ranks, peak modes).
  // Either way, when dial-in brews were skipped the tip says both counts (the row shows the scored one).
  // A tip (and its dotted underline) only when it adds something the row lacks (user, 2026-10-17): both counts, a ±, or
  // a plain average that differs from the score. Raw with every brew scored, or a tip that repeats the row: none.
  const valueTip = (b: Board, r: Row): Tip | null => {
    const base = scoreTip(b, r), counts = rank === 'rating' || rank === 'like' ? scoredLine(r.sample) : null;
    return counts ? { ...(base ?? { title: r.label }), lines: [`${counts}.`] } : base;
  };
  const scoreTip = (b: Board, r: Row): Tip | null =>
    rank === 'like' ? { title: r.label, rows: [[setting(RANK_LABEL.like), likeGap(r.value), deltaInk(r.value)]] } // the signed gap, inked like the row's
    : rank !== 'rating' ? null
    : b === 'coffees' && r.mean !== undefined && r.atBest === undefined
      ? r.value.toFixed(2) === r.mean.toFixed(2) ? null // it would only repeat the row
      : { title: r.label, rows: [[setting(AVG_LABEL[boardAvg(b, avg)]), r.value.toFixed(2)], ['Plain average', r.mean.toFixed(2)]] }
    : r.se !== undefined
      ? { title: r.label, rows: [[setting(AVG_LABEL[boardAvg(b, avg)]), `${r.value.toFixed(1)} ± ${r.se.toFixed(1)}`]], note: '± is the standard error, how sure this average is. The true one is usually within it.' }
    : null;
  // Rating boards whose rows differ by less than their noise (withinNoise), named in one line under the boards.
  const noisy = $derived(rank === 'rating' ? BANDS.flat().filter((b) => withinNoise(boards[b])) : []);
  const names = (bs: Board[]) => {
    const xs = bs.map((b) => BOARD_NOUN[b]);
    const s = xs.length < 2 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
    return s[0].toUpperCase() + s.slice(1);
  };
  let help = $state<HTMLDialogElement>();
  const unranked = (b: Board) => (rank === 'spend' || rank === 'ppg') && !BAG_BOARDS.includes(b);
  const emptyText = () =>
    rank === 'spend' || rank === 'ppg' ? 'No bags bought in this period.'
    : rank === 'like' ? 'No coffees with a like group to compare in this period.' : 'No brews in this period.';
  // A board the confident cutoff emptied says what its rows lacked, not "No brews" (every other Score shows every
  // rated group, each bag weighted by its brews).
  const boardEmpty = (b: Board) =>
    cut.includes(b)
      ? `No ${BOARD_NOUN[b]} with ${b === 'coffees' ? `${BAG_MIN_BREWS}+ rated brews` : `${POOLED_MIN_BAGS}+ bags and ${POOLED_MIN_BREWS}+ rated brews`} in this period.`
      : emptyText();
  const emptyLine = useEmptyLine();
</script>

{#snippet bar()}
<div class="rank-bar">
  <div class="form-field">
    <span><button class="mode-tip-button" popovertarget="tip-rank" aria-describedby="tip-rank"><span class="tip-text">Rank by</span><Icon name="question" /></button></span>
    <select
      aria-label="Rank by"
      value={rank}
      onchange={(e) => {
        const r = e.currentTarget.value as Rank;
        const off = open && (((r === 'spend' || r === 'ppg') && !BAG_BOARDS.includes(open)) || (r === 'like' && !LIKE_BOARDS.includes(open)));
        choose({ rank: r, ...(off ? { open: undefined } : {}) });
      }}
    >
      {#each RANKS as r (r)}<option value={r} title={RANK_HELP[r]}>{RANK_LABEL[r]}</option>{/each}
    </select>
  </div>
  <div class="mode-tip" id="tip-rank" popover onbeforetoggle={placeTip}>
    <TipBody tip={{ title: 'Rank by', lines: RANKS.map((r) => `${setting(RANK_LABEL[r])}: ${RANK_HELP[r][0].toLowerCase()}${RANK_HELP[r].slice(1)}`) }} />
  </div>
  {#if rank === 'rating'}
    <div class="mode-tip" id="tip-score" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Score', lines: ['How each score is worked out.', 'Click for the full explanation.'] }} /></div>
    <div class="form-field">
      <span><button class="mode-tip-button" aria-haspopup="dialog" data-tip="tip-score" onclick={() => help?.showModal()}><span class="tip-text">Score</span><Icon name="question" /></button></span>
      <!-- Default (no avg param): each board's own Score (boardAvg); any other pick applies to every board. -->
      <select aria-label="Score" value={avg ?? ''} onchange={(e) => choose({ avg: (e.currentTarget.value || undefined) as Avg | undefined })}>
        <option value="" title={DEFAULT_HELP}>Default</option>
        <optgroup label="Average">
          {#each ['raw', 'min3', 'k2', 'adjusted'] as const as a (a)}<option value={a} title={AVG_HELP[a]}>{AVG_LABEL[a]}</option>{/each}
        </optgroup>
        <optgroup label="Peak">
          {#each ['best', 'best-k2', 'best-k5'] as const as a (a)}<option value={a} title={AVG_HELP[a]}>{AVG_LABEL[a]}</option>{/each}
        </optgroup>
      </select>
    </div>
  {/if}
</div>

<dialog
  bind:this={help}
  class="how-dialog"
  aria-labelledby="how-title"
  onclick={(e) => e.target === help && help.close()}
>
  <header>
    <h2 id="how-title">How scores work</h2>
    <button class="button button-ghost close" aria-label="Close" onclick={() => help?.close()}>×</button>
  </header>
  <div class="how-body">
    <!-- A group header like Average's and Peak's, though redundant: one design language in the tip (user, 2026-10-17). -->
    <h3>Default</h3>
    <p><b class="setting-name">Default.</b> Coffees: <span class="setting-name">{AVG_LABEL[COFFEES_AVG]}</span>. Other boards: <span class="setting-name">{AVG_LABEL[DEFAULT_AVG]}</span>.</p>
    {#each HOW as g (g.group)}
      <h3>{g.group}</h3>
      {#each g.items as it (it.id)}
        <p>
          <b class="setting-name">{AVG_LABEL[it.id]}</b>{#if it.id === COFFEES_AVG}{' '}<span class="setting-note">(default for Coffees)</span>{:else if it.id === DEFAULT_AVG}{' '}<span class="setting-note">(default for other boards)</span>{/if}.
          {it.text} <span class="eg">{it.eg}</span>
        </p>
      {/each}
    {/each}
    <p class="eg">Examples assume your overall average is 7.0.</p>
  </div>
  <footer><button class="button" onclick={() => help?.close()}>Close</button></footer>
</dialog>
{/snippet}

{#snippet board(b: Board)}
  {@const rows = boards[b]}
  {@const size = SIZE(b)}
  {@const isOpen = open === b}
  <!-- One money format per board (ui-rules 46): whole dollars for all when any amount is $1,000+. -->
  {@const whole = (rank === 'spend' || rank === 'ppg') && wholeUsd(rows.map((r) => r.value))}
  {@const costWhole = rank === 'ppg' && wholeUsd(rows.map((r) => r.cost))}
  {@const shown = isOpen ? rows : rows.slice(0, size)}
  <!-- rank=like: a zero-centred bar, scaled to the board's largest |gap| (signed values, ui gate P4). -->
  {@const span = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9)}
  {@const switchable = (VIEW_BOARDS as readonly Board[]).includes(b) && !unranked(b) && rows.length > 0}
  {@const view = switchable ? ((views as Partial<Record<Board, BoardView>> | undefined)?.[b] ?? 'list') : 'list'}
  <section class="chart-panel board" class:fill={unranked(b)} class:open={isOpen} class:wide={view === 'time'} id="leaderboard-{b}" data-board={b} style:--rows={size}>
    {#if switchable}
      <div class="board-head">
        <h2>{TITLE[b]}</h2>
        <div class="tab-group tab-group-compact" role="group" aria-label="{TITLE[b]} view">
          {#each ['list', ...BOARD_VIEWS] as const as v (v)}<button aria-pressed={view === v} onclick={() => setView(b, v)}>{VIEW_LABEL[v]}</button>{/each}
        </div>
      </div>
    {:else}<h2>{TITLE[b]}</h2>{/if}
    {#if b === 'origins' && rows.length}<p class="like-note">Counts coffee you've consumed, not coffee you've bought.</p>{/if}
    <div class="board-body">
      {#if b === 'origins' && rows.length}<div class="board-map"><WorldMap rows={rows.map((r) => ({ ...r, href: r.href && link(r.href) }))} {rank} valueText={(v) => fmt(v, whole)} valueLabel={RANK_LABEL[rank]} /></div>{/if}
      {#if unranked(b)}
        <p class="board-note fill">Not ranked by {RANK_LABEL[rank]}: it's per bag.</p>
      {:else if !rows.length}
        <p class="board-note">{emptyLine(boardEmpty(b))}</p>
      {:else if view === 'bars'}
        <!-- Rank by per group, left to right; roast levels lightest to darkest, the rest in rank order. -->
        {@const bars = (b === 'roast' ? [...rows].sort((x, y) => roastOrder.indexOf(x.key) - roastOrder.indexOf(y.key)) : rows).slice(0, BARS)}
        {@const top = Math.max(...bars.map((r) => r.value), 1e-9)}
        <div class="bars-view">
          <div class="bar-cols" role="img" aria-label="{TITLE[b]} by {RANK_LABEL[rank]}: {bars.map((r) => `${r.label} ${fmt(r.value)}`).join(', ')}">
            {#each bars as r (r.key)}<span class="col"><span class="bar" class:small-sample-mark={r.sample?.small} style:height="{Math.max(0, r.value / top) * 100}%"></span></span>{/each}
          </div>
          <BarLabels series={bars.map((r) => ({ label: r.label, value: r.value }))} full text={(v) => fmt(v)} />
        </div>
        {#if bars.some((r) => r.sample?.small)}<p class="chart-note">Striped bars are low confidence (a small sample).</p>{/if}
      {:else if view === 'time'}
        {@const sr = series?.[b]}
        {#if sr?.lines.length && sr.labels.length}
          <Chart type="line" labels={sr.labels} values={sr.lines[0].values} datasetLabel={sr.lines[0].label}
            series={sr.lines.slice(1)} legend dots={sr.labels.length <= 40} integer={rank === 'brews'} format={(v) => fmt(v)} height={260} />
          <p class="chart-note">{RANK_LABEL[rank]} per {sr.by}, top {sr.lines.length} {BOARD_NOUN[b]}</p>
        {:else}<p class="board-note">{emptyLine('No data in this period.')}</p>{/if}
      {:else}
        <ol class="board-rows" class:diverge={rank === 'like'}>
          {#each shown as r, i (r.key)}
            {@const m = comparing ? move(r.move) : null}
            {@const half = rank === 'like' ? Math.abs(r.value) / span / 2 : 0}
            <li class="board-row bar" class:liked={r.like && rank !== 'like'} class:small-sample={r.sample?.small}
              style:--share={rank === 'like' ? half : rows[0].value > 0 ? Math.max(0, r.value / rows[0].value) : 0}
              style:--left={rank === 'like' ? (r.value < 0 ? 0.5 - half : 0.5) : undefined}
              style:--bar-color={rank === 'like' ? deltaColor(r.value) : undefined}>
              <span class="rank">{i + 1}</span>
              <span class="who">
                <!-- Only the coffees board's labels are coffee names (the others: roasters, origins, gear…). -->
                {#snippet who()}{#if b === 'coffees'}<CoffeeName name={r.label} />{:else}{r.label}{/if}{/snippet}
                {#if r.href}<a href={link(r.href)}>{@render who()}</a>{:else}<span class="name">{@render who()}</span>{/if}

                <span class="who-line"><small>{detail(r, costWhole)}</small>{#if r.sample?.small}<SampleNote s={r.sample} />{/if}</span>
                <!-- Under rank=like the value already is this gap. -->
                {#if r.like && rank !== 'like'}<LikeLine like={r.like} />{/if}
              </span>
              <span class={rank === 'like' ? `val ${deltaInk(r.value)}` : 'val'}
                >{#if valueTip(b, r)}<TextTip label={fmt(r.value)} tip={valueTip(b, r)!} />{:else if rank === 'spend' || rank === 'ppg'}<Usd n={r.value} {whole} suffix={rank === 'ppg' ? '/g' : ''} />{:else}{fmt(r.value)}{/if}</span>
              {#if comparing}<span class="move {m?.cls ?? ''}" role="img" aria-label={m?.label}>{m?.text}</span>{/if}
            </li>
          {/each}
          {#each { length: Math.max(0, size - shown.length) } as _, i (i)}
            <li class="board-row placeholder" aria-hidden="true"><span class="rank">{shown.length + i + 1}</span><span class="who">—</span></li>
          {/each}
        </ol>
      {/if}
    </div>
    <!-- The footer exists only for a Show all button; a band row stretches its cards level, so a board whose
         neighbor has the button keeps that space (and one with none, none). -->
    {#if rows.length > size && !unranked(b)}
      <footer class="board-foot">
        <button class="button button-ghost" aria-expanded={isOpen} onclick={(e) => bottomInView(e.currentTarget.closest('.board-foot'), () => choose({ open: isOpen ? undefined : b }))}
          >{isOpen ? `Show top ${size}` : `Show all (${rows.length})`}</button
        >
      </footer>
    {/if}
  </section>
{/snippet}

{#if part === 'bar'}{@render bar()}{:else}
<!-- A whole tab with nothing to rank is one empty panel, not ten empty boards (rule 28). -->
{#if !cut.length && BANDS.flat().every((b) => !boards[b].length)}
  <section class="chart-panel"><p class="hl-empty">{emptyLine(emptyText())}</p></section>
{:else}
  <!-- Under like only coffees and roasters rank; the rest are left out, with one line saying so (no empty cards). -->
  <nav class="board-jump" aria-label="Jump to a board">
    <span>Jump to</span>
    {#each BANDS.flat().filter((b) => rank !== 'like' || LIKE_BOARDS.includes(b)) as b (b)}<a href="#leaderboard-{b}">{TITLE[b]}</a>{/each}
  </nav>
  {#each BANDS as full, i (i)}
    {@const band = full.filter((b) => rank !== 'like' || LIKE_BOARDS.includes(b))}
    {#if band.length}
      <div class="board-band band-{band.length}" class:has-like={rank !== 'like' && band.some((b) => boards[b].some((r) => r.like))}>
        {#each band as b (b)}{@render board(b)}{/each}
      </div>
    {/if}
  {/each}
  {#if wholeKeys.length && (rank === 'spend' || rank === 'ppg')}<WholeNote keys={wholeKeys} />{/if}
  {#if noisy.length}<p class="like-note noise-note">{names(noisy)} differ by less than their noise: their order can change with the next few bags. Each value's tip gives its ±.</p>{/if}
  {#if rank === 'like'}<p class="like-note"><span class="setting-name">{RANK_LABEL.like}</span> ranks coffees and roasters only. A roaster is compared with other roasters' coffees. Coffees with too few like coffees to compare, or under 4 rated brews, are left out.</p>{/if}
{/if}
{/if}

<style>
  /* .mode-tip / .mode-tip-button base styles are in app.css. */
  .rank-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .rank-bar .form-field {
    margin-bottom: 0;
  }
  /* All three fields share one label line and one control height (checked in test:ui). */
  .rank-bar .form-field > span {
    display: block;
    line-height: 1.2;
  }
  .rank-bar .mode-tip-button {
    min-height: 0;
    font-size: inherit;
    line-height: inherit;
  }
  .rank-bar select {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  /* Cards in a band share one height: fixed rows, placeholders for empty slots; the grid stretches
     them level (the Show all footer exists only on boards that need it). */
  .board-band {
    --row-h: 3rem;
    display: grid;
    grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
    align-items: stretch;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  /* A row with a vs-like line is taller (.liked, --row-h-like). Side by side, the whole band takes that height so the
     cards stay level; stacked, only rows with a line grow. */
  @media (min-width: 641px) {
    .board-band.has-like {
      --row-h: var(--row-h-like);
    }
  }
  /* An expanded card alone grows; its neighbors keep their own height. */
  .board-band:has(.board.open) {
    align-items: start;
  }
  @media (min-width: 641px) {
    .band-2,
    .band-6 {
      --cols: 2;
    }
  }
  /* viewport 1000px (no rail; the rail narrows it) */
  @container insights (min-width: 968px) {
    .band-6 {
      --cols: 3;
    }
  }
  .board {
    margin: 0;
  }
  /* Over time spans the band's whole row (dense: the cards after it fill the gap it leaves). */
  .board.wide {
    grid-column: 1 / -1;
  }
  .board-band:has(.board.wide) {
    grid-auto-flow: dense;
  }
  .board-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .board-head h2 {
    margin: 0;
  }
  .board-head :global(.tab-group) {
    flex-wrap: nowrap;
  }
  .board-head :global(.tab-group button) {
    min-height: 2.25rem;
    margin: 0;
  }
  @media (max-width: 640px) {
    .board-head :global(.tab-group button) {
      min-height: 44px;
      min-width: 44px;
    }
  }
  /* Jump links: one chip per board, landing on its card (the page's scroll-padding clears the sticky bar). */
  .board-jump {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-size: 0.85rem;
  }
  .board-jump span {
    color: var(--color-text-muted);
  }
  .board-jump a {
    display: inline-flex;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    text-decoration: none;
  }
  @media (hover: hover) {
    .board-jump a:hover {
      border-color: var(--color-accent);
    }
  }
  @media (max-width: 640px) {
    .board-jump a {
      min-height: 44px;
    }
  }
  /* Bars: columns on the shared small-sample look, names and values under them (BarLabels). */
  .bars-view {
    display: flex;
    flex-direction: column;
    min-height: calc(var(--rows) * var(--row-h));
  }
  .bar-cols {
    flex: 1 1 auto;
    min-height: 8rem;
    display: flex;
    align-items: flex-end;
    gap: 6%;
    padding-inline: 3%;
    border-bottom: 1px solid var(--color-border);
  }
  .bar-cols .col {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }
  .bar-cols .bar {
    width: 100%;
    min-height: 2px;
    background: var(--series-brown-1);
    border: 1px solid var(--series-brown-1-ink);
    border-bottom: 0;
    border-radius: 2px 2px 0 0;
  }
  /* A value's tip (TextTip) sits over the row's stretched link, so hover and tap reach it (ui-rules 41). */
  .board :global(.val .text-tip) {
    position: relative;
    z-index: 1;
  }
  /* Phones: a 1-decimal value is ~20px wide; side padding (pulled back by the margin) grows its target to 44 (rule 4). */
  @media (max-width: 640px) {
    .board :global(.val .text-tip) {
      padding-inline: 12px;
      margin-inline: -12px;
    }
  }
  /* The row rules (.board-rows, .board-row, .rank, .who, .val) are :global() in +page.svelte,
     shared with the lab tabs. */
  /* The per-bag note keeps the band's row height; an empty board is one short line (gate 3), its panel
     top-aligned so the band's taller boards don't stretch it. */
  .board-note {
    margin: 0;
    padding: var(--space-4) 0;
  }
  .like-note {
    margin: 0;
    padding: var(--space-4) 0;
    text-align: center;
    color: var(--color-text-muted);
  }
  /* Under spend/ppg the gear and water boards are empty cards as tall as a populated board. */
  .board.fill:has(.board-note) {
    align-self: stretch;
  }
  .board-note.fill {
    min-height: calc(var(--rows) * var(--row-h));
  }
  .board:has(.board-note) {
    align-self: start;
  }
  .board-note {
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--color-text-muted);
  }
  /* rank=like: the zero line the bars grow from. */
  .board-rows.diverge {
    background: linear-gradient(var(--color-border), var(--color-border)) 50% 0 / 1px 100% no-repeat;
  }
  .move {
    min-width: 2.5rem;
    text-align: right;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* ui-rules 29: the overview's trend colors (same tokens). */
  .move.trend-good {
    color: var(--color-fresh);
  }
  .move.trend-bad {
    color: var(--color-urgent);
  }
  .placeholder {
    color: var(--color-text-muted);
    opacity: 0.45;
  }
  .board-foot {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 2.75rem;
  }
  .board-foot button {
    margin: 0;
  }
  @media (max-width: 640px) {
    .board-foot button {
      min-height: 44px;
    }
    .rank-bar .form-field {
      flex: 1 1 0;
      min-width: 0;
    }
    .rank-bar select {
      min-height: 44px;
      font-size: 16px;
    }
  }
  /* Origins: map beside its list on wide screens (list column fixed, map takes the rest and
     sits at the top), above it below 1100px at its natural height. */
  /* viewport 1100px (no rail; the rail narrows it) */
  @container insights (min-width: 1068px) {
    .board[data-board='origins'] .board-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
      gap: var(--space-3);
      align-items: stretch;
    }
    /* The map is cropped (slice) to the list's height, so it fills the column edge to edge;
       the cropped strips are empty Pacific. */
    .board-map {
      height: calc(var(--rows) * var(--row-h));
    }
  }
  .how-dialog {
    width: min(34rem, 100% - 2rem);
    max-height: calc(100dvh - 1rem);
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
  }
  .how-dialog[open] {
    display: flex;
    flex-direction: column;
  }
  .how-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .how-dialog header,
  .how-dialog footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
  }
  .how-dialog footer {
    justify-content: flex-end;
    border-top: 1px solid var(--color-border);
  }
  .how-dialog h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .how-dialog h3 {
    margin: var(--space-3) 0 var(--space-1);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .how-dialog .button {
    margin: 0;
    min-height: 2.25rem;
  }
  .how-dialog .close {
    min-width: 2.25rem;
    font-size: 1.4rem;
    line-height: 1;
  }
  .how-body {
    overflow-y: auto;
    padding: 0 var(--space-3) var(--space-3);
    font-size: 0.9rem;
    line-height: 1.4;
  }
  .how-body h3:first-child {
    margin-top: 0;
  }
  .how-body p {
    margin: 0 0 var(--space-2);
  }
  .eg {
    color: var(--color-text-muted);
  }
  @media (max-width: 640px) {
    .how-dialog .button {
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
