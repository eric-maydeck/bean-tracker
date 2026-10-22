<script lang="ts">
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { GEAR_KINDS, KIND_LABEL, shownTrophies } from '$lib/gear';
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

  // TEMP: remove after the user picks a style. Preview-only, read from the URL once on mount (choose() rebuilds the
  // query without it, so re-reading would snap back to a), never in the parser or URL state.
  const picked = page.url.searchParams.get('trophystyle') ?? '';
  let style = $state(['a', 'b', 'c'].includes(picked) ? picked : 'a');

  let shown = $derived(shownTrophies(list, { dripper: s.dripper, filter: s.filter, grinder: s.grinder }));
  let shelf = $derived(s.retired === 'open');
  let current = $derived(list.find((t) => t.key === s.card));
  // Each kind's brews ranking (1 = most), for the medals.
  let rank = $derived(new Map(GEAR_KINDS.flatMap((k) => list.filter((t) => t.kind === k).sort((a, b) => b.brews - a.brews).map((t, i) => [t.key, i + 1] as const))));
  const KIND_COLOR = { dripper: 1, grinder: 4, filter: 6 } as const;
  const kindVars = (t: Trophy) => `--kc:var(--series-${KIND_COLOR[t.kind]});--kc-ink:var(--series-${KIND_COLOR[t.kind]}-ink)`;
  const MEDAL = ['', 'gold', 'silver', 'bronze'];

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
    <span class="fig fig-brews"><b>{t.brews}</b><i>{t.brews === 1 ? 'brew' : 'brews'}</i></span>
    <span class="fig fig-grams"><b>{formatGrams(t.grams)}</b><i>brewed</i></span>
    <span class="fig fig-avg">
      {#if t.rating === null}<b class="none">None</b><i>ratings</i>{:else}<b>{t.rating.toFixed(1)}</b><i>avg</i>{/if}
    </span>
  </div>
  {#if t.rating !== null && t.sample.small}<SampleNote s={t.sample} />{/if}
{/snippet}

{#snippet img(t: Trophy)}
  <div class="trophy-img" style:--fill={backdrop(null)}>
    <Icon name="gear" />
    {#if rank.get(t.key)! <= 3}<span class="medal {MEDAL[rank.get(t.key)!]}" aria-label="Number {rank.get(t.key)} {t.kind} by brews">#{rank.get(t.key)}</span>{/if}
  </div>
{/snippet}

{#snippet grid(items: Trophy[], retired: boolean)}
  {@const vars = rowVars(items.length)}
  <div class="trophy-grid hl-grid" class:retired>
    {#each items as t, i (t.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="hl-card trophy-card" class:top={rank.get(t.key)! <= 3} data-key={t.key} style="{vars[i]};{kindVars(t)}" onclick={(e) => cardClick(e, t.key)}>
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
  <section class="chart-panel ts-{style}" data-section="gear-trophies">
    <LabHead id="gear-trophies" title="Trophy case" {placeTip}
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
        <div class="trophy-sheet" class:top={rank.get(t.key)! <= 3}>
          <header class="trophy-head">
            <span class="trophy-kind">{KIND_LABEL[t.kind]}</span>
            <button type="button" class="trophy-close" aria-label="Close" onclick={() => dlg?.close()}>✕</button>
          </header>
          <div class="trophy-body">
            <div class="trophy-hero">
              {@render img(t)}
              <div class="trophy-main">
                <h3 id="trophy-title" class="trophy-name">{t.name}</h3>
                {@render figs(t)}
              </div>
            </div>
            <dl class="trophy-details">
              {#if t.favorite}<div><dt>{withLabel(t)}</dt><dd>{t.favorite.name} ({t.favorite.brews})</dd></div>{/if}
              <div><dt>First used</dt><dd>{formatDate(t.firstUsed)}</dd></div>
              <div><dt>Last used</dt><dd>{formatDate(t.lastUsed)}</dd></div>
              <div><dt>Bags</dt><dd>{t.bags}</dd></div>
              <div><dt>Days brewed</dt><dd>{t.days}</dd></div>
              {#if t.best !== null}<div><dt>Best rating</dt><dd>{t.best.toFixed(1)}</dd></div>{/if}
              {#if t.retired}<div><dt>Retired</dt><dd>{reason(t)}</dd></div>{/if}
            </dl>
          </div>
        </div>
      {/if}
    </dialog>
  </section>
{/if}

<style>
  /* ---- shared ---- */
  .trophy-card {
    cursor: pointer;
    align-items: stretch;
    padding: var(--space-2);
    --medal: var(--series-other);
    --medal-ink: var(--series-other-ink);
  }
  /* The picture box takes the card's spare height, so the card has no hole (Part 2 puts the photo in it). */
  .trophy-img {
    position: relative;
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
  .medal {
    position: absolute;
    top: 0.3rem;
    left: 0.3rem;
    display: none;
    padding: 0 0.4rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.5;
    color: var(--medal-ink);
    background: color-mix(in srgb, var(--medal) 55%, #fff);
    border: 1px solid var(--medal-ink);
  }
  .medal.gold { --medal: var(--series-4); --medal-ink: var(--series-4-ink); }
  .medal.silver { --medal: var(--series-other); --medal-ink: var(--series-other-ink); }
  .medal.bronze { --medal: var(--series-brown-2); --medal-ink: var(--series-brown-2-ink); }
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
    font-weight: 600;
    text-align: center;
  }
  .trophy-toggle:focus-visible,
  .trophy-close:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .trophy-figs {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: var(--space-3);
    font-variant-numeric: tabular-nums;
  }
  .fig {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
  }
  .fig b {
    font-size: 1rem;
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
  }
  .trophy-card :global(.sample-note) {
    align-self: center;
  }

  /* ---- A: scoreboard: a big serif brew count, small-caps figures, a kind-colored top edge ---- */
  .ts-a .trophy-card {
    border-top: 4px solid var(--kc);
  }
  .ts-a .trophy-figs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--space-3);
    justify-items: center;
  }
  .ts-a .fig-brews {
    grid-column: 1 / -1;
  }
  .ts-a .fig-brews b {
    font-family: var(--font-display);
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1;
    color: var(--kc-ink);
  }

  /* ---- B: color blocks: a kind-tinted picture box, a kind pill, figures in ruled columns ---- */
  .ts-b .trophy-img {
    background: color-mix(in srgb, var(--kc) 55%, #fff);
    color: var(--kc-ink);
  }
  .ts-b .trophy-kind {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--kc) 30%, transparent);
  }
  .ts-b .trophy-figs {
    width: 100%;
    gap: 0;
    align-items: stretch;
    border-top: 1px solid var(--color-border);
    padding-top: 0.35rem;
  }
  .ts-b .fig {
    flex: 1 1 0;
    min-width: 0;
  }
  .ts-b .fig + .fig {
    border-left: 1px solid var(--color-border);
  }
  .ts-b .fig b {
    font-size: 1.15rem;
    font-weight: 700;
  }

  /* ---- C: medals: the top 3 per kind carry a gold / silver / bronze ring and rank; cards tinted by kind; serif names ---- */
  .ts-c .trophy-card {
    background: color-mix(in srgb, var(--kc) 12%, var(--color-bg));
  }
  .ts-c .trophy-card.top {
    border: 2px solid var(--medal-ink);
  }
  :is(.trophy-card, .trophy-sheet):has(.medal.gold) { --medal-ink: var(--series-4-ink); }
  :is(.trophy-card, .trophy-sheet):has(.medal.silver) { --medal-ink: var(--series-other-ink); }
  :is(.trophy-card, .trophy-sheet):has(.medal.bronze) { --medal-ink: var(--series-brown-2-ink); }
  .ts-c .medal {
    display: inline-block;
  }
  .ts-c .trophy-toggle,
  .ts-c .trophy-name {
    font-family: var(--font-display);
    font-weight: 700;
  }
  .ts-c .trophy-figs {
    flex-wrap: wrap;
    gap: 0 var(--space-3);
  }
  .ts-c .fig-avg {
    order: -1;
  }
  .ts-c .fig-avg b {
    font-size: 1.6rem;
    line-height: 1;
    color: var(--kc-ink);
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

  /* ---- The open card: the site's dialog pattern (Image Suggest): a centered box, a full-screen sheet on phones ---- */
  .trophy-dialog {
    width: min(40rem, 100% - 2rem);
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
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-top: 4px solid var(--kc);
    --medal-ink: var(--series-other-ink);
  }
  .trophy-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-2) 0 var(--space-4);
  }
  .trophy-close {
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
  .trophy-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-4) var(--space-4);
  }
  .trophy-hero {
    display: flex;
    align-items: stretch;
    gap: var(--space-4);
  }
  .trophy-hero .trophy-img {
    flex: 0 0 10rem;
    min-height: 10rem;
  }
  .trophy-hero .trophy-img :global(svg) {
    width: 4rem;
    height: 4rem;
  }
  .trophy-hero .trophy-main {
    flex: 1;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-2);
  }
  .trophy-name {
    margin: 0;
    font-size: 1.5rem;
    overflow-wrap: anywhere;
  }
  .trophy-hero .trophy-figs {
    gap: var(--space-4);
  }
  .trophy-hero .fig b {
    font-size: 1.5rem;
  }
  /* The facts wrap and stretch: every row is full, no orphaned empty cell. */
  .trophy-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    margin: var(--space-4) 0 0;
  }
  .trophy-details div {
    flex: 1 1 9rem;
    padding: 0.4rem 0;
    border-top: 1px solid var(--color-border);
  }
  .trophy-details dt {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .trophy-details dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .ts-b .trophy-dialog .trophy-img {
    background: color-mix(in srgb, var(--kc) 55%, #fff);
    color: var(--kc-ink);
  }
  .ts-c .trophy-dialog .trophy-sheet {
    background: color-mix(in srgb, var(--kc) 12%, var(--color-surface));
  }
  .ts-c .trophy-dialog .trophy-sheet.top {
    border-top-color: var(--medal-ink);
  }
  @media (max-width: 640px) {
    /* A near-full-width sheet that is only as tall as its content (a full-height one is mostly empty), scrolling when taller than the screen. */
    .trophy-dialog {
      width: calc(100% - 1rem);
      max-height: calc(100dvh - 1rem);
    }
    .trophy-hero {
      flex-direction: column;
    }
    .trophy-hero .trophy-img {
      flex: 0 0 auto;
      min-height: 7rem;
    }
    .trophy-hero .trophy-main {
      align-items: center;
    }
  }
  /* Phone landscape (333px tall): picture beside the text, so the facts need less scrolling. */
  @media (max-width: 640px) and (max-height: 500px) {
    .trophy-hero {
      flex-direction: row;
    }
    .trophy-hero .trophy-img {
      flex: 0 0 8rem;
      min-height: 0;
    }
    .trophy-hero .trophy-main {
      align-items: flex-start;
    }
  }
</style>
