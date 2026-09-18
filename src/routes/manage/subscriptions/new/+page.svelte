<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<h1>Add subscription</h1>

{#if form?.error}
  <p class="badge badge-urgent">{form.error}</p>
{/if}
<form method="POST" use:enhance>
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
