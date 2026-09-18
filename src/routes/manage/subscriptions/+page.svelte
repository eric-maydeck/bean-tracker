<script lang="ts">
  import { enhance } from '$app/forms';
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
        <th>Purchased?</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.subscriptions as sub (sub.id)}
        <tr>
          <td>{sub.roaster_service}</td>
          <td>{sub.subscription_name ?? '—'}</td>
          <td>{sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}</td>
          <td>{sub.total_grams ?? '—'}</td>
          <td>
            <form method="POST" action="?/togglePurchased" use:enhance>
              <input type="hidden" name="id" value={sub.id} />
              <button class="button button-secondary" type="submit">
                {sub.purchased ? 'Purchased' : 'Not yet'}
              </button>
            </form>
          </td>
          <td>
            <form method="POST" action="?/delete" use:enhance>
              <input type="hidden" name="id" value={sub.id} />
              <button class="button button-secondary" type="submit">Delete</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
