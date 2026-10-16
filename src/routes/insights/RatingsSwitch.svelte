<script lang="ts">
  import { DIAL_HELP, DIAL_LABEL, type Dial, type InsightsUrlState, type Ratings } from '$lib/insightsUrl';

  // A tab bar's labeled Ratings (Current | All) and Brews (All brews | Once dialed) switches (ui-rules 26–27: title +
  // aria-describedby on each option; the #ratings-help-* / #dial-help-* spans live in +page.svelte).
  let { ratings, dial, dialApplies = true, ratingsHelp, choose }: {
    ratings: Ratings; dial: Dial; dialApplies?: boolean; ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void;
  } = $props();
</script>

<div class="form-field group-field">
  <span>Ratings</span>
  <div class="tab-group" role="group" aria-label="Ratings">
    {#each ['current', 'all'] as const as m (m)}
      <button aria-pressed={ratings === m} title={ratingsHelp[m]} aria-describedby="ratings-help-{m}"
        onclick={() => choose({ ratings: m })}>{m === 'all' ? 'All' : 'Current'}</button>
    {/each}
  </div>
</div>
{#if dialApplies}
<div class="form-field group-field brews-field">
  <span>Brews</span>
  <div class="tab-group" role="group" aria-label="Brews">
    {#each ['all', 'dialed'] as const as m (m)}
      <button aria-pressed={dial === m} title={DIAL_HELP[m]} aria-describedby="dial-help-{m}"
        onclick={() => choose({ dial: m === 'all' ? 'all' : undefined })}>{DIAL_LABEL[m]}</button>
    {/each}
  </div>
</div>
{/if}
