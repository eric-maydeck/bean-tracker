<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
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

<h2>Add subscription</h2>
{#if form?.error}
  <p class="badge badge-urgent">{form.error}</p>
{/if}
<form method="POST" action="?/create" use:enhance>
  <div class="form-grid">
    <div class="form-field">
      <label for="roaster_service">Roaster/Service</label>
      <input id="roaster_service" name="roaster_service" required />
    </div>
    <div class="form-field">
      <label for="subscription_name">Subscription name</label>
      <input id="subscription_name" name="subscription_name" />
    </div>
    <div class="form-field">
      <label for="price">Price</label>
      <input id="price" name="price" type="number" step="0.01" />
    </div>
    <div class="form-field">
      <label for="bag_count"># bags/tins</label>
      <input id="bag_count" name="bag_count" type="number" step="1" />
    </div>
    <div class="form-field">
      <label for="amount_per_bag_g">Amount per bag/tin (g)</label>
      <input id="amount_per_bag_g" name="amount_per_bag_g" type="number" step="1" />
    </div>
  </div>
  <button class="button" type="submit">Add</button>
</form>
