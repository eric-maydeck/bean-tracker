<script lang="ts">
  import { browser } from '$app/environment';

  let { data } = $props();
  let query = $state('');
  let filter = $state<'backlog' | 'open' | 'archive' | 'all'>('backlog');
  let view = $state<'cards' | 'list'>('list');

  $effect(() => {
    if (!browser) return;
    try {
      const saved = localStorage.getItem('bean-tracker-view');
      if (saved === 'cards' || saved === 'list') view = saved;
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
      `${c.roaster} ${c.coffee_name} ${c.origin ?? ''}`.toLowerCase().includes(query.toLowerCase())
    )
  );

  type SortKey = 'roaster' | 'coffee_name' | 'cost_per_gram' | 'amount_g' | 'roast_date' | 'urgency';
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

<h1>Coffee Collection</h1>

<div class="toolbar">
  <div class="tab-group">
    <button aria-pressed={filter === 'backlog'} onclick={() => (filter = 'backlog')}>
      Backlog ({data.backlog.length})
    </button>
    <button aria-pressed={filter === 'open'} onclick={() => (filter = 'open')}>
      Open ({data.open.length})
    </button>
    <button aria-pressed={filter === 'archive'} onclick={() => (filter = 'archive')}>
      Archive ({data.archive.length})
    </button>
    <button aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
  </div>

  <div class="tab-group">
    <button aria-pressed={view === 'list'} onclick={() => setView('list')}>List</button>
    <button aria-pressed={view === 'cards'} onclick={() => setView('cards')}>Cards</button>
  </div>
</div>

<input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={query} />

{#if view === 'cards'}
  <section class="grid">
    {#each coffees as coffee (coffee.id)}
      <a class="card" href={`/coffees/${coffee.slug}`}>
        <h2>{coffee.coffee_name}</h2>
        <p class="text-muted">{coffee.roaster}</p>
        <p>{coffee.origin ?? 'Origin unknown'} · {coffee.roast_level ?? 'Roast level unknown'}</p>
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
    {/each}
  </section>
{:else}
  <div class="table-scroll">
    <table class="data-table compact">
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
          <th>Origin · Roast</th>
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
        </tr>
      </thead>
      <tbody>
        {#each sortedCoffees as coffee (coffee.id)}
          <tr>
            <td>{coffee.roaster}</td>
            <td><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></td>
            <td>{coffee.origin ?? '—'} · {coffee.roast_level ?? '—'}</td>
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
            <td>{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</td>
            <td>
              {#if coffee.status === 'archive'}
                <span class="badge badge-fresh">Archive</span>
              {:else if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
