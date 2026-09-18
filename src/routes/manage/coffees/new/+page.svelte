<script lang="ts">
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  let { data, form } = $props();
</script>

<h1>Add Coffee</h1>
<CoffeeForm
  roastLevels={data.roastLevels}
  roasters={data.roasters}
  origins={data.origins}
  processingMethods={data.processingMethods}
  formError={form?.error ?? null}
/>
