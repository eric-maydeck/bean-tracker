<script lang="ts">
  import type { Snippet } from 'svelte';

  // One item of a tile caption block (ui-rules 55): the block sits below the title and its lines are centered; items flow inline,
  // each moves to the next line whole. The gap before it is a collapsible space (so a break removes it) as wide as " · " (see
  // `captionItems`, which also hides the dot of an item that starts a line).
  let { children }: { children: Snippet } = $props();
</script>

<span class="cap-gap">{' '}</span><span class="cap-item">{@render children()}</span>
