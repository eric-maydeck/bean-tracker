<script lang="ts">
  import SampleNote from '$lib/components/SampleNote.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { formatGrams } from '$lib/grams';
  import WorldMap from '$lib/components/WorldMap.svelte';
  import { BAG_BOARDS, DEFAULT_AVG, RANKS, type Avg, type Board, type InsightsUrlState, type Rank } from '$lib/insightsUrl';
  import type { PageData } from './$types';

  type Rows = NonNullable<PageData['boards']>;
  let {
    boards, rank, avg, open, comparing, perPerson, placeTip, choose
  }: {
    boards: Rows; rank: Rank; avg: Avg; open: Board | undefined; comparing: boolean; perPerson: boolean;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
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
        : rank === 'ppg' && r.cost !== undefined
          ? [plural(r.bags, 'bag'), usd.format(r.cost), formatGrams(r.grams!)]
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
    ppg: 'Price per gram of bags bought in the period.'
  };
  const AVG_LABEL: Record<Avg, string> = {
    raw: 'Raw average', min3: 'Raw average, confident', k2: 'Confidence adj. (light)', adjusted: 'Confidence adj. (strong)',
    best: 'Best brew', 'best-k2': 'Best, conf. adj. (light)', 'best-k5': 'Best, conf. adj. (strong)'
  };
  const AVG_HELP: Record<Avg, string> = {
    raw: "Plain average of each bag's rating, all groups ranked together.",
    min3: 'Leaves out coffees with under 4 rated brews and groups under 3 bags or 10 rated brews.',
    k2: "Adjusted for confidence: pulled toward your overall average until a group has about 2 bags, so 1–2 bag groups can't top the board (light).",
    adjusted: 'Adjusted for confidence: pulled strongly toward your overall average until a group has about 5 bags (strong).',
    best: 'The highest single brew rating in the group.',
    'best-k2': 'Best single brew, adjusted for confidence: pulled toward your overall average until the group has hit that score about 2 times (light).',
    'best-k5': 'Best single brew, adjusted for confidence: pulled toward your overall average until the group has hit that score about 5 times (strong).'
  };
  // How scores work dialog: examples assume an overall average of 7.0 and use the real formulas.
  const HOW: { group: string; items: { id: Avg; text: string; eg: string }[] }[] = [
    { group: 'Average', items: [
      { id: 'raw', text: "The plain average of each bag's rating (a bag counts once, however many brews).", eg: 'Bags at 9 and 8 → 8.5. A one-bag roaster at 9.5 ranks above them.' },
      { id: 'min3', text: 'The same average, but rows marked Low confidence are left out: coffees with under 4 rated brews, groups under 3 bags or 10 rated brews.', eg: 'A one-bag roaster at 9.5 is not listed; a 3-bag, 12-brew roaster at 8 is.' },
      { id: 'k2', text: 'Adjusted for confidence: the average pulled toward your overall average, as if every group had 2 extra bags at that average (light).', eg: 'One bag at 10 → 8.0. Four bags at 9 → 8.3.' },
      { id: 'adjusted', text: 'The same, with 5 extra bags (strong): small groups stay close to your overall average.', eg: 'One bag at 10 → 7.5. Four bags at 9 → 7.9.' }
    ] },
    { group: 'Peak', items: [
      { id: 'best', text: 'The highest single brew rating in the group.', eg: 'Brews of 8, 9 and 10 → 10.' },
      { id: 'best-k2', text: 'The best brew, pulled toward your overall average as if you had 2 extra brews at that average. A score hit repeatedly counts for more than a single lucky one.', eg: 'One 10 → 8.0. Four 9.5s → 8.7.' },
      { id: 'best-k5', text: 'The same, with 5 extra brews.', eg: 'One 10 → 7.5. Four 9.5s → 8.1.' }
    ] }
  ];
  let help = $state<HTMLDialogElement>();
  const bagOnly = (b: Board) => (rank === 'spend' || rank === 'ppg') && !BAG_BOARDS.includes(b);
  const emptyText = () => (rank === 'spend' || rank === 'ppg' ? 'No bags bought in this period.' : 'No brews in this period.');
</script>

<div class="rank-bar">
  <div class="form-field">
    <span><button class="mode-tip-button" popovertarget="tip-rank" aria-describedby="tip-rank"><span class="tip-text">Rank by</span><Icon name="question" /></button></span>
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
    <TipBody tip={{ title: 'Rank by', lines: RANKS.map((r) => `${RANK_LABEL[r]}: ${RANK_HELP[r][0].toLowerCase()}${RANK_HELP[r].slice(1)}`) }} />
  </div>
  {#if rank === 'rating'}
    <div class="mode-tip" id="tip-score" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Score', lines: ['How each score is worked out.', 'Click for the full explanation.'] }} /></div>
    <div class="form-field">
      <span><button class="mode-tip-button" aria-haspopup="dialog" data-tip="tip-score" onclick={() => help?.showModal()}><span class="tip-text">Score</span><Icon name="question" /></button></span>
      <select aria-label="Score" value={avg} onchange={(e) => choose({ avg: e.currentTarget.value as Avg })}>
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
    {#each HOW as g (g.group)}
      <h3>{g.group}</h3>
      {#each g.items as it (it.id)}
        <p>
          <b>{AVG_LABEL[it.id]}{it.id === DEFAULT_AVG ? ' (default)' : ''}.</b>
          {it.text} <span class="eg">{it.eg}</span>
        </p>
      {/each}
    {/each}
    <p class="eg">Examples assume your overall average is 7.0.</p>
  </div>
  <footer><button class="button" onclick={() => help?.close()}>Close</button></footer>
</dialog>

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
            <li class="board-row bar" class:small-sample={r.sample?.small} style:--share={rows[0].value > 0 ? Math.max(0, r.value / rows[0].value) : 0}>
              <span class="rank">{i + 1}</span>
              <span class="who">
                {#if r.href}<a href={r.href}>{r.label}</a>{:else}<span class="name">{r.label}</span>{/if}
                <span class="who-line"><small>{detail(r)}</small>{#if r.sample?.small}<SampleNote s={r.sample} />{/if}</span>
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
  /* .mode-tip / .mode-tip-button base styles are :global() in +page.svelte. */
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
  /* Cards in a band share one height: fixed rows, placeholders for empty slots, a fixed
     footer. Only an expanded card grows (align-items: start keeps its neighbors put). */
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
  /* viewport 1000px (no rail; the rail narrows it) */
  @container insights (min-width: 968px) {
    .band-6 {
      --cols: 3;
    }
  }
  .board {
    margin: 0;
  }
  /* The row rules (.board-rows, .board-row, .rank, .who, .val) are :global() in +page.svelte,
     shared with the lab tabs. */
  .board-note {
    min-height: calc(var(--rows) * var(--row-h));
    margin: 0;
    padding: 0;
  }
  .board-note {
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--color-text-muted);
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
      flex: 1 1 100%;
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
