<script lang="ts">
  import type { InsightsUrlState } from '$lib/insightsUrl';
  import type { LabOptions } from '$lib/server/insights/lab';

  // A lab tab's Grinder select (ui-rules 6): shown with 2+ grinders; the most-used one is the default (bare URL).
  let { grinders, grinder, choose, label = 'Grinder' }: { label?: string; grinders: LabOptions['grinders']; grinder: string | undefined; choose: (c: InsightsUrlState) => void } = $props();
  let fallback = $derived(grinders[0]?.slug);
</script>

{#if grinders.length > 1}
  <label class="form-field group-field">
    <span>{label}</span>
    <select class="ctl-select" aria-label={label} value={grinder ?? fallback}
      onchange={(e) => choose({ grinder: e.currentTarget.value === fallback ? undefined : e.currentTarget.value })}>
      {#each grinders as g (g.slug)}<option value={g.slug}>{g.name}</option>{/each}
    </select>
  </label>
{/if}
