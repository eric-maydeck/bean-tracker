<script lang="ts">
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  let { data, form } = $props();
</script>

<h1>Add coffee</h1>
<CoffeeForm roastLevels={data.roastLevels} formError={form?.error ?? null} />
