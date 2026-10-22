<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { KIND_LABEL, shownTrophies } from '$lib/gear';
  import { formatDate } from '$lib/formatDate';
  import { formatGrams } from '$lib/grams';
  import { backdrop } from '$lib/imageBackdrop';
  import type { InsightsUrlState, InsightsView } from '$lib/insightsUrl';
  import type { Trophy } from '$lib/server/insights/trophies';
  import LabHead from './LabHead.svelte';
  import { segmentVars } from './rows';

  let { list, s, choose, placeTip }: {
    list: Trophy[]; s: InsightsView;
    choose: (c: InsightsUrlState) => void; placeTip: (e: ToggleEvent) => void;
  } = $props();

  let shown = $derived(shownTrophies(list, { dripper: s.dripper, filter: s.filter, grinder: s.grinder }));
  let open = $derived(new Set(s.cards ?? []));
  let shelf = $derived(s.retired === 'open');

  function toggle(key: string) {
    const next = open.has(key) ? [...open].filter((k) => k !== key) : [...open, key];
    choose({ cards: next.length ? next.sort() : undefined });
  }
  // The card is one big target; links, buttons and the low-confidence chip keep their own clicks.
  function cardClick(e: MouseEvent, key: string) {
    if (!(e.target as Element).closest('a, button, .sample-note')) toggle(key);
  }
  const reason = (t: Trophy) => (t.archived ? 'Archived in Bean Conqueror' : `No brew since ${formatDate(t.lastUsed)}`);
  const withLabel = (t: Trophy) => (t.kind === 'dripper' ? 'Favorite filter' : 'Favorite dripper');
</script>

{#snippet grid(items: Trophy[], retired: boolean)}
  {@const vars = segmentVars(items.map((t) => open.has(t.key)))}
  <div class="trophy-grid hl-grid" class:retired>
    {#each items as t, i (t.key)}
      {@const isOpen = open.has(t.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="hl-card trophy-card" class:open={isOpen} data-key={t.key} style={vars[i]} onclick={(e) => cardClick(e, t.key)}>
        <div class="trophy-img" style:background={backdrop(null)}><Icon name="gear" /></div>
        <div class="trophy-main">
          <span class="hl-line">{KIND_LABEL[t.kind]}</span>
          <button type="button" class="trophy-toggle hl-holder" aria-expanded={isOpen} onclick={() => toggle(t.key)}>{t.name}</button>
          <div class="trophy-figs">
            <span>{t.brews} {t.brews === 1 ? 'brew' : 'brews'}</span>
            <span>{formatGrams(t.grams)}</span>
            <span class="trophy-rating">
              {#if t.rating === null}<span class="hl-line">No ratings</span>
              {:else}{t.rating.toFixed(1)} avg{#if t.sample.small}<SampleNote s={t.sample} />{/if}{/if}
            </span>
          </div>
          {#if isOpen}
            <dl class="trophy-details">
              {#if t.favorite}<div><dt>{withLabel(t)}</dt><dd>{t.favorite.name} ({t.favorite.brews})</dd></div>{/if}
              <div><dt>First used</dt><dd>{formatDate(t.firstUsed)}</dd></div>
              <div><dt>Last used</dt><dd>{formatDate(t.lastUsed)}</dd></div>
              <div><dt>Bags</dt><dd>{t.bags}</dd></div>
              <div><dt>Days brewed</dt><dd>{t.days}</dd></div>
              {#if t.best !== null}<div><dt>Best rating</dt><dd>{t.best.toFixed(1)}</dd></div>{/if}
              {#if t.retired}<div><dt>Retired</dt><dd>{reason(t)}</dd></div>{/if}
            </dl>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#if list.length}
  <section class="chart-panel" data-section="gear-trophies">
    <LabHead id="gear-trophies" title="Trophy case" {placeTip}
      help={["Every piece of gear you've brewed with, all time.", 'Ignores Period, Ratings, Brews and the other filters; Dripper, Filter and Grinder pick which cards show.',
        'Average: every rated brew.', 'Retired: archived in Bean Conqueror, or no brew in 90 days.']} />
    {#if shown.active.length}{@render grid(shown.active, false)}{/if}
    {#if shown.retired.length}
      <button type="button" class="retired-toggle" aria-expanded={shelf} onclick={() => choose({ retired: shelf ? undefined : 'open' })}>
        Retired ({shown.retired.length})<span class="caret"><Icon name="caret-right" /></span>
      </button>
      {#if shelf}{@render grid(shown.retired, true)}{/if}
    {/if}
  </section>
{/if}

<style>
  .trophy-card {
    cursor: pointer;
    align-items: stretch;
    padding: var(--space-2);
  }
  /* The picture box takes the card's spare height, so the card has no hole (Part 2 puts the photo in it). */
  .trophy-img {
    flex: 1 1 auto;
    min-height: 4.5rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius);
    color: #7a6a5c;
  }
  .trophy-img :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }
  .trophy-card.open .trophy-img {
    flex: 0 0 auto;
    min-height: 5rem;
  }
  .trophy-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    min-width: 0;
  }
  .trophy-toggle {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    min-height: 44px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    align-content: center;
    width: 100%;
    overflow-wrap: anywhere;
    font-weight: 600;
    text-align: center;
  }
  .trophy-toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .trophy-card.open .trophy-toggle {
    -webkit-line-clamp: unset;
    line-clamp: unset;
  }
  .trophy-figs {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0 var(--space-2);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .trophy-rating {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .trophy-details {
    margin: var(--space-2) 0 0;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    text-align: left;
  }
  .trophy-details div {
    flex: 1 1 9rem;
    padding: 0.2rem 0;
    border-top: 1px solid var(--color-border);
  }
  .trophy-details dt {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .trophy-details dd {
    margin: 0;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
  /* An expanded card spans its row (segmentVars): picture beside the text once there is room. */
  @container insights (min-width: 640px) {
    .trophy-card.open {
      flex-direction: row;
      gap: var(--space-3);
    }
    .trophy-card.open .trophy-img {
      flex: 0 0 9rem;
      min-height: 0;
    }
    .trophy-card.open .trophy-main {
      flex: 1 1 0;
      align-items: flex-start;
    }
    .trophy-card.open .trophy-toggle {
      text-align: left;
    }
    .trophy-card.open .trophy-figs {
      justify-content: flex-start;
    }
  }
  .retired-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    margin-top: var(--space-3);
    padding: 0 var(--space-2);
    background: none;
    border: none;
    color: var(--color-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .caret {
    display: inline-flex;
    transition: transform 150ms ease;
  }
  .retired-toggle[aria-expanded='true'] .caret {
    transform: rotate(90deg);
  }
  .retired-toggle + :global(.trophy-grid) {
    margin-top: var(--space-1);
  }
</style>
