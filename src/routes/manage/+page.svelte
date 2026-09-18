<script lang="ts">
  import { enhance } from '$app/forms';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  let { data, form } = $props();

  let tab = $state<'coffees' | 'subscriptions'>('coffees');
</script>

<h1>Manage</h1>

<div class="tab-group">
  <button aria-pressed={tab === 'coffees'} onclick={() => (tab = 'coffees')}>Coffees</button>
  <button aria-pressed={tab === 'subscriptions'} onclick={() => (tab = 'subscriptions')}>Subscriptions</button>
</div>

{#if tab === 'coffees'}
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th>Coffee</th>
          <th>Roaster</th>
          <th>Status</th>
          <th>Urgency</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.coffees as coffee (coffee.id)}
          <tr>
            <td><a href={`/manage/coffees/${coffee.id}/edit`}>{coffee.coffee_name}</a></td>
            <td>{coffee.roaster}</td>
            <td>
              {#if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
              {#if coffee.frozen_start_date && !coffee.frozen_end_date}
                <span class="badge badge-neutral">Frozen</span>
              {/if}
            </td>
            <td style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </td>
            <td>
              <div class="action-buttons">
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
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
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
            <td><a href={`/manage/subscriptions/${sub.id}/edit`}>{sub.roaster_service}</a></td>
            <td>{sub.subscription_name ?? '—'}</td>
            <td>{sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}</td>
            <td>{sub.total_grams ?? '—'}</td>
            <td>
              <form method="POST" action="?/subTogglePurchased" use:enhance>
                <input type="hidden" name="id" value={sub.id} />
                <button class="button button-secondary" type="submit">
                  {sub.purchased ? 'Purchased' : 'Not yet'}
                </button>
              </form>
            </td>
            <td>
              <form method="POST" action="?/subDelete" use:enhance>
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
  <form method="POST" action="?/subCreate" use:enhance>
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
