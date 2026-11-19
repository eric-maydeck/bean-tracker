<script lang="ts">
  import { truncTip } from '#lib/components/labelTip.ts';
  import type { PickCoffee, Slot } from '#lib/pick/types.ts';

  let { custom = false, board, byId, success, fail, rolled }: { custom?: boolean; board: Slot[]; byId: Map<number, PickCoffee>; success: PickCoffee[]; fail: PickCoffee[]; rolled: number | null } = $props();

  const join = (cs: PickCoffee[], f: (c: PickCoffee) => string) => cs.map(f).join(', ');
  const coffeeOf = (s: Slot): PickCoffee[] => (s.kind === 'coffee' ? [byId.get(s.coffeeId)].filter((c): c is PickCoffee => !!c) : s.kind === 'success' ? success : s.kind === 'fail' ? fail : []);
  const label = (s: Slot) => (s.kind === 'crossed' ? 'Roll again' : join(coffeeOf(s), (c) => c.name));
</script>

<!-- 1 to 10 and 11 to 20 side by side where there is room (a 900px container query, so no first-paint flip); otherwise they stack and read as one table, 1 to 20 -->
<div class="halves-wrap"><div class="halves">
  {#each [board.slice(0, 10), board.slice(10)] as half, h (h)}
    <table class="data-table board" aria-label={h ? 'D20 board, 11 to 20' : 'D20 board, 1 to 10'}>
      <colgroup><col class="c-n" /><col class="c-name" />{#if !custom}<col class="c-roaster" />{/if}</colgroup>
      <thead><tr><th scope="col"><span class="hd">#</span></th><th scope="col"><span class="hd">Coffee</span></th>{#if !custom}<th scope="col"><span class="hd">Roaster</span></th>{/if}</tr></thead>
      <tbody>
        {#each half as s (s.n)}
          <tr class={s.kind} class:rolled={rolled === s.n} aria-label={`${s.n}: ${label(s)}`}>
            <td class="n">{s.n}</td>
            <td class="name"><div class="cell">{#if s.kind === 'success'}<span class="badge badge-warm">Crit success</span>{:else if s.kind === 'fail'}<span class="badge badge-urgent">Crit fail</span>{/if}<span class="txt" use:truncTip>{label(s)}</span></div></td>
            {#if !custom}<td class="roaster"><span class="txt" use:truncTip>{join(coffeeOf(s), (c) => c.roaster)}</span></td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/each}
</div></div>

<style>
  .halves-wrap { container-type: inline-size; }
  .halves { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; }
  /* stacked: one table, one visible header; the second keeps its column headers for a screen reader (sr-only text in a zero-height row) */
  .halves > :global(.board + .board th) { padding: 0; border: 0; height: 0; line-height: 0; }
  .halves > :global(.board + .board .hd) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  @container (min-width: 900px) {
    .halves { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-5); }
    .halves > :global(.board + .board th) { padding: 0.2rem var(--space-2); border-bottom: 1px solid var(--color-border); height: auto; line-height: inherit; }
    .halves > :global(.board + .board .hd) { position: static; width: auto; height: auto; overflow: visible; clip: auto; }
  }
  .board { font-size: 0.85rem; table-layout: fixed; }
  table.data-table.board { table-layout: fixed; min-width: 0; } /* a phone: the site's 700px table minimum would scroll the page sideways; the cells ellipsize */
  .board :global(th), .board :global(td) { padding: 0.2rem var(--space-2); }
  .board tbody tr:nth-child(even) { background: color-mix(in srgb, var(--color-text-muted) 7%, transparent); }
  .c-n { width: 2.2rem; }
  .c-roaster { width: 38%; }
  .n { font-variant-numeric: tabular-nums; font-weight: 600; }
  /* the cell never overflows: a name or roaster ellipsizes inside it (full text in the tip) */
  .cell { display: flex; align-items: center; min-width: 0; }
  .txt { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name, .roaster { overflow: hidden; }
  .name .badge { flex: none; }
  .name .badge { margin-right: var(--space-2); font-size: 0.7rem; padding: 0.05rem 0.4rem; }
  tr.success { background: #3b2d0c !important; color: #ffe08a; }
  tr.fail { background: #1a0000 !important; color: #f3b4b4; }
  tr.crossed { color: var(--color-text-muted); text-decoration: line-through; opacity: 0.7; }
  tr.rolled { background: #f6eee2 !important; color: #2b211b; box-shadow: inset 0 0 0 2px #e6a862, 0 0 10px rgba(230, 168, 98, 0.6); }
</style>
