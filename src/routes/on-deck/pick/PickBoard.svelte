<script lang="ts">
  import type { Slot } from '#lib/pick/types.ts';

  let { board, names, rolled }: { board: Slot[]; names: Map<number, string>; rolled: number | null } = $props();

  const label = (s: Slot) => (s.kind === 'coffee' ? (names.get(s.coffeeId) ?? '') : s.kind === 'success' ? 'Critical success' : s.kind === 'fail' ? 'Critical fail' : 'Roll again');
</script>

<ol class="board" aria-label="D20 board">
  {#each board as s (s.n)}
    <li class="tile {s.kind}" class:rolled={rolled === s.n} aria-label={`${s.n}: ${label(s)}`}>
      <b>{s.n}</b><span>{label(s)}</span>
    </li>
  {/each}
</ol>

<style>
  .board { list-style: none; margin: var(--space-3) 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: var(--space-2); }
  .tile { display: flex; gap: var(--space-2); align-items: baseline; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); min-width: 0; }
  .tile b { font-variant-numeric: tabular-nums; min-width: 1.5rem; }
  .tile span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; min-width: 0; }
  .success { background: #3b2d0c; border-color: #ffe08a; color: #ffe08a; }
  .fail { background: #1a0000; border-color: #d01c1c; color: #f3b4b4; }
  .crossed { color: var(--color-text-muted); text-decoration: line-through; opacity: 0.7; }
  .tile.rolled { background: #f6eee2; color: #2b211b; border-color: #e6a862; box-shadow: 0 0 0 3px rgba(230, 168, 98, 0.6); }
</style>
