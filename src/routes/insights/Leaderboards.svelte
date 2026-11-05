<script lang="ts" module>
  import { LIKE_BOARDS, type Board, type Rank } from '$lib/insightsUrl';
  import type { PageData } from './$types';
  import type { JumpLink } from './JumpNav.svelte';
  import { BOARD_TITLE } from './chartLink';

  type Rows = NonNullable<PageData['boards']>;
  const TITLE = BOARD_TITLE;
  const BANDS: Board[][] = [['roasters', 'coffees'], ['origins'], ['varieties', 'producers'], ['process', 'roast', 'water', 'dripper', 'filter', 'grinder', 'caffeine']];
  export function jumpLinks(boards: Rows, cut: Board[], rank: Rank): JumpLink[] {
    // A whole tab with nothing to rank is one empty panel: no chips.
    if (!cut.length && BANDS.flat().every((b) => !boards[b].length)) return [];
    return BANDS.flat().filter((b) => rank !== 'like' || LIKE_BOARDS.includes(b)).map((b) => [`leaderboard-${b}`, TITLE[b]] as const);
  }
</script>

<script lang="ts">
  import WholeNote from './WholeNote.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
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
  import { MediaQuery } from 'svelte/reactivity';
  import { allShownLine, hiddenLine, BAG_MIN_BREWS, POOLED_MIN_BAGS, POOLED_MIN_BREWS, scoredLine, withinNoise } from '$lib/sample';
  import type { Tip } from '$lib/components/TipBody.svelte';
  import { BAG_BOARDS, BOARDS, BOARD_NOUN, lowFirst, VIEW_BOARDS, COFFEES_AVG, DEFAULT_AVG, RANKS, boardAvg, type Avg, type BrewFilterKey, type BoardView, type BoardViews, type InsightsUrlState } from '$lib/insightsUrl';
  import LikeLine from './LikeLine.svelte';
  import { RANK_LABEL, boardValue } from './chartLink';
  import { labelTip } from '$lib/components/labelTip';
  import Chart from '$lib/components/Chart.svelte';
  import type { BoardSeries } from '$lib/server/insights/leaderboards';
  import { deltaColor, deltaInk, likeGap } from '$lib/components/deltaColor';

  let {
    boards, coverage, wholeKeys, cut, small, rank, avg, open, low, views, series, comparing, perPerson, placeTip, choose, link, part, decafHidden
  }: {
    decafHidden: boolean; // rated decaf brews in the view that the rating rule leaves out (server)
    part?: 'bar'; // 'bar': only the Rank by / Score controls (rendered inside the sticky bar), else the boards
    // avg: the URL's Score; undefined = each board's default (boardAvg).
    boards: Rows; coverage: PageData['boardCoverage'] & {}; wholeKeys: BrewFilterKey[]; cut: Board[]; small: Partial<Record<Board, number>>; rank: Rank; avg: Avg | undefined; open: Board[]; low: Board[]; comparing: boolean; perPerson: boolean;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
    // views: the small boards' Over time pick, `wide` when expanded (URL; absent = List); series: Over time's lines (server,
    // only boards on it).
    views: BoardViews | undefined; series: Record<string, BoardSeries> | null;
    link: (href: string) => string; // the page's Period, Ratings and Coffees filter carried onto a row's link
  } = $props();

  // Top 10 where there are many items, top 5 for small sets (spec "Boards").
  const SIZE = (b: Board) => (b === 'roasters' || b === 'coffees' || b === 'origins' || b === 'varieties' || b === 'producers' ? 10 : 5);

  // Each board's Show all is its own: toggling one leaves the others as they are.
  const toggle = (b: Board) => {
    const next = BOARDS.filter((x) => (x === b ? !open.includes(x) : open.includes(x)));
    choose({ open: next.length ? next : undefined });
  };
  // Lowest first: the board's rows, lowest value first (one-bag groups left out), its own switch.
  const toggleLow = (b: Board) => {
    const next = BOARDS.filter((x) => (x === b ? !low.includes(x) : low.includes(x)));
    choose({ low: next.length ? next : undefined });
  };
  const listed = (b: Board) => (low.includes(b) ? lowFirst(b, boards[b]) : boards[b]);
  const VIEWS = [['list', 'List'], ['time', 'Over time']] as const;
  const viewOf = (b: Board) => (views as Partial<Record<Board, BoardView>> | undefined)?.[b];
  // v: undefined = List. Switching to Over time keeps an expansion already there.
  const setView = (b: Board, v: BoardView | undefined) => {
    const next = { ...views, [b]: v };
    choose({ views: Object.values(next).some(Boolean) ? next : undefined });
  };
  // The first and last non-null values bound a gap: a null between them is a period with no data (drawn dashed).
  const gappy = (vs: (number | null)[]) => vs.some((v, i) => v === null && vs.slice(0, i).some((x) => x !== null) && vs.slice(i).some((x) => x !== null));

  const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
  // `whole`: the board's money format (ui-rules 46: one per list).
  const fmt = (v: number, whole?: boolean) => boardValue(v, rank, perPerson, whole);
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
  const footed = (band: Board[]) => band.some((x) => listed(x).length > SIZE(x) && !unranked(x));
  const unranked = (b: Board) => (rank === 'spend' || rank === 'ppg') && !BAG_BOARDS.includes(b);
  const emptyText = () =>
    rank === 'spend' || rank === 'ppg' ? 'No bags bought in this period.'
    : rank === 'like' ? 'No coffees with a like group to compare in this period.' : 'No brews in this period.';
  // A board the confident cutoff emptied says what its rows lacked, not "No brews" (every other Score shows every
  // rated group, each bag weighted by its brews).
  // The Expand button (CSS: wider than 640) sits over the chart's corner; the plot starts below it.
  const roomy = new MediaQuery('min-width: 641px');
  const need = (b: Board) => `${b === 'coffees' ? `${BAG_MIN_BREWS}+ rated brews` : `${POOLED_MIN_BAGS}+ bags and ${POOLED_MIN_BREWS}+ rated brews`}`;
  const boardEmpty = (b: Board) =>
    cut.includes(b) ? `No ${BOARD_NOUN[b]} with ${need(b)} in this period.` : emptyText();
  // A board the confident cutoff trimmed (some rows left): one line under the rows saying what it ranks and how many are hidden,
  // with the way to show them (a Score that keeps every group, each with its Low confidence chip). Every card of a band
  // reserves the band's longest such line, so the cards stay level.
  const SHOW_ALL_AVG: Avg = 'adjusted';
  // Under the board's default Score the line offers the hidden groups; under another one it says all are shown and offers the way back.
  const showingAll = (b: Board) => boardAvg(b, avg) !== boardAvg(b, undefined);
  const smallLine = (b: Board) => showingAll(b) ? allShownLine(BOARD_NOUN[b], need(b), boards[b].length) : hiddenLine(BOARD_NOUN[b], need(b), small[b] ?? 0);
  const smallText = (b: Board) => (small[b] ? smallLine(b).lead + smallLine(b).show : '');
  const bandNote = (b: Board) => {
    const band = BANDS.find((x) => x.includes(b))!;
    return band.map(smallText).reduce((a, t) => (t.length > a.length ? t : a), '');
  };
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
        // A board that can't rank by the new Rank by is not shown, so it is not left open (or Lowest first).
        const gone = (b: Board) => ((r === 'spend' || r === 'ppg') && !BAG_BOARDS.includes(b)) || (r === 'like' && !LIKE_BOARDS.includes(b));
        const keep = open.filter((b) => !gone(b)), keepLow = low.filter((b) => !gone(b));
        choose({
          rank: r,
          ...(keep.length < open.length ? { open: keep.length ? keep : undefined } : {}),
          ...(keepLow.length < low.length ? { low: keepLow.length ? keepLow : undefined } : {})
        });
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
  {@const isOpen = open.includes(b)}
  <!-- One money format per board (ui-rules 46): whole dollars for all when any amount is $1,000+. -->
  {@const whole = (rank === 'spend' || rank === 'ppg') && wholeUsd(rows.map((r) => r.value))}
  {@const costWhole = rank === 'ppg' && wholeUsd(rows.map((r) => r.cost))}
  {@const fixed = b === 'caffeine'}
  {@const isLow = low.includes(b) && !fixed}
  {@const ordered = isLow ? lowFirst(b, rows) : rows}
  {@const shown = isOpen ? ordered : ordered.slice(0, size)}
  {@const top = Math.max(...shown.map((r) => r.value), 0)}
  <!-- Over time under Lowest first: the lowest groups' lines, lowest first (the server sends them best first). -->
  {@const pool = !isLow ? (series?.[b]?.lines ?? []) : ordered.flatMap((r) => series?.[b]?.lines.find((l) => l.label === r.label) ?? [])}
  <!-- rank=like: a zero-centred bar, scaled to the board's largest |gap| (signed values, ui gate P4). -->
  {@const span = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9)}
  {@const switchable = (VIEW_BOARDS as readonly Board[]).includes(b) && !unranked(b) && rows.length > 0}
  {@const pick = switchable ? viewOf(b) : undefined}
  {@const view = pick || fixed ? 'time' : 'list'}
  <!-- Caffeine is always Over time, in a fixed-height chart, and spans its row (CSS): no List, Lowest first or Expand. -->
  {@const spans = fixed}
  {@const wide = pick === 'wide' && !spans}
  <section class="chart-panel board" class:fill={unranked(b)} class:open={isOpen} class:timeview={view === 'time'} class:fixed class:wide data-board={b} style:--rows={size}
    data-lines={view === 'time' ? (isOpen ? pool.length : Math.min(size, pool.length)) : undefined}>
    <div class="board-head">
      <HeadingAnchor id="leaderboard-{b}">{TITLE[b]}</HeadingAnchor>
      <div class="board-tools">
        <!-- First in the tools, one box pressed or not; gone (the head keeps its height) where there is nothing to order. -->
        {#if rows.length && !unranked(b) && !fixed}
          <button class="icon-button low-switch" aria-pressed={isLow} aria-label="Lowest first" use:labelTip={'Lowest first'}
            onclick={() => toggleLow(b)}><Icon name={isLow ? 'sort-ascending' : 'sort-descending'} /></button>
        {/if}
        {#if switchable}
          <div class="form-field group-field">
            <span class="sr-only">Shown as</span>
            <div class="tab-group tab-group-compact" role="group" aria-label="{TITLE[b]} shown as">
              {#each VIEWS as [v, label] (v)}<button aria-pressed={view === v} onclick={() => setView(b, v === 'list' ? undefined : (pick ?? 'time'))}>{label}</button>{/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
    {#if b === 'caffeine' && decafHidden}<p class="like-note">Decaf brews are left out of ratings. <button class="link-like" onclick={() => choose({ caffeine: 'all' })}>Include decaf</button></p>{/if}
    {#if b === 'origins' && rows.length}<p class="like-note">Counts coffee you've consumed, not coffee you've bought.</p>{/if}
    {#if (b === 'varieties' || b === 'producers') && rows.length}
      {@const c = coverage[b]}
      <p class="like-note">{#if b === 'varieties'}{rank === 'spend' || rank === 'ppg' ? 'A bag counts' : 'A brew counts'} toward each of its coffee's varieties.{' '}{/if}{c.with} of {c.of} bags{rank === 'spend' || rank === 'ppg' ? ' bought' : ''} have a {b === 'varieties' ? 'variety' : 'producer'}.</p>
    {/if}
    <div class="board-body" class:time={view === 'time'}>
      {#if b === 'origins' && rows.length}<div class="board-map"><WorldMap rows={rows.map((r) => ({ ...r, href: r.href && link(r.href) }))} {rank} valueText={(v) => fmt(v, whole)} valueLabel={RANK_LABEL[rank]} /></div>{/if}
      {#if unranked(b)}
        <p class="board-note fill">Not ranked by {RANK_LABEL[rank]}: it's per bag.</p>
      {:else if !rows.length}
        <p class="board-note">{emptyLine(boardEmpty(b))}</p>
      {:else if view === 'time'}
        {@const sr = series?.[b]}
        <!-- The server sends every group's line, best first (colors follow that order, so Show all keeps the top ones'). -->
        {@const lines = isOpen ? pool : pool.slice(0, size)}
        {#if sr && lines.length && sr.labels.length}
          <!-- The chart fills the List's body height, so neither switching views nor Show all resizes the card (the legend grows
               inside it). -->
          <div class="time-chart">
            <!-- In the chart's top-right corner, not the head: the head is the same in List and Over time and never wraps for it.
                 Only where the band has columns to span (CSS hides it on a phone). -->
            {#if !spans}<button class="icon-button expand" aria-label={wide ? 'Shrink chart' : 'Expand chart'} aria-pressed={wide} use:labelTip={wide ? 'Shrink chart' : 'Expand chart'}
              onclick={() => setView(b, wide ? 'time' : 'wide')}><Icon name={wide ? 'arrows-in-simple' : 'arrows-out-simple'} /></button>{/if}
            <Chart type="line" padTop={roomy.current && !spans ? 36 : 0} labels={sr.labels} values={lines[0].values} datasetLabel={lines[0].label}
              series={lines.slice(1)} legend dashGaps integer={rank === 'brews'} format={(v) => fmt(v)} height={fixed ? 200 : 'fill'} />
          </div>
          <p class="chart-note">{RANK_LABEL[rank]} per {sr.by}, {lines.length === pool.length ? (lines.length > 1 ? `all ${lines.length} ` : '') : `${isLow ? 'lowest' : 'top'} ${lines.length} `}{BOARD_NOUN[b]}{#if lines.some((l) => gappy(l.values))}{' · '}Dashed: {sr.by}s with no data{/if}{#if fixed && ordered.some((r) => r.sample?.small)}{' · '}Few brews: {ordered.filter((r) => r.sample?.small).map((r) => r.label).join(', ')}{/if}</p>
        {:else}<p class="board-note">{emptyLine('No data in this period.')}</p>{/if}
      {:else}
        <ol class="board-rows" class:diverge={rank === 'like'}>
          {#each shown as r, i (r.key)}
            {@const m = comparing ? move(isLow ? r.lowMove : r.move) : null}
            {@const half = rank === 'like' ? Math.abs(r.value) / span / 2 : 0}
            <li class="board-row bar" class:liked={r.like && rank !== 'like'} class:small-sample={r.sample?.small}
              style:--share={rank === 'like' ? half : top > 0 ? Math.max(0, r.value / top) : 0}
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
                >{#if valueTip(b, r)}<TextTip value label={fmt(r.value)} tip={valueTip(b, r)!} />{:else if rank === 'spend' || rank === 'ppg'}<Usd n={r.value} {whole} suffix={rank === 'ppg' ? '/g' : ''} />{:else}{fmt(r.value)}{/if}</span>
              {#if comparing}<span class="move {m?.cls ?? ''}" role="img" aria-label={m?.label}>{m?.text}</span>{/if}
            </li>
          {/each}
          {#each { length: Math.max(0, size - shown.length) } as _, i (i)}
            <li class="board-row placeholder" aria-hidden="true"><span class="rank">{shown.length + i + 1}</span><span class="who">—</span></li>
          {/each}
        </ol>
      {/if}
      {#if isLow && !unranked(b) && ordered.length < rows.length}<p class="chart-note">Groups with one bag are left out.</p>{/if}
    </div>
    {#if bandNote(b) && rows.length && !unranked(b) && (!fixed || small[b])}
      <!-- The hidden twin holds the band's longest line, so a card without the note (or with a shorter one) is as tall. -->
      <p class="chart-note small-note">{#if !fixed}<span class="twin" aria-hidden="true">{bandNote(b)}</span>{/if}
        {#if small[b]}<span class="real">{smallLine(b).lead}<button class="link-like" onclick={() => choose({ avg: showingAll(b) ? undefined : rank === 'like' ? 'raw' : SHOW_ALL_AVG })}>{smallLine(b).show}</button></span>{/if}</p>
    {/if}
    <!-- The footer exists only for a Show all button. A band with one reserves that space in its other cards (.has-foot,
         CSS), so cards are level by their own content, not by stretching: a card that opens can't resize the others. -->
    {#if ordered.length > size && !unranked(b)}
      <footer class="board-foot">
        <button class="button button-ghost" aria-expanded={isOpen} onclick={(e) => bottomInView(e.currentTarget.closest('.board-foot'), () => toggle(b))}
          >{isOpen ? `Show top ${size}` : `Show all (${ordered.length})`}</button
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
  {#each BANDS as full, i (i)}
    {@const band = full.filter((b) => rank !== 'like' || LIKE_BOARDS.includes(b))}
    {#if band.length}
      <div class="board-band band-{band.length}" class:has-like={rank !== 'like' && band.some((b) => boards[b].some((r) => r.like))} class:has-foot={footed(band)}>
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
  /* An opened List card alone grows; its neighbors keep their own height. An opened Over time card doesn't grow (Show all only
     adds lines), so it doesn't start this. */
  .board-band:has(.board.open:not(.timeview)) {
    align-items: start;
  }
  /* An Over time card never stretches: only a List card grows, and only by its own Show all. */
  .board.timeview {
    align-self: start;
  }
  @media (min-width: 641px) {
    .band-2,
    .band-6,
    .band-7 {
      --cols: 2;
    }
  }
  /* viewport 1000px (no rail; the rail narrows it) */
  @container insights (min-width: 968px) {
    .band-6,
    .band-7 {
      --cols: 3;
    }
  }
  .board {
    margin: 0;
  }
  /* Seven boards leave a lone last card at 2 or 3 columns: it takes the whole row. */
  @media (min-width: 641px) {
    .band-7 > .board:last-child {
      grid-column: 1 / -1;
    }
  }
  /* An expanded Over time card spans the band's row; dense flow lets the cards after it fill the gap it leaves, at their
     normal width. */
  .board.wide {
    grid-column: 1 / -1;
  }
  .board-band:has(.board.wide) {
    grid-auto-flow: dense;
  }
  /* Expand / Shrink (inside .time-chart, over its top-right corner): only where the band has more than one column. */
  .expand {
    display: none;
  }
  @media (min-width: 641px) {
    .expand {
      display: inline-flex;
      position: absolute;
      top: 0;
      right: 0;
      z-index: 1;
      width: 2.25rem;
      height: 2.25rem;
    }
  }
  .low-switch {
    width: 2.25rem;
    height: 2.25rem;
  }
  .low-switch[aria-pressed='true'] {
    background: color-mix(in srgb, var(--color-accent) 18%, var(--color-surface));
    border-color: var(--color-accent);
  }
  @media (max-width: 640px) {
    .low-switch {
      width: 44px;
      height: 44px;
    }
  }
  .board-tools {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .board-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    min-height: 2.25rem;
  }
  @media (max-width: 640px) {
    .board-head {
      min-height: 44px;
    }
  }
  .board-head :global(h2),
  .board-head :global(.form-field) {
    margin: 0;
  }
  .board-head :global(.tab-group) {
    flex-wrap: nowrap;
  }
  .board-head :global(.tab-group button) {
    min-height: 2.25rem;
    margin: 0;
    padding-inline: 0.3rem;
  }
  @media (max-width: 640px) {
    .board-head :global(.tab-group button) {
      min-height: 44px;
      min-width: 44px;
      padding-inline: 0.15rem;
    }
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
  /* Over time: the body is the List's height (rows × row height), the chart takes what the caption leaves. */
  .board.timeview {
    display: flex;
    flex-direction: column;
  }
  .board-body.time {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: calc(var(--rows) * var(--row-h));
  }
  /* The chart is laid out inside this box (absolute), whatever height the card is stretched to. A sane minimum keeps the
     plot readable under a wrapped legend. */
  .time-chart {
    position: relative;
    flex: 1 1 0;
    min-height: 12rem;
  }
  /* Caffeine: the chart's own height, not the List's (it has no List). */
  .fixed .board-body.time {
    min-height: 0;
  }
  /* Its note leads into the chart, and its head has no tools to make room for. */
  .fixed .like-note {
    padding: 0 0 var(--space-2);
  }
  .fixed .board-head {
    min-height: 0;
  }
  .fixed .time-chart {
    flex: none;
    height: 200px;
  }
  .time-chart :global(.chart-container) {
    position: absolute;
    inset: 0;
  }
  .small-note {
    display: grid;
  }
  .small-note > * {
    grid-area: 1 / 1;
  }
  .small-note .twin {
    visibility: hidden;
  }
  .link-like {
    all: unset;
    cursor: pointer;
    color: var(--color-accent);
    text-decoration: underline;
  }
  /* Phones: padding grows the target to 44 (rule 4), the negative margin keeps the line as it was. */
  @media (max-width: 640px) {
    .link-like {
      display: inline-block;
      padding: 13px 8px;
      margin: -13px -8px;
    }
  }
  .link-like:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  /* Caffeine spans its own row: nothing to level with. */
  .has-foot > .board:not(.fixed):not(:has(.board-foot))::after {
    content: '';
    display: block;
    height: 2.75rem;
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
