<script lang="ts">
  import Recipes from '../+page.svelte';
  // The same page as /recipes (its load adds `focusId`); ActionData types differ only by route.
  let { data, form } = $props();
</script>

<Recipes {data} form={form as never} />
