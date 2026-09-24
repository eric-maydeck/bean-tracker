<script lang="ts">
  import FilterEditor from './FilterEditor.svelte';
  import { chipLabel, chipTitle, upsertFilter, type ColumnKey, type Filter } from '$lib/coffeeFilters';
  import type { CoffeeWithComputed } from '$lib/server/urgency';

  let {
    filters = $bindable(),
    coffees
  }: {
    filters: Filter[];
    coffees: CoffeeWithComputed[]; // current status tab, for the "Is any of" counts
  } = $props();

  // 'new' = the "+ Filter" picker; a column key = that chip's editor.
  let open = $state<'new' | ColumnKey | null>(null);

  function apply(f: Filter) {
    filters = upsertFilter(filters, f);
    open = null;
  }

  function remove(key: ColumnKey) {
    filters = filters.filter((f) => f.column !== key);
    open = null;
  }
</script>

<!-- Both roots sit inside the page's .search-row; .filter-chips wraps onto its own line. -->
<div class="filter-anchor">
  <button
    class="button button-secondary"
    type="button"
    aria-expanded={open === 'new'}
    onclick={() => (open = open === 'new' ? null : 'new')}>+ Filter</button
  >
  {#if open === 'new'}
    <FilterEditor {coffees} {filters} onapply={apply} onclear={remove} onclose={() => (open = null)} />
  {/if}
</div>

{#if filters.length}
  <div class="filter-chips">
    {#each filters as f (f.column)}
      <span class="filter-chip-wrap">
        <span class="filter-chip">
          <button
            type="button"
            class="filter-chip-label"
            title={chipTitle(f)}
            aria-label={chipTitle(f)}
            aria-expanded={open === f.column}
            onclick={() => (open = f.column)}>{chipLabel(f)}</button
          >
          <button
            type="button"
            class="filter-chip-remove"
            title="Remove filter"
            aria-label={`Remove filter: ${chipTitle(f)}`}
            onclick={() => remove(f.column)}>✕</button
          >
        </span>
        {#if open === f.column}
          <FilterEditor {coffees} {filters} start={f.column} onapply={apply} onclear={remove} onclose={() => (open = null)} />
        {/if}
      </span>
    {/each}
    <button
      type="button"
      class="filter-clear-all"
      onclick={() => {
        filters = [];
        open = null;
      }}>Clear all</button
    >
  </div>
{/if}
