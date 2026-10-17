<script lang="ts">
  import { sdFocus, sdBlur } from './DeltaBars.svelte';
  import type { LeaderRow } from '$lib/server/insights/lab';
  import { noMatch, SD_TIP } from './DeltaBars.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { deltaInk, signed } from '$lib/components/deltaColor';
  import { STRENGTH } from './Insights.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';

  // A lab leaderboard (Water's recipes, Gear's drippers and filters): Leaderboards-style rows with the numbers
  // in aligned columns under one header (ui-rules G4): brews · bags · avg rating · SD, then the Likely/Possible
  // badge and the same-bag delta. The sub line keeps non-numeric context only (a recipe's months). Narrow
  // boards drop SD, then bags. Thin rows muted (global .small-sample). `slots`: a side-by-side partner's length; the
  // empty slots are faint placeholders (as on Leaderboards). `noun`: what a row is ("no match" tip).
  let { rows, slots = 0, noun, placeTip }: { rows: LeaderRow[]; slots?: number; noun: string; placeTip: (e: ToggleEvent) => void } = $props();
  const uid = $props.id();
</script>

<div class="lab-board">
  <div class="board-row board-head">
    <span></span><span class="who">{noun[0].toUpperCase() + noun.slice(1)}</span>
    <span class="num">Brews</span><span class="num bags">Bags</span><span class="num">Avg</span><span class="num sd"
      ><button class="mode-tip-button sd-tip" popovertarget="{uid}-sd" aria-describedby="{uid}-sd" onfocus={sdFocus} onblur={sdBlur}><span class="tip-text">SD</span></button></span
    >
    <div class="mode-tip" id="{uid}-sd" popover onbeforetoggle={placeTip}><TipBody tip={SD_TIP} /></div>
    <span></span><span class="num">vs bag</span>
  </div>
  <ol class="board-rows lab-rows">
    {#each rows as r, i (i)}
      <li class="board-row" class:small-sample={r.sample.small}>
        <span class="rank">{i + 1}</span>
        <span class="who">
          <span class="name">{r.label}</span>
          {#if r.months || r.sample.small}<span class="who-line">{#if r.months}<small>{r.months}</small>{/if}{#if r.sample.small}<SampleNote s={r.sample} paired={r.delta !== null} strength={r.strength === 'solid' || r.strength === 'hint' ? r.strength : undefined} />{/if}</span>{/if}
        </span>
        <span class="num">{r.plainBrews}</span>
        <span class="num bags">{r.plainBags}</span>
        <span class="num">{r.adjusted.toFixed(2)}</span>
        <span class="num sd">{r.sd?.toFixed(2) ?? '—'}</span>
        <span class="lab-badge">
          {#if r.strength === 'solid' || r.strength === 'hint'}<span class="badge hl-badge" class:hint={r.strength === 'hint'}>{STRENGTH[r.strength]}</span>{/if}
        </span>
        {#if r.delta === null}
          <span class="val"><button class="mode-tip-button no-match" popovertarget="{uid}-nm-{i}">no match</button></span>
          <div class="mode-tip" id="{uid}-nm-{i}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'No match', lines: [noMatch(noun)] }} /></div>
        {:else}
          <span class="val {deltaInk(r.delta)}">{signed(r.delta)}</span>
        {/if}
      </li>
    {/each}
    {#each { length: Math.max(0, slots - rows.length) }, i (i)}
      <li class="board-row placeholder" aria-hidden="true"><span class="rank">{rows.length + i + 1}</span><span class="who">—</span></li>
    {/each}
  </ol>
</div>

<style>
  .lab-board {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
  }
  /* Rows are --row-h tall, stretching evenly when a paired card is taller (fitPairs). */
  .lab-rows {
    flex: 1 0 auto;
    display: grid;
    grid-auto-rows: minmax(var(--row-h), 1fr);
  }
  .lab-rows .board-row {
    height: auto;
  }
  /* The columns line up down the list and with the header: fixed number columns, the delta right-aligned. */
  .board-row {
    grid-template-columns: 1.5rem minmax(0, 1fr) 2.5rem 2.25rem 2.5rem 2.25rem 3.25rem 3.75rem;
    column-gap: var(--space-2);
  }
  .board-head {
    height: auto;
    padding-bottom: var(--space-1);
    border-top: 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
  .board-head + .board-rows > :global(.board-row:first-child) {
    border-top: 0;
  }
  .num {
    text-align: right;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .board-head .num {
    font-size: inherit;
  }
  /* Narrow boards (a phone, or a half-width card): SD goes first, then bags; delta and brews stay. */
  @container (width < 27rem) {
    .board-row {
      grid-template-columns: 1.5rem minmax(0, 1fr) 2.5rem 2.25rem 2.5rem 3.25rem 3.75rem;
    }
    .sd {
      display: none;
    }
  }
  @container (width < 22rem) {
    .board-row {
      grid-template-columns: 1.5rem minmax(0, 1fr) 2.25rem 2.5rem 3.25rem 3.75rem;
    }
    .bags {
      display: none;
    }
  }
  .placeholder {
    color: var(--color-text-muted);
    opacity: 0.45;
  }
  .lab-badge {
    justify-self: end;
  }
  .val {
    text-align: right;
  }
  /* A delta's color (T4) holds on thin rows too (the muted numbers beside it carry the few-brews cue). */
  .lab-rows .val:global(.ink-better) {
    color: var(--div-high-ink);
  }
  .lab-rows .val:global(.ink-worse) {
    color: var(--div-low-ink);
  }
  .no-match {
    font: inherit;
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--color-text-muted);
    text-decoration: underline dotted;
    white-space: nowrap;
  }
</style>
