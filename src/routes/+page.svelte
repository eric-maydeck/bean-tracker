<script lang="ts">
  import { browser } from '$app/environment';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import RoastBeans from '$lib/components/RoastBeans.svelte';
  import { invalidateAll, beforeNavigate } from '$app/navigation';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import { defaultViewForWidth } from '$lib/defaultView';
  import { originWithFlag } from '$lib/countryFlags';
  import { stageFieldChange, stageStatusAction, hasPending, type PendingChange } from '$lib/pendingChanges';
  import { SvelteMap } from 'svelte/reactivity';

  let { data, form } = $props();

  let roastDegrees = $derived(new Map(data.roastLevels.map((r) => [r.roast_level, r.degrees_of_roast])));
  function degreesFor(roastLevel: string | null): number {
    if (!roastLevel) return 0;
    return roastDegrees.get(roastLevel) ?? 0;
  }
  let query = $state('');
  let filter = $state<'backlog' | 'open' | 'archive' | 'all'>('backlog');
  let view = $state<'cards' | 'list' | 'compact'>('list');

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);
  let expandedId = $state<number | 'new' | null>(null);

  // Plain `Map` wrapped in `$state()` is NOT deeply reactive in Svelte 5 —
  // `$state()`'s proxy only wraps plain objects/arrays, so in-place
  // `.set()`/`.delete()` calls (as `stageFieldChange`/`stageStatusAction`
  // perform) would silently fail to trigger re-renders. `SvelteMap` from
  // `svelte/reactivity` is the reactive, API-compatible replacement that
  // tracks per-key reads/writes. `commitErrors` doesn't need this — it's
  // always replaced wholesale via reassignment, never mutated in place.
  let pending = $state(new SvelteMap<number, PendingChange>());
  let commitErrors = $state(new Map<number, string>());
  let saving = $state(false);

  async function refresh() {
    await invalidateAll();
  }

  function toggleEdit(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function toggleAdd() {
    expandedId = expandedId === 'new' ? null : 'new';
  }

  function closeExpanded() {
    expandedId = null;
  }

  function enterEditMode() {
    editMode = true;
  }

  async function saveChanges() {
    saving = true;
    const changes = Array.from(pending.entries()).map(([id, change]) => ({ id, ...change }));

    const validateRes = await fetch('/api/coffees/validate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes })
    });
    const { errors } = (await validateRes.json()) as { errors: { id: number; error: string }[] };
    if (errors.length > 0) {
      const newErrors = new Map<number, string>();
      for (const e of errors) newErrors.set(e.id, e.error);
      commitErrors = newErrors;
      // Re-open the first failing row so its inline error is immediately
      // visible, rather than leaving the user to guess which row failed.
      expandedId = errors[0].id;
      saving = false;
      return;
    }

    const commitRes = await fetch('/api/coffees/commit-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes })
    });
    const commitResult = (await commitRes.json()) as { success: boolean; error?: string };
    if (!commitResult.success) {
      // Atomic commit failed as a whole (Decision 5/3) — nothing was
      // partially applied. Not tied to any one row, so it isn't keyed by
      // id; surfaced via commitErrors.get(-1) in the template instead.
      commitErrors = new Map([[-1, commitResult.error ?? 'Save failed']]);
      saving = false;
      return;
    }

    pending = new SvelteMap();
    commitErrors = new Map();
    editMode = false;
    expandedId = null;
    saving = false;
    await invalidateAll();
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitErrors = new Map();
    editMode = false;
    expandedId = null;
  }

  beforeNavigate(({ cancel }) => {
    if (hasPending(pending) && !confirm('You have unsaved changes. Leave without saving?')) {
      cancel();
    }
  });

  $effect(() => {
    if (!browser) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasPending(pending)) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  $effect(() => {
    if (!browser) return;
    try {
      const savedView = localStorage.getItem('bean-tracker-view');
      if (savedView === 'cards' || savedView === 'list' || savedView === 'compact') {
        view = savedView;
      } else {
        view = defaultViewForWidth(window.innerWidth);
      }
      const savedFilter = localStorage.getItem('bean-tracker-filter');
      if (
        savedFilter === 'backlog' ||
        savedFilter === 'open' ||
        savedFilter === 'archive' ||
        savedFilter === 'all'
      ) {
        filter = savedFilter;
      }
      const savedSortKey = localStorage.getItem('bean-tracker-sort-key');
      if (savedSortKey && (SORT_KEYS as readonly string[]).includes(savedSortKey)) {
        sortKey = savedSortKey as SortKey;
      }
      const savedSortDir = localStorage.getItem('bean-tracker-sort-dir');
      if (savedSortDir === 'asc' || savedSortDir === 'desc') {
        sortDir = savedSortDir;
      }
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
    }
  });

  function setView(next: 'cards' | 'list' | 'compact') {
    view = next;
    try {
      localStorage.setItem('bean-tracker-view', next);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  function setFilter(next: 'backlog' | 'open' | 'archive' | 'all') {
    filter = next;
    try {
      localStorage.setItem('bean-tracker-filter', next);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  function resetView() {
    query = '';
    setFilter('backlog');
    setSort(DEFAULT_SORT_KEY, DEFAULT_SORT_DIR);
  }

  let source = $derived(
    filter === 'backlog'
      ? data.backlog
      : filter === 'open'
        ? data.open
        : filter === 'archive'
          ? data.archive
          : [...data.backlog, ...data.open, ...data.archive]
  );

  let coffees = $derived(
    source.filter((c) =>
      `${c.roaster} ${c.coffee_name} ${c.origin ?? ''} ${c.roast_level ?? ''} ${c.decaf ? 'decaf' : 'caffeinated'}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  );

  type SortKey =
    | 'roaster'
    | 'coffee_name'
    | 'origin'
    | 'roast_level'
    | 'decaf'
    | 'processing'
    | 'cost_per_gram'
    | 'amount_g'
    | 'roast_date'
    | 'frozen_start_date'
    | 'frozen_end_date'
    | 'rest_window'
    | 'urgency';
  const SORT_KEYS = [
    'roaster',
    'coffee_name',
    'origin',
    'roast_level',
    'decaf',
    'processing',
    'cost_per_gram',
    'amount_g',
    'roast_date',
    'frozen_start_date',
    'frozen_end_date',
    'rest_window',
    'urgency'
  ] as const satisfies readonly SortKey[];
  const DEFAULT_SORT_KEY: SortKey = 'urgency';
  const DEFAULT_SORT_DIR: 'asc' | 'desc' = 'desc';
  let sortKey = $state<SortKey>(DEFAULT_SORT_KEY);
  let sortDir = $state<'asc' | 'desc'>(DEFAULT_SORT_DIR);

  function setSort(key: SortKey, dir: 'asc' | 'desc') {
    sortKey = key;
    sortDir = dir;
    try {
      localStorage.setItem('bean-tracker-sort-key', key);
      localStorage.setItem('bean-tracker-sort-dir', dir);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key, 'asc');
    }
  }

  function sortValue(c: (typeof coffees)[number], key: SortKey): string | number {
    switch (key) {
      case 'roaster':
        return c.roaster.toLowerCase();
      case 'coffee_name':
        return c.coffee_name.toLowerCase();
      case 'origin':
        return c.origin?.toLowerCase() ?? '';
      case 'roast_level':
        return degreesFor(c.roast_level);
      case 'decaf':
        return c.decaf ? 1 : 0;
      case 'processing':
        return c.processing?.toLowerCase() ?? '';
      case 'cost_per_gram':
        return c.cost_per_gram ?? -Infinity;
      case 'amount_g':
        return c.amount_g ?? -Infinity;
      case 'roast_date':
        return c.roast_date ?? '';
      case 'frozen_start_date':
        return c.frozen_start_date ?? '';
      case 'frozen_end_date':
        return c.frozen_end_date ?? '';
      case 'rest_window':
        return c.drink_after ?? '';
      case 'urgency':
        return typeof c.urgency_rating === 'number' ? c.urgency_rating : -Infinity;
    }
  }

  let sortedCoffees = $derived.by(() => {
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...coffees].sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });
</script>

{#snippet adminActions(coffee)}
  {#if coffee.status === 'archive'}
    <button class="button button-secondary" type="button" onclick={() => toggleEdit(coffee.id)}>
      {expandedId === coffee.id ? 'Cancel' : 'Edit'}
    </button>
    <button
      class="button button-secondary"
      type="button"
      aria-pressed={pending.get(coffee.id)?.statusAction === 'restore'}
      onclick={() => stageStatusAction(pending, coffee.id, 'restore')}
    >
      Restore
    </button>
  {:else}
    <button class="button button-secondary" type="button" onclick={() => toggleEdit(coffee.id)}>
      {expandedId === coffee.id ? 'Cancel' : 'Edit'}
    </button>
    {#if coffee.status === 'backlog'}
      {#if coffee.frozen_start_date && !coffee.frozen_end_date}
        <button
          class="button button-secondary"
          type="button"
          aria-pressed={pending.get(coffee.id)?.statusAction === 'thaw'}
          onclick={() => stageStatusAction(pending, coffee.id, 'thaw')}
        >
          Thaw
        </button>
      {:else}
        <button
          class="button button-secondary"
          type="button"
          aria-pressed={pending.get(coffee.id)?.statusAction === 'freeze'}
          onclick={() => stageStatusAction(pending, coffee.id, 'freeze')}
        >
          Freeze
        </button>
      {/if}
      <button
        class="button"
        type="button"
        aria-pressed={pending.get(coffee.id)?.statusAction === 'open'}
        onclick={() => stageStatusAction(pending, coffee.id, 'open')}
      >
        Open
      </button>
    {:else if coffee.status === 'open'}
      <button
        class="button button-secondary"
        type="button"
        aria-pressed={pending.get(coffee.id)?.statusAction === 'unopen'}
        onclick={() => stageStatusAction(pending, coffee.id, 'unopen')}
      >
        Unopen
      </button>
    {/if}
    <button
      class="button button-secondary"
      type="button"
      aria-pressed={pending.get(coffee.id)?.statusAction === 'archive'}
      onclick={() => stageStatusAction(pending, coffee.id, 'archive')}
    >
      Archive
    </button>
    <button
      class="button button-danger"
      type="button"
      aria-pressed={pending.get(coffee.id)?.statusAction === 'delete'}
      onclick={() => {
        if (confirm(`Delete ${coffee.coffee_name} by ${coffee.roaster}? This cannot be undone.`)) {
          stageStatusAction(pending, coffee.id, 'delete');
        }
      }}
    >
      Delete
    </button>
  {/if}
  {#if pending.has(coffee.id)}
    <span class="badge badge-neutral">
      {pending.get(coffee.id)?.statusAction
        ? `Pending: ${pending.get(coffee.id)?.statusAction}`
        : 'Pending: edited'}
    </span>
  {/if}
{/snippet}

{#snippet expandedForm(coffee)}
  <CoffeeForm
    {coffee}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    origins={data.origins}
    processingMethods={data.processingMethods}
    formError={commitErrors.get(coffee.id) ?? null}
    oncancel={closeExpanded}
    onstage={(fields) => {
      stageFieldChange(pending, coffee.id, fields);
      closeExpanded();
    }}
  />
{/snippet}

<h1>Coffee Collection</h1>

<div class="toolbar">
  <div class="tab-group">
    <button aria-pressed={filter === 'backlog'} onclick={() => setFilter('backlog')}>
      Backlog ({data.backlog.length})
    </button>
    <button aria-pressed={filter === 'open'} onclick={() => setFilter('open')}>
      Open ({data.open.length})
    </button>
    <button aria-pressed={filter === 'archive'} onclick={() => setFilter('archive')}>
      Archive ({data.archive.length})
    </button>
    <button aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>All</button>
  </div>

  <div class="tab-group">
    <button aria-pressed={view === 'compact'} onclick={() => setView('compact')}>Compact</button>
    <button aria-pressed={view === 'list'} onclick={() => setView('list')}>List</button>
    <button aria-pressed={view === 'cards'} onclick={() => setView('cards')}>Cards</button>
  </div>
</div>

<div class="search-row">
  <input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={query} />
  <button class="button button-secondary" type="button" onclick={resetView}>Reset</button>
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
  {#if data.isAdmin}
    {#if editMode}
      <button class="button button-success" type="button" disabled={saving} onclick={saveChanges}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button class="button button-danger" type="button" onclick={discardChanges}>Discard changes</button>
    {:else}
      <button class="button button-secondary" type="button" onclick={enterEditMode}>Edit</button>
    {/if}
  {/if}
  {#if commitErrors.get(-1)}
    <p class="badge badge-urgent">{commitErrors.get(-1)}</p>
  {/if}
</div>

{#if canEdit}
  <div class="search-row">
    <button class="button" type="button" onclick={toggleAdd}>
      {expandedId === 'new' ? 'Cancel add' : '+ Add Coffee'}
    </button>
  </div>
  {#if expandedId === 'new'}
    <CoffeeForm
      roastLevels={data.roastLevels}
      roasters={data.roasters}
      origins={data.origins}
      processingMethods={data.processingMethods}
      formError={form?.error ?? null}
      oncancel={closeExpanded}
      onsuccess={closeExpanded}
    />
  {/if}
{/if}

{#if view === 'cards'}
  <section class="grid">
    {#each coffees as coffee (coffee.id)}
      {#if canEdit}
        <div class="card">
          {#if expandedId === coffee.id}
            {@render expandedForm(coffee)}
          {:else}
            {#if coffee.image_url}
              <img src={coffee.image_url} alt="" class="card-thumb" />
            {/if}
            <h2><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></h2>
            <p class="text-muted">{coffee.roaster}</p>
            <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
            <p class="roast-row">
              <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
              <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
            </p>
            {#if coffee.processing}
              <p class="text-muted">{coffee.processing}</p>
            {/if}
            <p class="text-muted">
              {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : 'Cost unknown'}
              {coffee.amount_g != null ? ` · ${coffee.amount_g}g` : ''}
            </p>
            {#if coffee.roast_date}
              <p class="text-muted">
                Roasted {coffee.roast_date}
                {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
              </p>
            {/if}
            {#if coffee.status === 'archive'}
              <span class="badge badge-fresh">Archive</span>
            {:else if coffee.status === 'open'}
              <span class="badge badge-warm">Open</span>
            {:else}
              <span class="badge badge-neutral">Backlog</span>
            {/if}
            {#if coffee.decaf}
              <span class="badge badge-neutral">Decaf</span>
            {/if}
            <div class="action-buttons">
              {@render adminActions(coffee)}
            </div>
          {/if}
        </div>
      {:else}
        <a class="card" href={`/coffees/${coffee.slug}`}>
          {#if coffee.image_url}
            <img src={coffee.image_url} alt="" class="card-thumb" />
          {/if}
          <h2>{coffee.coffee_name}</h2>
          <p class="text-muted">{coffee.roaster}</p>
          <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
          <p class="roast-row">
            <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
          </p>
          {#if coffee.processing}
            <p class="text-muted">{coffee.processing}</p>
          {/if}
          <p class="text-muted">
            {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : 'Cost unknown'}
            {coffee.amount_g != null ? ` · ${coffee.amount_g}g` : ''}
          </p>
          {#if coffee.roast_date}
            <p class="text-muted">
              Roasted {coffee.roast_date}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </p>
          {/if}
          {#if coffee.drink_after && coffee.drink_before}
            <p class="text-muted">Rest window: {coffee.drink_after} – {coffee.drink_before}</p>
          {/if}
          {#if coffee.status === 'archive'}
            <span class="badge badge-fresh">Archive</span>
          {:else if coffee.status === 'open'}
            <span class="badge badge-warm">Open</span>
          {:else}
            <span class="badge badge-neutral">Backlog</span>
          {/if}
          {#if coffee.decaf}
            <span class="badge badge-neutral">Decaf</span>
          {/if}
        </a>
      {/if}
    {/each}
  </section>
{:else if view === 'compact'}
  <div class="compact-list">
    {#each sortedCoffees as coffee (coffee.id)}
      <div class="compact-row-wrap">
        {#if canEdit}
          <div class="compact-row">
            <div class="compact-row-main">
              <div class="compact-row-title">
                <a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a>
                {#if coffee.decaf}<span class="badge badge-neutral">Decaf</span>{/if}
              </div>
              <div class="compact-row-sub text-muted">
                {coffee.roaster} · {coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}
              </div>
            </div>
            <div class="compact-row-trailing" style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </div>
          </div>
          <div class="action-buttons">
            {@render adminActions(coffee)}
          </div>
          {#if expandedId === coffee.id}
            {@render expandedForm(coffee)}
          {/if}
        {:else}
          <button
            type="button"
            class="compact-row"
            aria-expanded={expandedId === coffee.id}
            onclick={() => toggleEdit(coffee.id)}
          >
            <span class="compact-row-main">
              <span class="compact-row-title">
                {coffee.coffee_name}
                {#if coffee.decaf}<span class="badge badge-neutral">Decaf</span>{/if}
              </span>
              <span class="compact-row-sub text-muted">
                {coffee.roaster} · {coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}
              </span>
            </span>
            <span class="compact-row-trailing" style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </span>
          </button>
          {#if expandedId === coffee.id}
            <div class="compact-row-detail">
              <div class="compact-detail-grid">
                <div><span class="eyebrow">Roast</span><br />{coffee.roast_level ?? '—'}</div>
                <div><span class="eyebrow">Processing</span><br />{coffee.processing ?? '—'}</div>
                <div>
                  <span class="eyebrow">Cost/g · amount</span><br />
                  {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : '—'}{coffee.amount_g != null ? ` · ${coffee.amount_g}g` : ''}
                </div>
                <div>
                  <span class="eyebrow">Roasted</span><br />
                  {coffee.roast_date ?? '—'}{#if coffee.days_since_roast != null} ({coffee.days_since_roast}d ago){/if}
                </div>
                <div>
                  <span class="eyebrow">Rest window</span><br />
                  {#if coffee.drink_after && coffee.drink_before}{coffee.drink_after} – {coffee.drink_before}{:else}—{/if}
                </div>
                <div><span class="eyebrow">Frozen</span><br />{coffee.frozen_start_date ?? '—'}</div>
                <div><span class="eyebrow">Unfrozen</span><br />{coffee.frozen_end_date ?? '—'}</div>
              </div>
              {#if coffee.status === 'archive'}
                <span class="badge badge-fresh">Archive</span>
              {:else if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="table-scroll">
    <table class="data-table compact">
      <colgroup>
        <col style="width: 7%" />
        <col style="width: 13%" />
        <col style="width: 6%" />
        <col style="width: 6%" />
        <col style="width: 5%" />
        <col style="width: 7%" />
        <col style="width: 5%" />
        <col style="width: 5%" />
        <col style="width: 7%" />
        <col style="width: 6%" />
        <col style="width: 6%" />
        <col style="width: 9%" />
        <col style="width: 5%" />
        {#if canEdit}
          <col style="width: 13%" />
        {/if}
      </colgroup>
      <thead>
        <tr>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roaster')}>
              Roaster
              <span class="sort-indicator"
                >{sortKey === 'roaster' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('coffee_name')}>
              Coffee
              <span class="sort-indicator"
                >{sortKey === 'coffee_name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('origin')}>
              Origin
              <span class="sort-indicator"
                >{sortKey === 'origin' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roast_level')}>
              Roast
              <span class="sort-indicator"
                >{sortKey === 'roast_level' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('decaf')}>
              Decaf
              <span class="sort-indicator"
                >{sortKey === 'decaf' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('processing')}>
              Processing
              <span class="sort-indicator"
                >{sortKey === 'processing' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('cost_per_gram')}>
              Cost/g
              <span class="sort-indicator"
                >{sortKey === 'cost_per_gram' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('amount_g')}>
              Amount
              <span class="sort-indicator"
                >{sortKey === 'amount_g' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roast_date')}>
              Roasted
              <span class="sort-indicator"
                >{sortKey === 'roast_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('frozen_start_date')}>
              Frozen
              <span class="sort-indicator"
                >{sortKey === 'frozen_start_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('frozen_end_date')}>
              Unfrozen
              <span class="sort-indicator"
                >{sortKey === 'frozen_end_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('rest_window')}>
              Rest window
              <span class="sort-indicator"
                >{sortKey === 'rest_window' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('urgency')}>
              Urgency
              <span class="sort-indicator"
                >{sortKey === 'urgency' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          {#if canEdit}
            <th>Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each sortedCoffees as coffee (coffee.id)}
          <tr>
            <td>{coffee.roaster}</td>
            <td><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></td>
            <td>{coffee.origin ? originWithFlag(coffee.origin) : '—'}</td>
            <td>
              <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            </td>
            <td>{coffee.decaf ? 'Yes' : 'No'}</td>
            <td>{coffee.processing ?? '—'}</td>
            <td>{coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}` : '—'}</td>
            <td>{coffee.amount_g != null ? `${coffee.amount_g}g` : '—'}</td>
            <td>
              {coffee.roast_date ?? '—'}
              {#if coffee.days_since_roast != null}<br />({coffee.days_since_roast}d ago){/if}
            </td>
            <td>{coffee.frozen_start_date ?? '—'}</td>
            <td>{coffee.frozen_end_date ?? '—'}</td>
            <td>
              {#if coffee.drink_after && coffee.drink_before}
                {coffee.drink_after} –<br />{coffee.drink_before}
              {:else}
                —
              {/if}
            </td>
            <td style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </td>
            {#if canEdit}
              <td>
                <div class="action-buttons">
                  {@render adminActions(coffee)}
                </div>
              </td>
            {/if}
          </tr>
          {#if canEdit && expandedId === coffee.id}
            <tr>
              <td colspan={canEdit ? 14 : 13}>
                {@render expandedForm(coffee)}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
