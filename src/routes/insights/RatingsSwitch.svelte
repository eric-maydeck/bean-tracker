<script lang="ts">
  import { labelTip } from '$lib/components/labelTip';
  import { DIAL_HELP, DIAL_LABEL, RATINGS_LABEL, type Dial, type InsightsUrlState, type Ratings } from '$lib/insightsUrl';

  // Labeled Ratings (Calibrated ratings | All ratings) and Brews (Once dialed | All brews) switches (ui-rules 26–27: a hover/focus help tip (labelTip) +
  // aria-describedby on each option; the #ratings-help-* / #dial-help-* spans live in +page.svelte).
  // `menu`: one compact filter-bar button showing the state, the switches in a popover under it; `off`: the menu greyed
  // out (it doesn't apply in this mode), its tip saying when it does.
  let { ratings, dial, ratingsHelp, choose, menu = false, off }: {
    ratings: Ratings; dial: Dial; ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void; menu?: boolean; off?: string;
  } = $props();
  let pop = $state<HTMLElement>();
  let button = $state<HTMLElement>();
  let open = $state(false);
  const summary = $derived(`${RATINGS_LABEL[ratings]} · ${DIAL_LABEL[dial]}`);

  function place(e: ToggleEvent) {
    if (e.newState !== 'open' || !pop || !button) return;
    const r = button.getBoundingClientRect();
    pop.style.top = `${r.bottom + 4}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 300))}px`;
  }
</script>

{#snippet pair()}
  <div class="form-field group-field">
    <span>Ratings</span>
    <div class="tab-group" role="group" aria-label="Ratings">
      {#each ['current', 'all'] as const as m (m)}
        <button aria-pressed={ratings === m} use:labelTip={{ title: RATINGS_LABEL[m], lines: [ratingsHelp[m]] }} aria-describedby="ratings-help-{m}"
          onclick={() => choose({ ratings: m })}>{RATINGS_LABEL[m]}</button>
      {/each}
    </div>
  </div>
  <div class="form-field group-field">
    <span>Brews</span>
    <div class="tab-group" role="group" aria-label="Brews">
      {#each ['dialed', 'all'] as const as m (m)}
        <button aria-pressed={dial === m} use:labelTip={{ title: DIAL_LABEL[m], lines: [DIAL_HELP[m]] }} aria-describedby="dial-help-{m}"
          onclick={() => choose({ dial: m === 'all' ? 'all' : undefined })}>{DIAL_LABEL[m]}</button>
      {/each}
    </div>
  </div>
{/snippet}

{#if menu}
  <div class="form-field group-field menu-field">
    <span>Ratings and brews</span>
    {#if off}
      <button class="menu-button off" aria-disabled="true" use:labelTip={off} aria-label="Ratings and brews: {summary}. {off}">{summary}</button>
    {:else}
      <button bind:this={button} class="menu-button" popovertarget="switch-menu" aria-haspopup="dialog" aria-expanded={open} aria-label="Ratings and brews: {summary}">{summary}</button>
    {/if}
  </div>
  <div bind:this={pop} id="switch-menu" class="switch-menu" popover onbeforetoggle={place} ontoggle={(e) => (open = e.newState === 'open')}>{@render pair()}</div>
{:else}
  <div class="switch-pair">{@render pair()}</div>
{/if}

<style>
  .switch-pair {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
  }
  .switch-pair :global(.form-field) {
    margin-bottom: 0;
  }
  /* The menu: a select-like button (same height as the bar's selects) and the pair stacked under it. */
  .menu-field {
    min-width: 0;
  }
  .menu-button.off {
    opacity: 0.5;
  }
  .menu-button {
    box-sizing: border-box;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    min-height: 2.25rem;
    margin: 0;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 0.85rem;
    white-space: nowrap;
    cursor: pointer;
  }
  .switch-menu {
    inset: auto;
    margin: 0;
    flex-direction: column;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    max-width: calc(100vw - 1rem);
  }
  .switch-menu:popover-open {
    display: flex;
    gap: var(--space-3);
  }
  .switch-menu :global(.form-field) {
    margin-bottom: 0;
  }
  .switch-menu :global(.tab-group) {
    flex-wrap: nowrap;
  }
  /* The bar hides field labels in phone landscape; inside the menu they stay. */
  .switch-menu :global(.form-field > span) {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
  }
  /* Same compact buttons as the People switch beside it. */
  .switch-pair :global(.tab-group button),
  .switch-menu :global(.tab-group button) {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  @media (max-width: 640px) {
    .menu-button {
      width: 100%;
      min-height: 44px;
      padding-inline: var(--space-2);
    }
    .switch-pair :global(.tab-group button),
    .switch-menu :global(.tab-group button) {
      min-height: 44px;
      min-width: 44px;
    }
  }
  @media (max-height: 450px) {
    .switch-pair :global(.tab-group button) {
      padding-inline: 0.6rem;
    }
  }
</style>
