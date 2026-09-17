<script lang="ts">
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  let { data, form } = $props();
</script>

<h1>Edit coffee</h1>
<CoffeeForm coffee={data.coffee} roastLevels={data.roastLevels} formError={form?.error ?? null} />
