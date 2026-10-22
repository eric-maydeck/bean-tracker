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
  import { rowVars } from './rows';

  let { list, s, choose, placeTip }: {
    list: Trophy[]; s: InsightsView;
    choose: (c: InsightsUrlState) => void; placeTip: (e: ToggleEvent) => void;
  } = $props();

  let shown = $derived(shownTrophies(list, { dripper: s.dripper, filter: s.filter, grinder: s.grinder }));
  let shelf = $derived(s.retired === 'open');
  let current = $derived(list.find((t) => t.key === s.card));
  const KIND_COLOR = { dripper: 1, grinder: 4, filter: 6 } as const;
  const kindVars = (t: Trophy) => `--kc:var(--series-${KIND_COLOR[t.kind]});--kc-ink:var(--series-${KIND_COLOR[t.kind]}-ink)`;

  let dlg: HTMLDialogElement | undefined = $state();
  // The URL is the state: the dialog follows `card`, and its own closes (✕, Esc, backdrop) clear it.
  $effect(() => {
    if (!dlg) return;
    if (current && !dlg.open) dlg.showModal();
    else if (!current && dlg.open) dlg.close();
  });
  const open = (key: string) => choose({ card: key });
  // The card is one big target; links, buttons and the low-confidence chip keep their own clicks.
  function cardClick(e: MouseEvent, key: string) {
    if (!(e.target as Element).closest('a, button, .sample-note')) open(key);
  }
  const reason = (t: Trophy) => (t.archived ? 'Archived in Bean Conqueror' : `No brew since ${formatDate(t.lastUsed)}`);
  const withLabel = (t: Trophy) => (t.kind === 'dripper' ? 'Favorite filter' : 'Favorite dripper');
</script>

{#snippet figs(t: Trophy)}
  <div class="trophy-figs">
    <span class="fig fig-avg">
      {#if t.rating === null}<b class="none">No ratings</b>{:else}<b class="hl-value">{t.rating.toFixed(1)}</b><i>avg</i>{/if}
    </span>
    {#if t.rating !== null && t.sample.small}<SampleNote s={t.sample} />{/if}
    <span class="fig-row">
      <span class="fig"><b>{t.brews}</b><i>{t.brews === 1 ? 'brew' : 'brews'}</i></span>
      <span class="fig"><b>{formatGrams(t.grams)}</b><i>brewed</i></span>
    </span>
  </div>
{/snippet}

{#snippet img(t: Trophy)}
  <div class="trophy-img" style:--fill={backdrop(null)}>
    <Icon name="gear" />
  </div>
{/snippet}

{#snippet grid(items: Trophy[], retired: boolean)}
  {@const vars = rowVars(items.length)}
  <div class="trophy-grid hl-grid" class:retired>
    {#each items as t, i (t.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="hl-card trophy-card" data-key={t.key} style="{vars[i]};{kindVars(t)}" onclick={(e) => cardClick(e, t.key)}>
        {@render img(t)}
        <div class="trophy-main">
          <span class="trophy-kind">{KIND_LABEL[t.kind]}</span>
          <button type="button" class="trophy-toggle hl-holder" aria-haspopup="dialog" onclick={() => open(t.key)}>{t.name}</button>
          {@render figs(t)}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#if list.length}
  <section class="chart-panel" data-section="gear-trophies">
    <LabHead id="gear-trophies" title="Gear showcase" {placeTip}
      help={["Every piece of gear you've brewed with, all time.", 'Ignores Period, Ratings, Brews and the other filters; Dripper, Filter and Grinder each pick one card of their own kind.',
        'Average: every rated brew.', 'Retired: archived in Bean Conqueror, or no brew in 90 days.']} />
    {#if shown.active.length}{@render grid(shown.active, false)}{/if}
    {#if shown.retired.length}
      <button type="button" class="retired-toggle" aria-expanded={shelf} onclick={() => choose({ retired: shelf ? undefined : 'open' })}>
        Retired ({shown.retired.length})<span class="caret"><Icon name="caret-right" /></span>
      </button>
      {#if shelf}{@render grid(shown.retired, true)}{/if}
    {/if}

    <!-- Focus lands on the dialog, never a control. A click on the dialog itself (not its sheet) is a backdrop click. -->
    <!-- svelte-ignore a11y_autofocus, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <dialog bind:this={dlg} autofocus class="trophy-dialog" aria-labelledby="trophy-title" style={current ? kindVars(current) : ''}
      onclose={() => s.card && choose({ card: undefined })}
      onclick={(e) => e.target === dlg && dlg.close()}>
      {#if current}
        {@const t = current}
        <div class="trophy-sheet">
          <button type="button" class="trophy-close" aria-label="Close" onclick={() => dlg?.close()}>✕</button>
          <!-- The coffee page's language (routes/coffees/[slug]): .detail media + body, h-title with badges, .stat-grid facts. -->
          <article class="detail trophy-detail">
            <div class="detail-media">{@render img(t)}</div>
            <div class="detail-body">
              <div class="detail-header">
                <h2 id="trophy-title" class="trophy-name">{t.name}
                  <span class="badge badge-neutral">{KIND_LABEL[t.kind]}</span>
                  {#if t.retired}<span class="badge badge-warm">Retired</span>{/if}
                </h2>
              </div>
              <div class="stat-grid">
                <div class="stat"><span class="stat-label">Brews</span><span class="stat-value">{t.brews}</span></div>
                <div class="stat"><span class="stat-label">Brewed</span><span class="stat-value">{formatGrams(t.grams)}</span></div>
                <div class="stat"><span class="stat-label">Average</span>
                  <span class="stat-value">{t.rating === null ? 'No ratings' : t.rating.toFixed(1)}{#if t.rating !== null && t.sample.small}{' '}<SampleNote s={t.sample} />{/if}</span></div>
                {#if t.best !== null}<div class="stat"><span class="stat-label">Best rating</span><span class="stat-value">{t.best.toFixed(1)}</span></div>{/if}
              </div>
              <section class="detail-section">
                <h2>Usage</h2>
                <div class="stat-grid">
                  {#if t.favorite}<div class="stat"><span class="stat-label">{withLabel(t)}</span><span class="stat-value">{t.favorite.name} ({t.favorite.brews})</span></div>{/if}
                  <div class="stat"><span class="stat-label">First used</span><span class="stat-value">{formatDate(t.firstUsed)}</span></div>
                  <div class="stat"><span class="stat-label">Last used</span><span class="stat-value">{formatDate(t.lastUsed)}</span></div>
                  <div class="stat"><span class="stat-label">Bags</span><span class="stat-value">{t.bags}</span></div>
                  <div class="stat"><span class="stat-label">Days brewed</span><span class="stat-value">{t.days}</span></div>
                  {#if t.retired}<div class="stat"><span class="stat-label">Retired</span><span class="stat-value">{reason(t)}</span></div>{/if}
                </div>
              </section>
            </div>
          </article>
        </div>
      {/if}
    </dialog>
  </section>
{/if}

<style>
  /* Collapsed card: a kind-colored top edge and brew count (the number is the insights tiles' .hl-value), small figures under it. */
  .trophy-card {
    cursor: pointer;
    align-items: stretch;
    padding: var(--space-2);
    border-top: 4px solid var(--kc);
  }
  /* The picture box takes the card's spare height, so the card has no hole (Part 2 puts the photo in it). */
  .trophy-img {
    flex: 1 1 auto;
    min-height: 4.5rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius);
    background: var(--fill);
    color: #7a6a5c;
  }
  .trophy-img :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }
  .trophy-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    min-width: 0;
  }
  .trophy-kind {
    color: var(--kc-ink);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .trophy-toggle {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    min-height: 44px;
    width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    align-content: center;
    overflow-wrap: anywhere;
    /* The card's headline: the display serif the site's headings use, bigger and bolder than the figures. */
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.2;
    max-height: max(44px, 2.4em); /* two lines, never a third peeking through */
    text-align: center;
  }
  .trophy-toggle:focus-visible,
  .trophy-close:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .trophy-figs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }
  .fig {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
  }
  /* The headline: the average, in the insights tiles' .hl-value and the kind color. */
  .fig-avg b.hl-value {
    margin-top: 0;
    color: var(--kc-ink);
  }
  .fig b {
    font-size: 1rem;
  }
  /* Beats `.fig b` above (same specificity otherwise, and that rule comes first): the headline keeps .hl-value's size. */
  .fig-avg b.hl-value {
    font-size: min(2rem, 15cqw / var(--q, 2));
  }
  .fig i {
    font-style: normal;
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .fig .none {
    color: var(--color-text-muted);
    font-weight: 500;
    font-size: 0.85rem;
  }
  /* Brews left, grams right, under a rule: the room between them and the headline is the card's breathing space. */
  .fig-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    box-sizing: border-box;
  }
  .trophy-card :global(.sample-note) {
    align-self: center;
  }

  /* ---- Retired shelf ---- */
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

  /* ---- The open card: the site's dialog (Image Suggest's frame) holding the coffee page's layout and type ---- */
  .trophy-dialog {
    width: min(48rem, 100% - 2rem);
    max-height: calc(100dvh - 2rem);
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
  }
  .trophy-dialog[open] {
    display: flex;
  }
  .trophy-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .trophy-sheet {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--space-4);
    border-top: 4px solid var(--kc);
  }
  .trophy-close {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    z-index: 1;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .trophy-detail {
    margin-top: 0;
  }
  /* The coffee page's image frame (.detail-media img): square on the picture's backdrop, border and shadow. */
  .trophy-detail .trophy-img {
    aspect-ratio: 1;
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow);
  }
  .trophy-detail .trophy-img :global(svg) {
    width: 3.5rem;
    height: 3.5rem;
  }
  /* The kind badge in the card's kind color (light tint, kind ink). */
  .trophy-name .badge {
    background: color-mix(in srgb, var(--kc) 22%, transparent);
    color: var(--kc-ink);
  }
  .trophy-name {
    margin: 0;
    font-size: 1.5rem; /* the coffee page's h1 size */
    padding-right: 2.5rem;
    overflow-wrap: anywhere;
  }
  /* Facts wrap and stretch: every row is full, no orphaned empty cell (the coffee page's auto-fill grid leaves holes). */
  .trophy-detail .stat-grid {
    display: flex;
    flex-wrap: wrap;
  }
  .trophy-detail .stat {
    flex: 1 1 8.5rem;
    min-width: 0;
  }
  .trophy-detail .stat-value {
    overflow-wrap: anywhere;
  }
  @media (max-width: 640px) {
    /* A near-full-width sheet only as tall as its content; the square picture is capped so the facts stay in reach. */
    .trophy-dialog {
      width: calc(100% - 1rem);
      max-height: calc(100dvh - 1rem);
    }
    .trophy-detail .detail-media {
      width: min(100%, 11rem);
      margin-inline: auto;
    }
  }
  /* Phone landscape (333px tall): picture beside the facts. */
  @media (max-width: 1100px) and (max-height: 500px) {
    .trophy-detail {
      grid-template-columns: 8rem 1fr;
      gap: var(--space-3);
    }
    .trophy-detail .detail-media {
      width: auto;
    }
  }
</style>
