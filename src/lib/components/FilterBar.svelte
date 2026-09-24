<script lang="ts">
  import { tick } from 'svelte';
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
  let filterBtnEl = $state<HTMLButtonElement>();
  // The element that opened the current editor, so closing it can return
  // focus there. Not $state: it's only read at close time, in the same
  // tick `open` is cleared, so it doesn't need to drive rendering.
  let triggerEl: HTMLElement | null = null;

  // Every way the editor closes (Esc, backdrop, Apply, Yes/No, Clear, the
  // "+ Filter" toggle) routes through here so focus always returns to
  // whatever opened it -- or to "+ Filter" if that chip is now gone (Clear).
  async function close() {
    open = null;
    const opener = triggerEl;
    triggerEl = null;
    await tick(); // let Svelte remove a Clear'd chip before checking isConnected
    const target = opener?.isConnected ? opener : filterBtnEl;
    target?.focus();
  }

  function openEditor(key: 'new' | ColumnKey, trigger: HTMLElement) {
    triggerEl = trigger;
    open = key;
  }

  function apply(f: Filter) {
    filters = upsertFilter(filters, f);
    close();
  }

  function remove(key: ColumnKey) {
    filters = filters.filter((f) => f.column !== key);
    // Only steal focus when this removal is actually closing that column's
    // own open editor (its Clear button, or its chip's remove button while
    // open) -- not when the chip removed isn't the one currently open.
    if (open === key) close();
    else open = null;
  }
</script>

<!-- Both roots sit inside the page's .search-row; .filter-chips wraps onto its own line. -->
<div class="filter-anchor">
  <button
    bind:this={filterBtnEl}
    class="button button-secondary"
    type="button"
    aria-expanded={open === 'new'}
    onclick={(e) => (open === 'new' ? close() : openEditor('new', e.currentTarget))}>+ Filter</button
  >
  {#if open === 'new'}
    <FilterEditor {coffees} {filters} onapply={apply} onclear={remove} onclose={close} />
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
            aria-describedby="filter-chip-desc-{f.column}"
            aria-expanded={open === f.column}
            onclick={(e) => openEditor(f.column, e.currentTarget)}>{chipLabel(f)}</button
          >
          <span id="filter-chip-desc-{f.column}" class="sr-only">{chipTitle(f)}</span>
          <button
            type="button"
            class="filter-chip-remove"
            title="Remove filter"
            aria-label={`Remove filter: ${chipTitle(f)}`}
            onclick={() => remove(f.column)}>✕</button
          >
        </span>
        {#if open === f.column}
          <FilterEditor {coffees} {filters} start={f.column} onapply={apply} onclear={remove} onclose={close} />
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
