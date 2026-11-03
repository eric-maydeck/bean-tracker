<script lang="ts">
  import Recaps from '../insights/Recaps.svelte';

  let { data } = $props();
</script>

<svelte:head><title>Recaps</title></svelte:head>
<h1>Recaps</h1>
<Recaps tiles={data.tiles} />
