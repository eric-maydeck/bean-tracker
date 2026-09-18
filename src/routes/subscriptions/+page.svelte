<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);
</script>

<h1>Subscriptions</h1>

{#if data.isAdmin}
  <div class="search-row">
    <button
      class="button button-secondary"
      type="button"
      aria-pressed={editMode}
      onclick={() => (editMode = !editMode)}
    >
      {editMode ? 'Done editing' : 'Edit'}
    </button>
  </div>
{/if}

{#if form?.error}
  <p class="badge badge-urgent">{form.error}</p>
{/if}

<div class="table-scroll">
  <table class="data-table">
    <thead>
      <tr>
        <th>Roaster/Service</th>
        <th>Name</th>
        <th>Price</th>
        <th>Total grams</th>
        {#if canEdit}
          <th>Bags × g/bag</th>
        {/if}
        <th>Purchased?</th>
        {#if canEdit}
          <th>Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each data.subscriptions as sub (sub.id)}
        <tr>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="roaster_service" required value={sub.roaster_service} />
            {:else}
              {sub.roaster_service}
            {/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="subscription_name" value={sub.subscription_name ?? ''} />
            {:else}
              {sub.subscription_name ?? '—'}
            {/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="price" type="number" step="0.01" value={sub.price ?? ''} />
            {:else}
              {sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}
            {/if}
          </td>
          <td>{sub.total_grams ?? '—'}</td>
          {#if canEdit}
            <td>
              <input class="inline-input" form={`sub-form-${sub.id}`} name="bag_count" type="number" step="1" placeholder="# bags" value={sub.bag_count ?? ''} />
              <input class="inline-input" form={`sub-form-${sub.id}`} name="amount_per_bag_g" type="number" step="1" placeholder="g/bag" value={sub.amount_per_bag_g ?? ''} />
            </td>
          {/if}
          <td>
            {#if canEdit}
              <form method="POST" action="?/togglePurchased" use:enhance>
                <input type="hidden" name="id" value={sub.id} />
                <button class="button button-secondary" type="submit">
                  {sub.purchased ? 'Purchased' : 'Not yet'}
                </button>
              </form>
            {:else}
              {sub.purchased ? 'Purchased' : 'Not yet'}
            {/if}
          </td>
          {#if canEdit}
            <td>
              <form id={`sub-form-${sub.id}`} method="POST" action="?/update" use:enhance>
                <input type="hidden" name="id" value={sub.id} />
                <button class="button" type="submit">Save</button>
              </form>
              <form method="POST" action="?/delete" use:enhance>
                <input type="hidden" name="id" value={sub.id} />
                <button
                  class="button button-danger"
                  type="submit"
                  onclick={(e) => {
                    if (!confirm(`Delete ${sub.roaster_service}? This cannot be undone.`)) e.preventDefault();
                  }}
                >
                  Delete
                </button>
              </form>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if canEdit}
  <h2>Add subscription</h2>
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
{/if}
