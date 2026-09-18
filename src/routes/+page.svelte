<script lang="ts">
  import { browser } from '$app/environment';

  let { data } = $props();
  let query = $state('');
  let filter = $state<'active' | 'finished' | 'all'>('active');
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
    filter === 'active'
      ? data.active
      : filter === 'finished'
        ? data.finished
        : [...data.active, ...data.finished]
  );

  let coffees = $derived(
    source.filter((c) =>
      `${c.roaster} ${c.coffee_name} ${c.origin ?? ''}`.toLowerCase().includes(query.toLowerCase())
    )
  );
</script>

<h1>Coffee Collection</h1>

<div class="toolbar">
  <div class="tab-group">
    <button aria-pressed={filter === 'active'} onclick={() => (filter = 'active')}>
      Backlog ({data.active.length})
    </button>
    <button aria-pressed={filter === 'finished'} onclick={() => (filter = 'finished')}>
      Finished ({data.finished.length})
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
      <a class="card" href={`/coffees/${coffee.id}`}>
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
        {#if coffee.status === 'active' && coffee.drink_after && coffee.drink_before}
          <p class="text-muted">Rest window: {coffee.drink_after} – {coffee.drink_before}</p>
        {/if}
        {#if coffee.status === 'finished'}
          <span class="badge badge-fresh">Finished</span>
        {:else}
          <span class="badge badge-warm">In rotation</span>
        {/if}
      </a>
    {/each}
  </section>
{:else}
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th>Coffee</th>
          <th>Roaster</th>
          <th>Origin · Roast</th>
          <th>Processing</th>
          <th>Cost/g</th>
          <th>Amount</th>
          <th>Roasted</th>
          <th>Rest window</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {#each coffees as coffee (coffee.id)}
          <tr>
            <td><a href={`/coffees/${coffee.id}`}>{coffee.coffee_name}</a></td>
            <td>{coffee.roaster}</td>
            <td>{coffee.origin ?? '—'} · {coffee.roast_level ?? '—'}</td>
            <td>{coffee.processing ?? '—'}</td>
            <td>{coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}` : '—'}</td>
            <td>{coffee.amount_g != null ? `${coffee.amount_g}g` : '—'}</td>
            <td>
              {coffee.roast_date ?? '—'}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </td>
            <td>
              {#if coffee.status === 'active' && coffee.drink_after && coffee.drink_before}
                {coffee.drink_after} – {coffee.drink_before}
              {:else}
                —
              {/if}
            </td>
            <td>
              {#if coffee.status === 'finished'}
                <span class="badge badge-fresh">Finished</span>
              {:else}
                <span class="badge badge-warm">In rotation</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
