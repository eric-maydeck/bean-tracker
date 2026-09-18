<script lang="ts">
  let { data } = $props();
</script>

<h1>Subscriptions</h1>

<div class="table-scroll">
  <table class="data-table">
    <thead>
      <tr>
        <th>Roaster/Service</th>
        <th>Name</th>
        <th>Price</th>
        <th>Total grams</th>
      </tr>
    </thead>
    <tbody>
      {#each data.subscriptions as sub (sub.id)}
        <tr>
          <td>{sub.roaster_service}</td>
          <td>{sub.subscription_name ?? '—'}</td>
          <td>{sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}</td>
          <td>{sub.total_grams ?? '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
