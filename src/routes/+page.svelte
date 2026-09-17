<script lang="ts">
  let { data } = $props();
  let query = $state('');

  let coffees = $derived(
    [...data.active, ...data.finished].filter((c) =>
      `${c.roaster} ${c.coffee_name} ${c.origin ?? ''}`.toLowerCase().includes(query.toLowerCase())
    )
  );
</script>

<h1>Coffee Collection</h1>
<input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={query} />

<section class="grid">
  {#each coffees as coffee (coffee.id)}
    <a class="card" href={`/coffees/${coffee.id}`}>
      <h2>{coffee.coffee_name}</h2>
      <p class="text-muted">{coffee.roaster}</p>
      <p>{coffee.origin ?? 'Origin unknown'} · {coffee.roast_level ?? 'Roast level unknown'}</p>
      {#if coffee.status === 'finished'}
        <span class="badge badge-fresh">Finished</span>
      {:else}
        <span class="badge badge-warm">In rotation</span>
      {/if}
    </a>
  {/each}
</section>
