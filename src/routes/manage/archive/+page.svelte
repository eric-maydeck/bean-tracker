<script lang="ts">
  import { enhance } from '$app/forms';
  let { data } = $props();
  let query = $state('');

  let coffees = $derived(
    data.coffees.filter((c) =>
      `${c.roaster} ${c.coffee_name}`.toLowerCase().includes(query.toLowerCase())
    )
  );
</script>

<h1>Archive</h1>

<input class="search-input" placeholder="Search roaster, coffee…" bind:value={query} />

<div class="table-scroll">
  <table class="data-table">
    <thead>
      <tr>
        <th>Coffee</th>
        <th>Roaster</th>
        <th>Frozen</th>
        <th>Unfrozen</th>
        <th>Opened</th>
        <th>Archived</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each coffees as coffee (coffee.id)}
        <tr>
          <td>{coffee.coffee_name}</td>
          <td>{coffee.roaster}</td>
          <td>{coffee.frozen_start_date ?? '—'}</td>
          <td>{coffee.frozen_end_date ?? '—'}</td>
          <td>{coffee.opened_date?.slice(0, 10) ?? '—'}</td>
          <td>{coffee.moved_date?.slice(0, 10) ?? '—'}</td>
          <td>
            <form method="POST" action="?/restore" use:enhance>
              <input type="hidden" name="id" value={coffee.id} />
              <button class="button button-secondary" type="submit">Restore</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
