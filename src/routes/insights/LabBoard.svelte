<script lang="ts">
  import type { LeaderRow } from '$lib/server/insights/lab';
  import { plural, signed } from './DeltaBars.svelte';
  import { STRENGTH } from './Insights.svelte';

  // A lab leaderboard (Water's recipes, Gear's drippers and filters): Leaderboards-style rows, the same-bag
  // delta and its Solid/Hint badge on the right; thin rows muted (global .few). `spread`: show ±SD.
  let { rows, spread = false }: { rows: LeaderRow[]; spread?: boolean } = $props();
</script>

<ol class="board-rows lab-rows">
  {#each rows as r, i (r.label)}
    <li class="board-row" class:few={!r.solid}>
      <span class="rank">{i + 1}</span>
      <span class="who">
        <span class="name">{r.label}</span>
        <small>{[r.months, plural(r.plainBrews, 'brew'), plural(r.plainBags, 'bag'), `avg ${r.adjusted.toFixed(2)}`,
          spread && r.spread !== null ? `±${r.spread.toFixed(2)} SD` : ''].filter(Boolean).join(' · ')}</small>
      </span>
      <span class="lab-badge">
        {#if r.strength === 'solid' || r.strength === 'hint'}<span class="badge hl-badge" class:hint={r.strength === 'hint'}>{STRENGTH[r.strength]}</span>{/if}
      </span>
      <span class="val">{r.delta === null ? 'unpaired' : signed(r.delta)}</span>
    </li>
  {/each}
</ol>

<style>
  /* The delta column lines up down the list: the badge column is fixed, the value right-aligned. */
  .lab-rows .board-row {
    grid-template-columns: 1.75rem minmax(0, 1fr) 3.5rem 4.25rem;
  }
  .lab-badge {
    justify-self: end;
  }
  .val {
    text-align: right;
  }
  .hl-badge.hint {
    background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
    color: var(--color-text-muted);
  }
</style>
