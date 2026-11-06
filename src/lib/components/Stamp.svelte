<script module lang="ts">
  // Shared, so a Stamp created by a later client-side navigation already knows it is hydrated (no flash of UTC).
  let mounted = $state(false);
</script>

<script lang="ts">
  // A clock time in the reader's display zone (src/lib/displayZone.ts). On a "browser time" first visit the
  // server renders UTC; after mount it re-renders in the browser's zone, so hydration never mismatches.
  import { page } from '$app/state';
  import { asDateFormat, stampText } from '$lib/localDate';

  let { iso, empty = 'never', minute = false }: { iso: string | null; empty?: string; minute?: boolean } = $props();
  $effect(() => { mounted = true; });
  const d = $derived(page.data.displayZone as { zone: string; browser: boolean });
  const zone = $derived(d.browser && mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : d.zone);
  const format = $derived(asDateFormat(page.data.dateFormat));
  const text = $derived(!iso ? empty : stampText(iso, zone, format, minute));
</script>

{text}
