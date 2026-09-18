<script lang="ts">
  import { browser } from '$app/environment';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import RoastBeans from '$lib/components/RoastBeans.svelte';
  import { invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';

  let { data, form } = $props();

  let roastDegrees = $derived(new Map(data.roastLevels.map((r) => [r.roast_level, r.degrees_of_roast])));
  function degreesFor(roastLevel: string | null): number {
    if (!roastLevel) return 0;
    return roastDegrees.get(roastLevel) ?? 0;
  }
  let query = $state('');
  let filter = $state<'backlog' | 'open' | 'archive' | 'all'>('backlog');
  let view = $state<'cards' | 'list'>('list');

  let editMode = $state(false);
  let expandedId = $state<number | 'new' | null>(null);

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

  $effect(() => {
    if (!browser) return;
    try {
      const savedView = localStorage.getItem('bean-tracker-view');
      if (savedView === 'cards' || savedView === 'list') view = savedView;
      const savedFilter = localStorage.getItem('bean-tracker-filter');
      if (
        savedFilter === 'backlog' ||
        savedFilter === 'open' ||
        savedFilter === 'archive' ||
        savedFilter === 'all'
      ) {
        filter = savedFilter;
      }
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
    }
  });

  function setView(next: 'cards' | 'list') {
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
    sortKey = null;
    sortDir = 'asc';
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
      `${c.roaster} ${c.coffee_name} ${c.origin ?? ''} ${c.roast_level ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  );

  type SortKey =
    | 'roaster'
    | 'coffee_name'
    | 'origin'
    | 'roast_level'
    | 'cost_per_gram'
    | 'amount_g'
    | 'roast_date'
    | 'urgency';
  let sortKey = $state<SortKey | null>(null);
  let sortDir = $state<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
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
      case 'cost_per_gram':
        return c.cost_per_gram ?? -Infinity;
      case 'amount_g':
        return c.amount_g ?? -Infinity;
      case 'roast_date':
        return c.roast_date ?? '';
      case 'urgency':
        return typeof c.urgency_rating === 'number' ? c.urgency_rating : -Infinity;
    }
  }

  let sortedCoffees = $derived.by(() => {
    if (!sortKey) return coffees;
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
    <form method="POST" action="?/restore" use:enhance>
      <input type="hidden" name="id" value={coffee.id} />
      <button class="button button-secondary" type="submit">Restore</button>
    </form>
  {:else}
    <button class="button button-secondary" type="button" onclick={() => toggleEdit(coffee.id)}>
      {expandedId === coffee.id ? 'Cancel' : 'Edit'}
    </button>
    {#if coffee.status === 'backlog'}
      {#if coffee.frozen_start_date && !coffee.frozen_end_date}
        <form method="POST" action="?/thaw" use:enhance>
          <input type="hidden" name="id" value={coffee.id} />
          <button class="button button-secondary" type="submit">Thaw</button>
        </form>
      {:else}
        <form method="POST" action="?/freeze" use:enhance>
          <input type="hidden" name="id" value={coffee.id} />
          <button class="button button-secondary" type="submit">Freeze</button>
        </form>
      {/if}
      <form method="POST" action="?/open" use:enhance>
        <input type="hidden" name="id" value={coffee.id} />
        <button class="button" type="submit">Open</button>
      </form>
    {:else if coffee.status === 'open'}
      <form method="POST" action="?/unopen" use:enhance>
        <input type="hidden" name="id" value={coffee.id} />
        <button class="button button-secondary" type="submit">Unopen</button>
      </form>
    {/if}
    <form method="POST" action="?/archive" use:enhance>
      <input type="hidden" name="id" value={coffee.id} />
      <button class="button button-secondary" type="submit">Archive</button>
    </form>
    <form method="POST" action="?/delete" use:enhance>
      <input type="hidden" name="id" value={coffee.id} />
      <button
        class="button button-danger"
        type="submit"
        onclick={(e) => {
          if (!confirm(`Delete ${coffee.coffee_name} by ${coffee.roaster}? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        Delete
      </button>
    </form>
  {/if}
{/snippet}

{#snippet expandedForm(coffee)}
  <CoffeeForm
    {coffee}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    origins={data.origins}
    processingMethods={data.processingMethods}
    formError={form?.error ?? null}
    oncancel={closeExpanded}
    onsuccess={closeExpanded}
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
    <button aria-pressed={view === 'list'} onclick={() => setView('list')}>List</button>
    <button aria-pressed={view === 'cards'} onclick={() => setView('cards')}>Cards</button>
  </div>
</div>

<div class="search-row">
  <input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={query} />
  <button class="button button-secondary" type="button" onclick={resetView}>Reset</button>
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
  {#if data.isAdmin}
    <button
      class="button button-secondary"
      type="button"
      aria-pressed={editMode}
      onclick={() => {
        editMode = !editMode;
        expandedId = null;
      }}
    >
      {editMode ? 'Done editing' : 'Edit'}
    </button>
  {/if}
</div>

{#if editMode}
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
      {#if editMode && data.isAdmin}
        <div class="card">
          {#if expandedId === coffee.id}
            {@render expandedForm(coffee)}
          {:else}
            {#if coffee.image_url}
              <img src={coffee.image_url} alt="" class="card-thumb" />
            {/if}
            <h2><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></h2>
            <p class="text-muted">{coffee.roaster}</p>
            <p>{coffee.origin ?? 'Origin unknown'}</p>
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
          <p>{coffee.origin ?? 'Origin unknown'}</p>
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
          {#if coffee.status === 'open' && coffee.drink_after && coffee.drink_before}
            <p class="text-muted">Rest window: {coffee.drink_after} – {coffee.drink_before}</p>
          {/if}
          {#if coffee.status === 'archive'}
            <span class="badge badge-fresh">Archive</span>
          {:else if coffee.status === 'open'}
            <span class="badge badge-warm">Open</span>
          {:else}
            <span class="badge badge-neutral">Backlog</span>
          {/if}
        </a>
      {/if}
    {/each}
  </section>
{:else}
  <div class="table-scroll">
    <table class="data-table compact">
      <colgroup>
        <col style="width: 8%" />
        <col style="width: 15%" />
        <col style="width: 8%" />
        <col style="width: 8%" />
        <col style="width: 9%" />
        <col style="width: 5%" />
        <col style="width: 5%" />
        <col style="width: 8%" />
        <col style="width: 6%" />
        <col style="width: 5%" />
        <col style="width: 10%" />
        {#if editMode && data.isAdmin}
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
          <th>Processing</th>
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
          <th>Rest window</th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('urgency')}>
              Urgency
              <span class="sort-indicator"
                >{sortKey === 'urgency' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>Status</th>
          {#if editMode && data.isAdmin}
            <th>Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each sortedCoffees as coffee (coffee.id)}
          <tr>
            <td>{coffee.roaster}</td>
            <td><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></td>
            <td>{coffee.origin ?? '—'}</td>
            <td>
              <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            </td>
            <td>{coffee.processing ?? '—'}</td>
            <td>{coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}` : '—'}</td>
            <td>{coffee.amount_g != null ? `${coffee.amount_g}g` : '—'}</td>
            <td>
              {coffee.roast_date ?? '—'}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </td>
            <td>
              {#if coffee.status === 'open' && coffee.drink_after && coffee.drink_before}
                {coffee.drink_after} – {coffee.drink_before}
              {:else}
                —
              {/if}
            </td>
            <td style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </td>
            <td>
              {#if coffee.status === 'archive'}
                <span class="badge badge-fresh">Archive</span>
              {:else if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
            </td>
            {#if editMode && data.isAdmin}
              <td>
                <div class="action-buttons">
                  {@render adminActions(coffee)}
                </div>
              </td>
            {/if}
          </tr>
          {#if editMode && expandedId === coffee.id}
            <tr>
              <td colspan={data.isAdmin ? 12 : 11}>
                {@render expandedForm(coffee)}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
