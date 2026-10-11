<script lang="ts">
  import { formatGrams } from '$lib/grams';
  import WorldMap from '$lib/components/WorldMap.svelte';
  import { AVGS, BAG_BOARDS, RANKS, type Avg, type Board, type InsightsUrlState, type Rank, type Ratings } from '$lib/insightsUrl';
  import type { PageData } from './$types';

  type Rows = NonNullable<PageData['boards']>;
  let {
    boards, rank, ratings, avg, open, comparing, perPerson, ratingsHelp, placeTip, choose
  }: {
    boards: Rows; rank: Rank; ratings: Ratings; avg: Avg; open: Board | undefined; comparing: boolean; perPerson: boolean;
    ratingsHelp: Record<Ratings, string>; placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  const TITLE: Record<Board, string> = {
    roasters: 'Roasters', coffees: 'Coffees', origins: 'Origins', process: 'Process group', roast: 'Roast level',
    water: 'Water', dripper: 'Dripper', filter: 'Filter', grinder: 'Grinder'
  };
  const RANK_LABEL: Record<Rank, string> = { rating: 'Rating', brews: 'Brews', grams: 'Grams', spend: 'Spend', ppg: '$/g' };
  // Top 10 where there are many items, top 5 for small sets (spec "Boards").
  const SIZE = (b: Board) => (b === 'roasters' || b === 'coffees' || b === 'origins' ? 10 : 5);
  const BANDS: Board[][] = [['roasters', 'coffees'], ['origins'], ['process', 'roast', 'water', 'dripper', 'filter', 'grinder']];

  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const plural = (n: number, w: string) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
  function fmt(v: number): string {
    if (rank === 'rating') return v.toFixed(1);
    if (rank === 'grams') return formatGrams(v);
    if (rank === 'spend') return usd.format(v);
    if (rank === 'ppg') return `$${v.toFixed(3)}/g`;
    return perPerson && v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
  }
  type Row = Rows[Board][number];
  const detail = (r: Row) =>
    [
      r.sub,
      ...(avg.startsWith('best') && rank === 'rating' && r.atBest
        ? [`${plural(r.atBest, 'brew')} at ${r.best?.toFixed(1)}`, plural(r.bags, 'bag')]
        : [plural(r.bags, 'bag'), r.brews ? plural(r.brews, 'brew') : null, r.fewBags ? 'few bags' : null])
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
    ppg: 'Price per gram of bags bought in the period.'
  };
  const AVG_LABEL: Record<Avg, string> = {
    raw: 'Raw average', min3: 'Raw average (3+ bags)', k2: 'Adjusted (light)', adjusted: 'Adjusted (strong)',
    best: 'Best brew', 'best-k2': 'Best adjusted (light)', 'best-k5': 'Best adjusted (strong)'
  };
  const AVG_HELP: Record<Avg, string> = {
    raw: "Plain average of each bag's rating, all groups ranked together.",
    min3: 'Plain average; groups with fewer than 3 bags rank after the rest.',
    k2: "Pulled slightly toward your overall average, so 1–2 bag groups can't top the board (K = 2).",
    adjusted: 'Pulled strongly toward your overall average until a group has about 5 bags (K = 5).',
    best: 'The highest single brew rating in the group.',
    'best-k2': 'Best single brew, pulled toward your overall average until the group has hit that score about 2 times.',
    'best-k5': 'Best single brew, pulled toward your overall average until the group has hit that score about 5 times.'
  };
  const bagOnly = (b: Board) => (rank === 'spend' || rank === 'ppg') && !BAG_BOARDS.includes(b);
  const emptyText = () => (rank === 'spend' || rank === 'ppg' ? 'No bags bought in this period.' : 'No brews in this period.');
</script>

<div class="rank-bar">
  <div class="form-field">
    <span><button class="mode-tip-button" popovertarget="tip-rank" aria-describedby="tip-rank">Rank by</button></span>
    <select
      aria-label="Rank by"
      value={rank}
      onchange={(e) => {
        const r = e.currentTarget.value as Rank;
        choose({ rank: r, ...((r === 'spend' || r === 'ppg') && open && !BAG_BOARDS.includes(open) ? { open: undefined } : {}) });
      }}
    >
      {#each RANKS as r (r)}<option value={r} title={RANK_HELP[r]}>{RANK_LABEL[r]}</option>{/each}
    </select>
  </div>
  <div class="mode-tip" id="tip-rank" popover onbeforetoggle={placeTip}>
    {#each RANKS as r (r)}<p><b>{RANK_LABEL[r]}.</b> {RANK_HELP[r]}</p>{/each}
  </div>
  {#if rank === 'rating'}
    <div class="form-field">
      <span><button class="mode-tip-button" popovertarget="tip-score" aria-describedby="tip-score">Score</button></span>
      <select aria-label="Score" value={avg} onchange={(e) => choose({ avg: e.currentTarget.value as Avg })}>
        <optgroup label="Average">
          {#each ['raw', 'min3', 'k2', 'adjusted'] as const as a (a)}<option value={a} title={AVG_HELP[a]}>{AVG_LABEL[a]}</option>{/each}
        </optgroup>
        <optgroup label="Peak">
          {#each ['best', 'best-k2', 'best-k5'] as const as a (a)}<option value={a} title={AVG_HELP[a]}>{AVG_LABEL[a]}</option>{/each}
        </optgroup>
      </select>
    </div>
    <div class="mode-tip" id="tip-score" popover onbeforetoggle={placeTip}>
      {#each AVGS as a (a)}<p><b>{AVG_LABEL[a]}.</b> {AVG_HELP[a]}</p>{/each}
    </div>
    <div class="form-field">
      <span>Ratings</span>
      <div class="tab-group" role="group" aria-label="Ratings">
        {#each ['current', 'all'] as const as m (m)}
          <button
            aria-pressed={ratings === m}
            title={ratingsHelp[m]}
            aria-describedby="ratings-help-{m}"
            onclick={() => choose({ ratings: m })}>{m === 'all' ? 'All' : 'Current'}</button
          >
        {/each}
      </div>
    </div>
  {/if}
</div>

{#snippet board(b: Board)}
  {@const rows = boards[b]}
  {@const size = SIZE(b)}
  {@const isOpen = open === b}
  {@const shown = isOpen ? rows : rows.slice(0, size)}
  <section class="chart-panel board" class:open={isOpen} data-board={b} style:--rows={size}>
    <h2>{TITLE[b]}</h2>
    <div class="board-body">
      {#if b === 'origins'}<div class="board-map"><WorldMap {rows} {rank} valueText={fmt} /></div>{/if}
      {#if bagOnly(b)}
        <p class="board-note bag-only">{RANK_LABEL[rank]} is per bag, so gear and water aren't ranked by it.</p>
      {:else if !rows.length}
        <p class="board-note">{emptyText()}</p>
      {:else}
        <ol class="board-rows">
          {#each shown as r, i (r.key)}
            {@const m = comparing ? move(r.move) : null}
            <li class="board-row" class:few={avg === 'min3' && r.fewBags} style:--share={rows[0].value > 0 ? Math.max(0, r.value / rows[0].value) : 0}>
              <span class="rank">{i + 1}</span>
              <span class="who">
                {#if r.href}<a href={r.href}>{r.label}</a>{:else}<span class="name">{r.label}</span>{/if}
                <small>{detail(r)}</small>
              </span>
              <span class="val">{fmt(r.value)}</span>
              {#if comparing}<span class="move {m?.cls ?? ''}" role="img" aria-label={m?.label}>{m?.text}</span>{/if}
            </li>
          {/each}
          {#each { length: Math.max(0, size - shown.length) } as _, i (i)}
            <li class="board-row placeholder" aria-hidden="true"><span class="rank">{shown.length + i + 1}</span><span class="who">—</span></li>
          {/each}
        </ol>
      {/if}
    </div>
    <footer class="board-foot">
      {#if rows.length > size && !bagOnly(b)}
        <button class="button button-ghost" aria-expanded={isOpen} onclick={() => choose({ open: isOpen ? undefined : b })}
          >{isOpen ? `Show top ${size}` : `Show all (${rows.length})`}</button
        >
      {/if}
    </footer>
  </section>
{/snippet}

{#each BANDS as band, i (i)}
  <div class="board-band band-{band.length}">
    {#each band as b (b)}{@render board(b)}{/each}
  </div>
{/each}

<style>
  .rank-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
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
  .rank-bar .tab-group button {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  /* Cards in a band share one height: fixed rows, placeholders for empty slots, a fixed
     footer. Only an expanded card grows (align-items: start keeps its neighbours put). */
  .board-band {
    --row-h: 3rem;
    display: grid;
    grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
    align-items: start;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  @media (min-width: 641px) {
    .band-2,
    .band-6 {
      --cols: 2;
    }
  }
  @media (min-width: 1000px) {
    .band-6 {
      --cols: 3;
    }
  }
  .board {
    margin: 0;
  }
  .board-rows,
  .board-note {
    min-height: calc(var(--rows) * var(--row-h));
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .board-note {
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--color-text-muted);
  }
  .board-row {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-2);
    position: relative;
    height: var(--row-h);
    border-top: 1px solid var(--color-border);
  }
  .board-row:first-child {
    border-top: 0;
  }
  .rank {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .who {
    display: grid;
    min-width: 0;
    line-height: 1.2;
  }
  .who a,
  .who .name,
  .who small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Stretched link: the whole 48px row is the tap target. The link stays static so its
     overflow:hidden doesn't clip the overlay; the row is the containing block. */
  .who a::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .who a:focus-visible {
    outline: none;
  }
  .who a:focus-visible::after {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .who small {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .val {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .move {
    min-width: 2.5rem;
    text-align: right;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* ui-rules 29: the overview's trend colours (same tokens). */
  .move.trend-good {
    color: var(--color-fresh);
  }
  .move.trend-bad {
    color: var(--color-urgent);
  }
  #tip-score p {
    margin: 0 0 0.4rem;
  }
  #tip-score p:last-child {
    margin: 0;
  }
  .few .who,
  .few .val {
    opacity: 0.6;
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
    .board-foot button,
    .rank-bar .tab-group button {
      min-height: 44px;
    }
    .rank-bar .tab-group button {
      flex: 1;
      padding-inline: 0.4rem;
      white-space: nowrap;
    }
    .rank-bar .form-field {
      flex: 1 1 100%;
    }
    .rank-bar select {
      min-height: 44px;
      font-size: 16px;
    }
  }
  /* Origins: map beside its list on wide screens (list column fixed, map takes the rest and
     sits at the top), above it below 1100px at its natural height. */
  @media (min-width: 1100px) {
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
  /* Value bar behind each row (share of the top row), inset inside the row so it never crosses
     the row borders; z-index -1 inside the row's own stacking context keeps text on top. */
  .board-row:not(.placeholder) {
    isolation: isolate;
  }
  .board-row:not(.placeholder)::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 3px auto 3px 0;
    width: calc(var(--share) * 100%);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--map-high) var(--bar-alpha), transparent);
  }
</style>
