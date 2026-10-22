<script lang="ts">
  import { wholeNote, type BrewFilterKey } from '$lib/insightsUrl';

  // The note under whole-bag figures; its lead-in (up to the first colon) is bold.
  let { keys, items, cls = 'chart-note' }: { keys: readonly BrewFilterKey[]; items?: readonly string[]; cls?: string } = $props();
  const text = $derived(wholeNote(keys, items));
  const at = $derived(text.indexOf(':') + 1);
</script>

<p class={cls}><strong>{text.slice(0, at)}</strong>{text.slice(at)}</p>
