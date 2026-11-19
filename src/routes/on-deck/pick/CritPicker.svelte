<script lang="ts">
  import type { PickCoffee } from '#lib/pick/types.ts';

  // A searchable multi-select: chips of the picked coffees on top (x removes), a filter box, and a list of checkboxes.
  let { label, coffees, selected, onchange }: { label: string; coffees: PickCoffee[]; selected: number[]; onchange: (ids: number[]) => void } = $props();

  let query = $state('');
  const byName = (a: PickCoffee, b: PickCoffee) => a.name.localeCompare(b.name);
  const sorted = $derived([...coffees].sort(byName));
  const visible = $derived(sorted.filter((c) => `${c.name} ${c.roaster}`.toLowerCase().includes(query.trim().toLowerCase())));
  const picked = $derived(selected.flatMap((id) => coffees.find((c) => c.id === id) ?? []));
  const toggle = (id: number, on: boolean) => onchange(on ? [...selected, id] : selected.filter((x) => x !== id));
  const selectVisible = () => onchange([...new Set([...selected, ...visible.map((c) => c.id)])]);
</script>

<div class="picker" role="group" aria-label={label}>
  <span class="head">{label} <span class="text-muted">({selected.length} picked)</span></span>
  {#if picked.length}
    <ul class="chips" aria-label="Picked coffees">
      {#each picked as c (c.id)}
        <li class="chip">{c.name}<button type="button" aria-label={`Remove ${c.name}`} onclick={() => toggle(c.id, false)}>×</button></li>
      {/each}
    </ul>
  {/if}
  <input type="search" class="search" placeholder="Search coffees or roasters" aria-label={`Search ${label}`} bind:value={query} />
  <div class="bulk">
    <button type="button" class="button button-secondary" onclick={selectVisible} disabled={visible.length === 0}>Select all{query ? ' shown' : ''}</button>
    <button type="button" class="button button-secondary" onclick={() => onchange([])} disabled={selected.length === 0}>Deselect all</button>
  </div>
  <ul class="list">
    {#each visible as c (c.id)}
      <li><label><input type="checkbox" checked={selected.includes(c.id)} onchange={(e) => toggle(c.id, e.currentTarget.checked)} /> <span class="nm">{c.name}</span> <span class="text-muted">{c.roaster}</span></label></li>
    {:else}
      <li class="text-muted">No match.</li>
    {/each}
  </ul>
</div>

<style>
  .picker { display: grid; gap: var(--space-1); min-width: 0; }
  .head { font-weight: 600; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .chip { display: inline-flex; align-items: center; gap: var(--space-1); padding: 0 0 0 var(--space-2); border-radius: 999px; background: color-mix(in srgb, var(--color-accent) 18%, transparent); font-size: 0.85rem; }
  .chip button { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; min-width: 28px; min-height: 28px; }
  .search { width: 100%; min-height: 36px; font: inherit; box-sizing: border-box; }
  .bulk { display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .list { list-style: none; margin: 0; padding: 0; max-height: 12rem; overflow: auto; }
  .list label { display: flex; gap: var(--space-2); align-items: baseline; min-height: 32px; }
  .nm { min-width: 0; }
  @media (max-width: 640px) { .search { min-height: 44px; font-size: 16px; } .chip button { min-width: 44px; min-height: 44px; } .list label { min-height: 44px; align-items: center; } .bulk :global(.button) { min-height: 44px; } }
</style>
