<script lang="ts">
  import { DIAL_HELP, DIAL_LABEL, type Dial, type InsightsUrlState, type Ratings } from '$lib/insightsUrl';

  // A tab bar's labeled Ratings (Current | All) and Brews (All brews | Once dialed) switches (ui-rules 26–27: title +
  // aria-describedby on each option; the #ratings-help-* / #dial-help-* spans live in +page.svelte).
  let { ratings, dial, ratingsHelp, choose }: {
    ratings: Ratings; dial: Dial; ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void;
  } = $props();
</script>

<div class="switch-pair">
  <div class="form-field group-field">
    <span>Ratings</span>
    <div class="tab-group" role="group" aria-label="Ratings">
      {#each ['current', 'all'] as const as m (m)}
        <button aria-pressed={ratings === m} title={ratingsHelp[m]} aria-describedby="ratings-help-{m}"
          onclick={() => choose({ ratings: m })}>{m === 'all' ? 'All' : 'Current'}</button>
      {/each}
    </div>
  </div>
  <div class="form-field group-field">
    <span>Brews</span>
    <div class="tab-group" role="group" aria-label="Brews">
      {#each ['all', 'dialed'] as const as m (m)}
        <button aria-pressed={dial === m} title={DIAL_HELP[m]} aria-describedby="dial-help-{m}"
          onclick={() => choose({ dial: m === 'all' ? 'all' : undefined })}>{DIAL_LABEL[m]}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  /* The pair wraps as one unit in the page's control grids and stays together beside a panel title. */
  .switch-pair {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
  }
  .switch-pair :global(.form-field) {
    margin-bottom: 0;
  }
  /* Same compact buttons as the People switch beside it, so the bar stays one row where it can. */
  .switch-pair :global(.tab-group button) {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  @media (max-width: 640px) {
    .switch-pair :global(.tab-group button) {
      min-height: 44px;
      min-width: 44px;
    }
  }
  @media (max-height: 450px), (max-width: 420px) {
    .switch-pair :global(.tab-group button) {
      padding-inline: 0.6rem;
    }
  }
</style>
