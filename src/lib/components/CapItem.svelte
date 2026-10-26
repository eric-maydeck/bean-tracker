<script lang="ts">
  import type { Snippet } from 'svelte';

  // One item of a tile caption block (ui-rules 55): the block sits below the title, items flow inline, each moves to the next
  // line whole, and the " · " before an item hangs out to its left (app.css `.cap-block`): CSS only, no script.
  let { children }: { children: Snippet } = $props();
</script>

<span class="cap-item">{' '}{@render children()}</span>
