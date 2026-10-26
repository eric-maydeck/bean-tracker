<script lang="ts">
  import type { InsightsUrlState, RcCol, Top } from '$lib/insightsUrl';
  import { RC_COLS } from '$lib/insightsUrl';
  import { usd, wholeUsd } from '$lib/money';
  import { likeGap, deltaInk } from '$lib/components/deltaColor';
  import { countText } from '$lib/sample';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import ShowMore from './ShowMore.svelte';
  import { NATURAL_DIR, sortRc, type RcRow } from './reportCard';

  let { rows, sort, dir, top, choose, link }: {
    rows: readonly RcRow[]; sort?: RcCol; dir?: 'asc' | 'desc'; top?: Top;
    choose: (c: InsightsUrlState) => void; link: (href: string) => string;
  } = $props();

  const LABEL: Record<RcCol, string> = { roaster: 'Roaster', bags: 'Bags', spent: 'Spent', ppg: '$/g', rating: 'Rating', like: 'vs like coffees', last: 'Last bought' };
  const col = $derived(sort ?? 'bags');
  const way = $derived(dir ?? NATURAL_DIR[col]);
  const sorted = $derived(sortRc(rows, col, way));
  const shown = $derived(sorted.slice(0, top ?? 10));
  const whole = $derived(wholeUsd(rows.map((r) => r.spent)));
  const bagsText = (n: number) => `${countText(n)} bag${n === 1 ? '' : 's'}`;

  // Bare URL for the defaults (Bags, its natural direction).
  const set = (c: RcCol, d: 'asc' | 'desc') => choose({ rcSort: c === 'bags' ? undefined : c, rcDir: d === NATURAL_DIR[c] ? undefined : d });
  const press = (c: RcCol) => set(c, c === col ? (way === 'asc' ? 'desc' : 'asc') : NATURAL_DIR[c]);
</script>

{#snippet na()}<span class="na" aria-hidden="true">—</span><span class="sr-only">none</span>{/snippet}
{#snippet rating(r: RcRow)}
  {#if r.rating === null}{@render na()}{:else}<span class:small-sample={r.ratingSample?.small}>{r.rating.toFixed(1)}</span>{#if r.ratingSample?.small}<SampleNote s={r.ratingSample} />{/if}{/if}
{/snippet}
{#snippet like(r: RcRow)}
  {#if r.like === null}{@render na()}{:else}<span class:small-sample={r.likeSample?.small}><span class={r.likeSample?.small ? '' : deltaInk(r.like)}>{likeGap(r.like)}</span></span>{#if r.likeSample?.small}<SampleNote s={r.likeSample} />{/if}{/if}
{/snippet}

<div class="rc">
  <div class="rc-table">
    <table class="data-table compact">
      <!-- Fixed widths: a sort reorders rows, never resizes a column. -->
      <colgroup>
        <col style:width="20%" /><col style:width="8%" /><col style:width="11%" /><col style:width="11%" /><col style:width="18%" /><col style:width="18%" /><col style:width="14%" />
      </colgroup>
      <thead>
        <tr>
          {#each RC_COLS as c (c)}
            <th class:num={c !== 'roaster' && c !== 'last'} aria-sort={c === col ? (way === 'asc' ? 'ascending' : 'descending') : undefined}>
              <button class="sort-button" onclick={() => press(c)}>{LABEL[c]}<span class="sort-indicator">{c === col ? (way === 'asc' ? '▲' : '▼') : ''}</span></button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each shown as r (r.roaster)}
          <tr>
            <td class="who"><a href={link(r.href)}>{r.roaster}</a></td>
            <td class="num">{countText(r.bags)}</td>
            <td class="num">{usd(r.spent, whole)}</td>
            <td class="num">{#if r.ppg === null}{@render na()}{:else}{usd(r.ppg)}/g{/if}</td>
            <td class="num"><span class="cell">{@render rating(r)}</span></td>
            <td class="num"><span class="cell">{@render like(r)}</span></td>
            <td>{r.last}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="rc-cards">
    <div class="rc-sort">
      <label class="form-field group-field">
        <span class="sr-only">Sort by</span>
        <select class="ctl-select" aria-label="Sort by" value={col} onchange={(e) => set(e.currentTarget.value as RcCol, NATURAL_DIR[e.currentTarget.value as RcCol])}>
          {#each RC_COLS as c (c)}<option value={c}>Sort by: {LABEL[c]}</option>{/each}
        </select>
      </label>
      <ChartToggle label="Direction" options={[['asc', 'Asc'], ['desc', 'Desc']]} value={way} pick={(d) => set(col, d)} />
    </div>
    <ol class="rc-list">
      {#each shown as r (r.roaster)}
        <li>
          <a class="rc-name" href={link(r.href)}>{r.roaster}</a>
          <small>{bagsText(r.bags)} · {usd(r.spent, whole)} spent</small>
          <span class="rc-line">
            <span>{#if r.ppg === null}{@render na()}{:else}{usd(r.ppg)}/g{/if}</span>
            <span class="cell">{@render rating(r)}</span>
            <span class="cell">{@render like(r)} <small>vs like</small></span>
          </span>
        </li>
      {/each}
    </ol>
  </div>
  <ShowMore count={rows.length} n={top} set={(v) => choose({ rcTop: v })} />
</div>
<p class="chart-note">Spend and $/g by origin, process and roast: <a href={link('/insights?tab=leaderboards&rank=ppg')}>Leaderboards</a></p>

<style>
  .rc {
    container-type: inline-size;
  }
  .rc-cards {
    display: none;
  }
  @container (width < 600px) {
    .rc-table {
      display: none;
    }
    .rc-cards {
      display: block;
    }
  }
  table {
    table-layout: fixed;
    width: 100%;
  }
  .who {
    overflow-wrap: anywhere;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td:last-child {
    white-space: nowrap;
  }
  .cell {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-1) var(--space-2);
  }
  .na {
    display: inline-block;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border) 60%, transparent);
    color: var(--color-text-muted);
  }
  .rc-sort {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .rc-sort label {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }
  .rc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rc-list li {
    display: grid;
    gap: 0.15rem;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }
  .rc-name {
    display: inline-block;
    min-height: 44px;
    line-height: 44px;
    justify-self: start;
    font-weight: 600;
  }
  .rc-list small {
    color: var(--color-text-muted);
  }
  .rc-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    font-variant-numeric: tabular-nums;
  }
</style>
