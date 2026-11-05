<script lang="ts">
  // A clock time in the reader's display zone (src/lib/displayZone.ts). On a "browser time" first visit the
  // server renders UTC; after mount it re-renders in the browser's zone, so hydration never mismatches.
  import { page } from '$app/state';
  import { formatInstant, localStamp } from '$lib/localDate';

  let { iso, empty = 'never', minute = false }: { iso: string | null; empty?: string; minute?: boolean } = $props();
  let mounted = $state(false);
  $effect(() => { mounted = true; });
  const d = $derived(page.data.displayZone as { zone: string; browser: boolean });
  const zone = $derived(d.browser && mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : d.zone);
  const text = $derived(!iso ? empty : (minute ? localStamp(iso, zone).slice(0, 16).replace('T', ' ') : formatInstant(iso, zone)) + (zone === 'UTC' ? ' UTC' : ''));
</script>

{text}
