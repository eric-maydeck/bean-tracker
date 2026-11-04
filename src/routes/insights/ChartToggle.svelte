<script lang="ts" generics="T extends string">
  // A panel header's compact toggle (Records' Brewer, Brewing's Bands | Exact, Leaderboards' List | Over time): one pressed
  // option, each a button; the group keeps one row.
  let { label, options, value, pick }: { label: string; options: readonly (readonly [T, string])[]; value: T; pick: (v: T) => void } = $props();
</script>

<div class="form-field group-field chart-field">
  <span class="sr-only">{label}</span>
  <div class="tab-group tab-group-compact chart-toggle" class:dense={options.length > 4} role="group" aria-label={label}>
    {#each options as [v, text] (v)}<button aria-pressed={value === v} onclick={() => pick(v)}>{text}</button>{/each}
  </div>
</div>

<style>
  .chart-field {
    margin-bottom: 0;
  }
  .chart-toggle {
    flex-wrap: nowrap;
  }
  .chart-toggle button {
    margin: 0;
    white-space: nowrap;
  }
  /* Five options (Group by) outgrow a 360px card: tighter buttons on a phone. */
  @media (max-width: 480px) {
    .dense button {
      padding-inline: 0.35rem;
    }
  }
  @media (max-width: 640px) {
    .chart-toggle button {
      min-width: 44px;
    }
  }
</style>
