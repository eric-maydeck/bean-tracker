<script lang="ts">
  import type { InsightsUrlState, Ratings } from '$lib/insightsUrl';

  // The labelled Current | All switch of a tab's bar (ui-rules 26–27: title + aria-describedby on each option;
  // the #ratings-help-* spans live in +page.svelte).
  // ponytail: migrate Habits/Records/Leaderboards to RatingsSwitch later (no behaviour change).
  let { ratings, ratingsHelp, choose }: {
    ratings: Ratings; ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void;
  } = $props();
</script>

<div class="form-field group-field">
  <span>Ratings</span>
  <div class="tab-group" role="group" aria-label="Ratings">
    {#each ['current', 'all'] as const as m (m)}
      <button
        aria-pressed={ratings === m}
        title={ratingsHelp[m]}
        aria-describedby="ratings-help-{m}"
        onclick={() => choose({ ratings: m })}>{m === 'all' ? 'All' : 'Current'}</button
      >
    {/each}
  </div>
</div>
