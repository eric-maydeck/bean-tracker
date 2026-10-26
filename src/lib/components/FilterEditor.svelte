<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import {
    COLUMNS,
    column,
    OPS,
    OP_LABELS,
    DATE_OP_LABELS,
    valueCounts,
    isComplete,
    normalizeFilter,
    QUICK_FILTERS,
    PLAN_ANY,
    PLAN_NONE,
    type PlanOption,
    type PlanValue,
    type Column,
    type ColumnKey,
    type ColumnKind,
    type Filter,
    type Op
  } from '$lib/coffeeFilters';

  // Editor-only label: appends the column's unit (e.g. "Weight (g)") so the
  // number typed is unambiguous. Chips keep the plain short/full name.
  const editorLabel = (c: Column) => (c.unit ? `${c.label} (${c.unit})` : c.label);
  import type { CoffeeWithComputed } from '$lib/server/urgency';

  let {
    coffees,
    filters,
    start = null,
    onapply,
    onclear,
    onclose,
    onquickset,
    onplanset,
    plans = []
  }: {
    coffees: CoffeeWithComputed[]; // current status tab: source of the "Is any of" list
    filters: Filter[]; // active filters: picking a column that has one reopens it
    start?: ColumnKey | null; // open straight into this column (chip click)
    onapply: (f: Filter) => void;
    onclear: (key: ColumnKey) => void;
    onclose: () => void;
    onquickset: (key: ColumnKey, value: boolean | null) => void; // Decaf/Frozen quick filters: applies without closing
    onplanset: (value: PlanValue | null) => void; // the Subscription select: applies without closing
    plans?: PlanOption[];
  } = $props();

  const GROUPS: [string, ColumnKind[]][] = [
    ['Text', ['text']],
    ['Numbers & dates', ['number', 'date', 'window']]
  ];

  let key = $state<ColumnKey | null>(null);
  let mode = $state<'any' | 'contains' | 'includes' | 'overlaps'>('any');
  let values = $state<(string | null)[]>([]);
  let text = $state('');
  let op = $state<Op>('=');
  let a = $state('');
  let b = $state('');
  let search = $state('');

  const existing = (k: ColumnKey) => filters.find((f) => f.column === k) ?? null;

  // Loads the column's current filter (if any) so the editor opens pre-filled.
  // Bool columns (Decaf/Frozen) have no step of their own -- they're the
  // always-visible Quick filters switches on this screen -- so picking one
  // is a no-op; `start` can still name one (chip click) and just leaves the
  // picker screen showing, switches included.
  function pick(k: ColumnKey) {
    if (column(k).kind === 'bool' || column(k).kind === 'plan') return;
    const f = existing(k);
    key = k;
    mode = column(k).kind === 'window' ? 'includes' : 'any';
    values = [];
    text = '';
    op = '=';
    a = '';
    b = '';
    search = '';
    if (f?.mode === 'any') values = [...f.values];
    else if (f?.mode === 'contains') {
      mode = 'contains';
      text = f.text;
    } else if (f?.mode === 'range') {
      op = f.op;
      a = f.a;
      b = f.b;
    } else if (f?.mode === 'includes') a = f.a;
    else if (f?.mode === 'overlaps') {
      mode = 'overlaps';
      a = f.a;
      b = f.b;
    }
  }

  // The editor is mounted fresh each time it opens, so reading `start` once is intended.
  if (start) pick(start);

  let shown = $derived.by(() => {
    if (!key || column(key).kind !== 'text') return [];
    const saved = existing(key);
    const q = search.toLowerCase();
    return valueCounts(coffees, key, saved?.mode === 'any' ? saved.values : []).filter((v) =>
      (v.value ?? '(none)').toLowerCase().includes(q)
    );
  });

  // Yes/No has no draft: its buttons apply directly.
  let draft = $derived.by((): Filter | null => {
    if (!key) return null;
    const kind = column(key).kind;
    if (kind === 'text')
      return mode === 'contains' ? { column: key, mode: 'contains', text } : { column: key, mode: 'any', values };
    if (kind === 'window')
      return mode === 'overlaps' ? { column: key, mode: 'overlaps', a, b } : { column: key, mode: 'includes', a };
    if (kind === 'number' || kind === 'date') return { column: key, mode: 'range', op, a, b: op === 'between' ? b : '' };
    return null;
  });

  function toggle(v: string | null) {
    values = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  }

  function apply(f: Filter) {
    onapply(normalizeFilter($state.snapshot(f) as Filter));
  }

  let editorEl = $state<HTMLDivElement>();

  // A chip near the right edge opens its editor left-anchored (`left: 0`
  // in app.css) so it can run past the viewport at 641-900px. Nudge it
  // left by however many px it overflows by, measured after layout rather
  // than assumed, so it works regardless of which chip opened it. Below
  // 640px the editor is a `position: fixed` bottom sheet already spanning
  // the viewport, so there's nothing to correct.
  function keepInViewport() {
    const el = editorEl;
    if (!el || getComputedStyle(el).position !== 'absolute') return;
    const margin = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; // matches --space-4: 1rem
    const overflow = el.getBoundingClientRect().right - (window.innerWidth - margin);
    if (overflow > 0) el.style.left = `-${overflow}px`;
  }

  // The editor is mounted fresh each time it opens (see the `pick(start)`
  // comment above), so doing this once on mount -- and nowhere else -- is
  // enough; there's no later re-render to repeat it for.
  onMount(() => {
    editorEl?.querySelector<HTMLElement>('button, input, [href], select, textarea')?.focus();
    keepInViewport();
    // Locks the page behind the ≤640px bottom sheet (see app.css); a no-op
    // above 640px. The component is remounted per open/close (FilterBar
    // toggles it via {#if}), so this cleanup runs on every close path and
    // on destroy -- there's no case where the class could be left stuck.
    document.documentElement.classList.add('filter-sheet-open');
    return () => document.documentElement.classList.remove('filter-sheet-open');
  });

  function focusableEls(): HTMLElement[] {
    return Array.from(
      editorEl?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [href], select, textarea') ?? []
    );
  }

  // Tab / Shift+Tab cycle within the editor while it's open.
  function trapFocus(e: KeyboardEvent) {
    const items = focusableEls();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

{#snippet rangeInputs(type: 'date' | 'number', step: string | undefined, singleLabel: string, showSecond: boolean)}
  <input
    class="search-input"
    {type}
    inputmode={type === 'number' ? 'decimal' : undefined}
    step={type === 'number' ? step : undefined}
    aria-label={showSecond ? 'From' : singleLabel}
    value={a}
    oninput={(e) => (a = e.currentTarget.value)}
  />
  {#if showSecond}
    <span aria-hidden="true">–</span>
    <input
      class="search-input"
      {type}
      inputmode={type === 'number' ? 'decimal' : undefined}
      step={type === 'number' ? step : undefined}
      aria-label="To"
      value={b}
      oninput={(e) => (b = e.currentTarget.value)}
    />
  {/if}
{/snippet}

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
    else if (e.key === 'Tab') trapFocus(e);
  }}
/>

<div class="filter-backdrop" role="presentation" onclick={onclose}></div>
<div
  bind:this={editorEl}
  class="filter-editor"
  role="dialog"
  aria-modal="true"
  aria-label={key ? `Filter by ${editorLabel(column(key))}` : 'Add a filter'}
>
  {#if !key}
    {#each GROUPS as [title, kinds] (title)}
      <p class="eyebrow">{title}</p>
      <div class="tab-group filter-columns">
        {#each COLUMNS.filter((c) => kinds.includes(c.kind)) as c (c.key)}
          <button type="button" aria-pressed={filters.some((f) => f.column === c.key)} onclick={() => pick(c.key)}>
            {editorLabel(c)}
          </button>
        {/each}
      </div>
    {/each}

    <p class="eyebrow">Quick filters</p>
    {#each QUICK_FILTERS as qf (qf.column)}
      {@const current = existing(qf.column)}
      <div class="quick-filter">
        <p class="quick-filter-label">{qf.switchLabel}</p>
        <div class="quick-filter-switch" role="radiogroup" aria-label={qf.switchLabel}>
          {#each qf.segments as seg (String(seg.value))}
            {@const checked = seg.value === null ? current === null : current?.mode === 'bool' && current.value === seg.value}
            <button type="button" role="radio" aria-checked={checked} onclick={() => onquickset(qf.column, seg.value)}>
              {seg.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}
    {#if plans.length}
      {@const cur = existing('subscription')}
      <label class="quick-filter">
        <span class="quick-filter-label">Subscription</span>
        <select
          class="search-input quick-filter-select"
          value={cur?.mode === 'plan' ? String(cur.value) : ''}
          onchange={(e) => {
            const v = e.currentTarget.value;
            onplanset(v === '' ? null : v === 'any' || v === 'none' ? v : Number(v));
          }}
        >
          <option value="">All</option>
          <option value="any">{PLAN_ANY}</option>
          <option value="none">{PLAN_NONE}</option>
          {#each plans as p (p.id)}<option value={String(p.id)}>{p.label}</option>{/each}
        </select>
      </label>
    {/if}
  {:else}
    {@const k = key}
    {@const kind = column(k).kind}
    <!-- Back to the filter list; nothing is applied or cleared (the editor's state is not URL state, like the list). -->
    <div class="filter-editor-head">
      <button class="icon-button" type="button" aria-label="Back to filters" onclick={() => (key = null)}><Icon name="arrow-left" /></button>
      <h3 class="filter-editor-title">{editorLabel(column(k))}</h3>
    </div>

    {#if kind === 'text'}
      <div class="form-field group-field">
        <span>Match</span>
        <div class="tab-group" role="group" aria-label="Match">
          <button type="button" aria-pressed={mode === 'any'} onclick={() => (mode = 'any')}>Is any of</button>
          <button type="button" aria-pressed={mode === 'contains'} onclick={() => (mode = 'contains')}>Contains</button>
        </div>
      </div>
      {#if mode === 'contains'}
        <input class="search-input" type="text" placeholder="Text to match" aria-label="Contains" bind:value={text} />
      {:else}
        <input class="search-input" type="search" placeholder="Search values" aria-label="Search values" bind:value={search} />
        <div class="filter-values">
          {#each shown as v (v.value)}
            <label class="filter-value">
              <input type="checkbox" checked={values.includes(v.value)} onchange={() => toggle(v.value)} />
              <span>{v.value ?? '(none)'}</span>
              <span class="filter-value-count">{v.count}</span>
            </label>
          {:else}
            <p class="text-muted">No values</p>
          {/each}
        </div>
      {/if}
    {:else if kind === 'window'}
      <div class="form-field group-field">
        <span>Match</span>
        <div class="tab-group" role="group" aria-label="Match">
          <button type="button" aria-pressed={mode === 'includes'} onclick={() => (mode = 'includes')}>includes</button>
          <button type="button" aria-pressed={mode === 'overlaps'} onclick={() => (mode = 'overlaps')}>overlaps</button>
        </div>
      </div>
      <div class="filter-inputs">
        {@render rangeInputs('date', undefined, 'Date', mode === 'overlaps')}
      </div>
    {:else}
      <div class="form-field group-field">
        <span>Match</span>
        <div class="tab-group" role="group" aria-label="Match">
          {#each OPS as o (o)}
            <button type="button" aria-pressed={op === o} onclick={() => (op = o)}>
              {kind === 'date' ? DATE_OP_LABELS[o] : OP_LABELS[o]}
            </button>
          {/each}
        </div>
      </div>
      <div class="filter-inputs">
        {@render rangeInputs(
          kind === 'date' ? 'date' : 'number',
          k === 'cost_per_gram' ? '0.001' : '1',
          kind === 'date' ? 'Date' : 'Value',
          op === 'between'
        )}
      </div>
    {/if}

    <div class="filter-editor-footer">
      <button class="button button-secondary" type="button" onclick={() => onclear(k)}>Clear</button>
      {#if draft}
        <button class="button" type="button" disabled={!isComplete(draft)} onclick={() => draft && apply(draft)}>Apply</button>
      {/if}
    </div>
  {/if}
</div>
