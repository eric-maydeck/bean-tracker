<script lang="ts">
  import { labelTip } from '$lib/components/labelTip';
  import { tick } from 'svelte';
  import FilterEditor from './FilterEditor.svelte';
  import { chipLabel, chipTitle, type ColumnKey, type Filter, type PlanOption } from '$lib/coffeeFilters';
  import type { CoffeeWithComputed } from '$lib/server/urgency';

  let {
    filters = $bindable(),
    coffees,
    plans = []
  }: {
    filters: Filter[];
    coffees: CoffeeWithComputed[]; // lit statuses, for the "Is any of" counts
    plans?: PlanOption[]; // the Subscription filter's plans
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

  // The editor's Apply hands over its whole draft: one write, then close.
  function apply(next: Filter[]) {
    filters = next;
    close();
  }

  function remove(key: ColumnKey) {
    filters = filters.filter((f) => f.column !== key);
    // Only steal focus when this removal is actually closing an open editor
    // -- its Clear button, or its chip's remove button while open -- not
    // when a bare chip's X is clicked with no editor open. `open === 'new'`
    // covers Clear from the "+ Filter" flow: that editor's own `open` stays
    // 'new' even after a column is picked inside it, so `key` (the picked
    // column) never equals `open` there.
    if (open === key || open === 'new') close();
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
    <FilterEditor {coffees} {filters} onapply={apply} onclose={close} {plans} />
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
            use:labelTip={chipTitle(f, plans)}
            aria-describedby="filter-chip-desc-{f.column}"
            aria-expanded={open === f.column}
            onclick={(e) => openEditor(f.column, e.currentTarget)}>{chipLabel(f, plans)}</button
          >
          <span id="filter-chip-desc-{f.column}" class="sr-only">{chipTitle(f, plans)}</span>
          <button
            type="button"
            class="filter-chip-remove"
            use:labelTip={'Remove filter'}
            aria-label={`Remove filter: ${chipTitle(f, plans)}`}
            onclick={() => remove(f.column)}>✕</button
          >
        </span>
        {#if open === f.column}
          <FilterEditor
            {coffees}
            {filters}
            start={f.column}
            onapply={apply}
            onclose={close}
            {plans}
          />
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
