<script lang="ts">
  import { enhance } from '$app/forms';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  let { data, form } = $props();
</script>

<h1>Edit Coffee</h1>
<CoffeeForm
  coffee={data.coffee}
  roastLevels={data.roastLevels}
  roasters={data.roasters}
  origins={data.origins}
  processingMethods={data.processingMethods}
  formError={form?.error ?? null}
/>

<form method="POST" action="?/delete" use:enhance>
  <button
    class="button button-danger"
    type="submit"
    onclick={(e) => {
      if (!confirm(`Delete ${data.coffee.coffee_name} by ${data.coffee.roaster}? This cannot be undone.`)) {
        e.preventDefault();
      }
    }}
  >
    Delete this coffee
  </button>
</form>
