<script lang="ts">
  import type { PickCoffee, Slot } from '#lib/pick/types.ts';

  let { board, byId, success, fail, rolled }: { board: Slot[]; byId: Map<number, PickCoffee>; success: PickCoffee[]; fail: PickCoffee[]; rolled: number | null } = $props();

  let width = $state(0);
  const two = $derived(width >= 900);
  const join = (cs: PickCoffee[], f: (c: PickCoffee) => string) => cs.map(f).join(', ');
  const coffeeOf = (s: Slot): PickCoffee[] => (s.kind === 'coffee' ? [byId.get(s.coffeeId)].filter((c): c is PickCoffee => !!c) : s.kind === 'success' ? success : s.kind === 'fail' ? fail : []);
  const label = (s: Slot) => (s.kind === 'crossed' ? 'Roll again' : join(coffeeOf(s), (c) => c.name));
</script>

<!-- 1 to 10 and 11 to 20 side by side where there is room (900px of width); otherwise one table, 1 to 20 -->
<div class="halves" bind:clientWidth={width}>
  {#each two ? [board.slice(0, 10), board.slice(10)] : [board] as half, h (h)}
    <table class="data-table board" aria-label={two ? (h ? 'D20 board, 11 to 20' : 'D20 board, 1 to 10') : 'D20 board'}>
      <colgroup><col class="c-n" /><col class="c-name" /><col class="c-roaster" /></colgroup>
      <thead><tr><th scope="col">#</th><th scope="col">Coffee</th><th scope="col">Roaster</th></tr></thead>
      <tbody>
        {#each half as s (s.n)}
          <tr class={s.kind} class:rolled={rolled === s.n} aria-label={`${s.n}: ${label(s)}`}>
            <td class="n">{s.n}</td>
            <td class="name">{#if s.kind === 'success'}<span class="badge badge-warm">Crit success</span>{:else if s.kind === 'fail'}<span class="badge badge-urgent">Crit fail</span>{/if}<span class="txt">{label(s)}</span></td>
            <td class="roaster">{join(coffeeOf(s), (c) => c.roaster)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/each}
</div>

<style>
  .halves { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: var(--space-5); align-items: start; }
  .board { font-size: 0.85rem; table-layout: fixed; }
  .board :global(th), .board :global(td) { padding: 0.2rem var(--space-2); }
  .board tbody tr:nth-child(even) { background: color-mix(in srgb, var(--color-text-muted) 7%, transparent); }
  .c-n { width: 2.2rem; }
  .c-roaster { width: 38%; }
  .n { font-variant-numeric: tabular-nums; font-weight: 600; }
  .name, .roaster { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name .badge { margin-right: var(--space-2); font-size: 0.7rem; padding: 0.05rem 0.4rem; }
  tr.success { background: #3b2d0c !important; color: #ffe08a; }
  tr.fail { background: #1a0000 !important; color: #f3b4b4; }
  tr.crossed { color: var(--color-text-muted); text-decoration: line-through; opacity: 0.7; }
  tr.rolled { background: #f6eee2 !important; color: #2b211b; box-shadow: inset 0 0 0 2px #e6a862, 0 0 10px rgba(230, 168, 98, 0.6); }
</style>
