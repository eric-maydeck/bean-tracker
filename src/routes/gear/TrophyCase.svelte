<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import SampleNote from '#lib/components/SampleNote.svelte';
  import { GEAR_KINDS, KIND_LABEL, fieldsFor, specText, shownTrophies, type GearKind } from '#lib/gear.ts';
  import { formatDate } from '#lib/formatDate.ts';
  import Stamp from '#lib/components/Stamp.svelte';
  import { formatGrams } from '#lib/grams.ts';
  import { backdrop } from '#lib/imageBackdrop.ts';
  import { hostOf } from '#lib/imageSuggest.ts';
  import type { GearUrlState } from '#lib/gearUrl.ts';
  import type { Trophy } from '#lib/server/insights/trophies.ts';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import GearForm from './GearForm.svelte';

  let { list, links, s, choose }: {
    list: Trophy[]; s: GearUrlState;
    links: Record<string, string>; // each gear's Stats link, only where Stats would filter on it
    choose: (c: Partial<GearUrlState>) => void;
  } = $props();

  // One section per kind that has gear, in GEAR_KINDS order, each with its own retired shelf.
  const sections = $derived(GEAR_KINDS.filter((k) => list.some((t) => t.kind === k)).map((kind) => ({ kind, ...shownTrophies(list.filter((t) => t.kind === kind)) })));
  function toggleShelf(k: GearKind) {
    const open = s.retired ?? [];
    const next = GEAR_KINDS.filter((x) => (x === k ? !open.includes(x) : open.includes(x)));
    choose({ retired: next.length ? next : undefined });
  }
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
  // The admin edit form replaces the detail body; Esc and the backdrop leave it alone (Cancel/Save only).
  let editing = $state(false);
  let form: ReturnType<typeof GearForm> | undefined = $state(); // the edit form (its changes, for the leave panel)
  let leaving = $state<string[] | null>(null); // the leave panel: the unsaved changes it lists
  let keepBtn: HTMLButtonElement | undefined = $state();
  $effect(() => { if (leaving) keepBtn?.focus(); });
  const discard = () => { leaving = null; dlg?.close(); };
  let preview = $state<{ src: string; fill?: string } | null>(null); // the edit form's previewed photo
  $effect(() => { if (!editing) preview = null; });
  const curKey = $derived(current?.key); // a key, not `current`: a list refresh mid-edit must not close the form
  $effect(() => { void curKey; editing = false; leaving = null; }); // any card change leaves edit mode
  const open = (key: string) => choose({ card: key });
  // The card is one big target; links, buttons and the low-confidence chip keep their own clicks.
  function cardClick(e: MouseEvent, key: string) {
    if (!(e.target as Element).closest('a, button, .sample-note')) open(key);
  }
  const reason = (t: Trophy) => (t.archived ? 'Archived in Bean Conqueror' : `No brew since ${formatDate(t.lastUsed)}`);
  // Every field the edit form has, in its order and two to a row; blanks show a dash. Gear with nothing filled in shows a note instead.
  const specs = (t: Trophy) => fieldsFor(t.kind, { adjustableSpeed: t.adjustableSpeed });
  const hasSpecs = (t: Trophy) => specs(t).some((f) => t.values[f.key] !== undefined);
  const withLabel = (t: Trophy) => (t.kind === 'dripper' ? 'Favorite filter' : 'Favorite dripper');
</script>

<!-- Focus is on the body once the Edit button is gone, so Esc is caught on the window (an open help tip still closes on Esc). -->
<svelte:window onkeydown={(e) => { if (!editing || e.key !== 'Escape' || document.querySelector(':popover-open, .suggest-dialog[open]')) return; e.preventDefault(); leaving = null; }} />

{#snippet figs(t: Trophy)}
  <div class="trophy-figs">
    <span class="fig fig-avg">
      {#if t.rating === null}<b class="none">No ratings</b>{:else}<b class="hl-value">{t.rating.toFixed(1)}</b><i>avg</i>{/if}
    </span>
    <span class="fig-row">
      <span class="fig"><b>{t.brews}</b><i>{t.brews === 1 ? 'brew' : 'brews'}</i></span>
      <span class="chip-slot">{#if t.rating !== null && t.sample.small}<SampleNote s={t.sample} />{/if}</span>
      <span class="fig"><b>{formatGrams(t.grams)}</b><i>brewed</i></span>
    </span>
  </div>
{/snippet}

{#snippet img(t: Trophy, shown: { src: string; fill?: string } | null = t.image)}
  <div class="trophy-img" style:--fill={shown?.fill ?? backdrop(null)}>
    {#if shown}<img src={shown.src} alt="" loading="lazy" />{:else}<Icon name="gear" />{/if}
  </div>
{/snippet}

{#snippet stamp(iso: string)}<b><Stamp {iso} /></b>{/snippet}

{#snippet heading(t: Trophy)}
  <div class="detail-header">
    <h2 id="trophy-title" class="trophy-name" class:admin={page.data.isAdmin} class:editing>{t.name}
      <span class="badge badge-neutral">{KIND_LABEL[t.kind]}</span>
      {#if t.retired}<span class="badge badge-warm">Retired</span>{/if}
    </h2>
  </div>
{/snippet}

<!-- The dialog's action group, top right: the form's Fill and Suggest (while editing), Edit (when not), and the close button. -->
{#snippet usage(t: Trophy)}
  <section class="detail-section usage">
    <h2>Usage</h2>
    <!-- One grid, so the brews/rating row lines up under the dates row (it starts its own row; gaps are fine). -->
    <div class="stat-grid usage-grid" style="--n:{4 + (t.favorite ? 1 : 0) + (t.retired ? 1 : 0)}">
      {#if t.favorite}<div class="stat"><span class="stat-label">{withLabel(t)}</span><span class="stat-value">{t.favorite.name} ({t.favorite.brews})</span></div>{/if}
      <div class="stat"><span class="stat-label">First used</span><span class="stat-value">{formatDate(t.firstUsed)}</span></div>
      <div class="stat"><span class="stat-label">Last used</span><span class="stat-value">{formatDate(t.lastUsed)}</span></div>
      <div class="stat"><span class="stat-label">Bags</span><span class="stat-value">{t.bags}</span></div>
      <div class="stat"><span class="stat-label">Days brewed</span><span class="stat-value">{t.days}</span></div>
      {#if t.retired}<div class="stat"><span class="stat-label">Retired</span><span class="stat-value">{reason(t)}</span></div>{/if}
      <div class="stat row-start"><span class="stat-label">Brews</span><span class="stat-value">{t.brews}</span></div>
      <div class="stat"><span class="stat-label">Brewed</span><span class="stat-value">{formatGrams(t.grams)}</span></div>
      <div class="stat"><span class="stat-label">Avg dose</span><span class="stat-value">{(t.grams / t.brews).toFixed(1)}g</span></div>
      <div class="stat"><span class="stat-label">Average</span>
        <span class="stat-value">{t.rating === null ? 'No ratings' : t.rating.toFixed(1)}{#if t.rating !== null && t.sample.small}{' '}<SampleNote s={t.sample} />{/if}</span></div>
      {#if t.best !== null}<div class="stat"><span class="stat-label">Best rating</span><span class="stat-value">{t.best.toFixed(1)}</span></div>{/if}
    </div>
  </section>
{/snippet}

{#snippet topbar(tools?: Snippet)}
  <div class="trophy-top">
    {#if tools}{@render tools()}{/if}
    {#if page.data.isAdmin && !editing}
      <button type="button" class="button button-secondary" onclick={() => (editing = true)}><Icon name="edit" /> Edit</button>
    {/if}
    <button type="button" class="trophy-close" aria-label="Close" onclick={() => { const c = editing ? form?.changes() ?? [] : []; if (c.length) leaving = c; else dlg?.close(); }}>✕</button>
  </div>
{/snippet}

{#snippet grid(items: Trophy[], retired: boolean)}
  <div class="trophy-grid" class:retired>
    {#each items as t, i (t.key)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="hl-card trophy-card" data-key={t.key} style={kindVars(t)} onclick={(e) => cardClick(e, t.key)}>
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
    <nav class="board-jump" aria-label="Jump to a section">
      <span>Jump to</span>
      {#each sections as { kind } (kind)}<a href="#gear-{kind}s">{KIND_LABEL[kind]}s</a>{/each}
    </nav>
    {#each sections as { kind, active, retired } (kind)}
      {@const shelf = !!s.retired?.includes(kind)}
      <section class="kind-section" id="gear-{kind}s" data-section="gear-{kind}s">
        <h2>{KIND_LABEL[kind]}s <span class="kind-count">{active.length}</span></h2>
        {#if active.length}{@render grid(active, false)}{/if}
        {#if retired.length}
          <button type="button" class="retired-toggle" aria-expanded={shelf} onclick={() => toggleShelf(kind)}>
            Retired ({retired.length})<span class="caret"><Icon name="caret-right" /></span>
          </button>
          {#if shelf}{@render grid(retired, true)}{/if}
        {/if}
      </section>
    {/each}

    <!-- Focus lands on the dialog, never a control. A click on the dialog itself (not its sheet) is a backdrop click. -->
    <!-- svelte-ignore a11y_autofocus, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <dialog bind:this={dlg} autofocus class="trophy-dialog" aria-labelledby="trophy-title" style={current ? kindVars(current) : ''}
      onclose={() => s.card && choose({ card: undefined })}
      oncancel={(e) => editing && e.preventDefault()}
      onclick={(e) => e.target === dlg && !editing && dlg.close()}>
      {#if current}
        {@const t = current}
        <div class="trophy-sheet">
          {#if !editing}{@render topbar()}{/if}
          <!-- The coffee page's language (routes/coffees/[slug]): .detail media + body, h-title with badges, .stat-grid facts. -->
          {#if editing}
            <!-- The edit form replaces the whole article: the photo (showing the preview), the fields and the image row share one grid. -->
            {#key t.key}
              <GearForm bind:this={form} trophy={t} bind:preview onclose={() => (editing = false)} top={topbar}>
                {#snippet head()}{@render heading(t)}{/snippet}
                {#snippet photo()}{@render img(t, preview ?? t.image)}{/snippet}
              </GearForm>
            {/key}
          {:else}
          <article class="detail trophy-detail">
            <div class="detail-media">
              {@render img(t, preview ?? t.image)}
              <!-- Under the photo: when the gear was added (BQ created / first brew, with time) and last updated. -->
              <div class="media-meta">
                <span>Added {@render stamp(t.added)}</span>
                {#if t.updatedAt}<span>Updated {@render stamp(t.updatedAt)}</span>{/if}
              </div>
            </div>
            <div class="detail-body">
              {@render heading(t)}
              {#if hasSpecs(t)}
                <div class="stat-grid specs">
                  {#each specs(t) as f (f.key)}
                    {@const v = t.values[f.key]}
                    <div class="stat"><span class="stat-label">{f.label}</span>
                      <span class="stat-value">{#if v === undefined}—{:else if f.type === 'url'}<a href={String(v)} target="_blank" rel="noopener">{hostOf(String(v))}</a>{:else}{specText(f, v)}{/if}</span></div>
                  {/each}
                </div>
              {:else}
                <p class="text-muted no-specs">No details yet.{#if page.data.isAdmin}{' '}Use Edit to add specs, cost and a photo.{/if}</p>
              {/if}
            </div>
          </article>
          {/if}
            {@render usage(t)}
          {#if !editing && links[t.key]}<a class="stats-link" href={links[t.key]}>See stats for this gear</a>{/if}
        </div>
        {#if leaving}
          <!-- Inside the dialog, so in the top layer; Escape = Keep editing (window keydown above). -->
          <div class="leave-overlay">
            <div class="leave-panel" role="alertdialog" aria-labelledby="leave-title">
              <h3 id="leave-title">Unsaved changes</h3>
              <ul>{#each leaving as c (c)}<li>{c}</li>{/each}</ul>
              <div class="leave-actions" data-button-row>
                <button type="button" class="button" bind:this={keepBtn} onclick={() => (leaving = null)}>Keep editing</button>
                <button type="button" class="button button-danger" onclick={discard}>Discard changes</button>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </dialog>
  </section>
{/if}

<style>
  /* Collapsed card: a kind-colored top edge and brew count (the number is the insights tiles' .hl-value), small figures under it. */
  .trophy-card {
    container: trophy / inline-size;
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
    position: relative;
    overflow: hidden;
  }
  /* The photo contained on its backdrop (ui-rules 18), filling the box the icon would sit in. */
  .trophy-img img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: var(--fill);
  }
  /* A square box on the collapsed card; the card's spare height goes below it. */
  .trophy-card .trophy-img {
    flex: 0 0 auto;
    aspect-ratio: 1;
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
    color: var(--color-accent);
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
    font-size: 1.5rem;
    font-weight: 700;
    color: color-mix(in srgb, var(--color-accent) 55%, var(--color-text)); /* "Roast": between the accent label above and the text */
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
  /* The average: the insights tiles' .hl-value, in the normal text color (the gear name carries the kind color); the second step of the card's hierarchy: name > average > brews | grams (beats `.fig b`). */
  .fig-avg b.hl-value {
    margin-top: 0;
    font-size: 1.25rem;
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
    font-size: 0.85rem;
  }
  /* Brews left, grams right, under a rule: the room between them and the headline is the card's breathing space. */
  .fig-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    margin-top: var(--space-2);
    padding: var(--space-2) 0 0;
    border-top: 1px solid var(--color-border);
    box-sizing: border-box;
  }
  .fig-row .fig:first-child {
    align-items: flex-start;
    justify-self: start;
  }
  .fig-row .fig:last-child {
    align-items: flex-end;
    justify-self: end;
  }
  /* The low-confidence chip sits between brews and grams; it is shorter than the figures, so the row's height is theirs. */
  /* A narrow card (a 2-up phone card, by its own width) shows the chip's icon alone in the same pill; the words stay in the
     button's aria-label and the tap/hover tip. */
  @container trophy (max-width: 219px) {
    .chip-slot :global(.sample-chip) {
      font-size: 0;
      gap: 0;
      padding: 1px 4px;
    }
    /* The icon alone is under 44px wide: widen the hit area sideways, as the 16px/6px phone padding does vertically. */
    .chip-slot :global(.sample-note) {
      padding-inline: 14px;
      margin-inline: -14px;
    }
    .chip-slot :global(.sample-chip .icon) {
      width: 14px;
      height: 14px;
    }
  }
  .chip-slot {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* Fixed columns by width, never spread over the row: every card on the page is the same size, in the active grid and on a
     retired shelf (a lone retired card is not stretched across the page). A short last row stays short. */
  .kind-section {
    container-type: inline-size;
  }
  .trophy-grid {
    --q: 2; /* the .hl-value size reads it */
    display: grid;
    grid-template-columns: repeat(var(--q), minmax(0, 1fr));
    gap: var(--space-3);
  }
  @container (min-width: 520px) {
    .trophy-grid {
      --q: 3;
    }
  }
  @container (min-width: 900px) {
    .trophy-grid {
      --q: 4;
    }
  }
  .kind-section h2 {
    margin: var(--space-4) 0 var(--space-3);
  }
  .kind-count {
    margin-left: var(--space-1);
    color: var(--color-text-muted);
    font-weight: 400;
    font-size: 0.85em;
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
  /* The action group, top right: the admin actions (Edit; Fill and Suggest later) beside the close button. */
  .leave-overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    overflow-y: auto;
    padding: var(--space-3);
    background: color-mix(in srgb, var(--color-surface) 82%, transparent);
    border-radius: var(--radius);
  }
  .leave-panel {
    width: min(24rem, 100%);
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: var(--shadow);
  }
  .leave-panel h3 {
    margin: 0 0 var(--space-2);
  }
  .leave-panel ul {
    margin: 0;
    padding-left: 1.2rem;
    overflow-wrap: anywhere;
  }
  .leave-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  .leave-actions .button {
    flex: 1 1 auto;
    margin: 0;
    text-align: center;
  }
  .trophy-top {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    position: absolute;
    top: var(--space-3);
    right: var(--space-1);
    z-index: 1;
  }
  .trophy-top :global(.button) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 44px;
    margin: 0;
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
  .trophy-detail {
    margin-top: 0;
  }
  /* The coffee page's image frame (.detail-media img): square on the picture's backdrop, border and shadow. */
  .trophy-dialog .trophy-img {
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow);
  }
  .trophy-detail .trophy-img {
    aspect-ratio: 1;
  }
  .trophy-dialog .trophy-img :global(svg) {
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
    padding-right: 3rem; /* clear of the close button; admins' Edit button needs more, below */
    overflow-wrap: anywhere;
  }
  /* Facts wrap and stretch: every row is full, no orphaned empty cell (the coffee page's auto-fill grid leaves holes). */
  .trophy-dialog .stat-grid {
    display: flex;
    flex-wrap: wrap;
  }
  .media-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem var(--space-4);
    margin-top: var(--space-2);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .trophy-name.admin {
    padding-right: 9.5rem;
  }
  /* While editing, Fill and Suggest join the group: more room (phones: Fill, Suggest and the close, ~13rem). */
  .trophy-name.admin.editing {
    padding-right: 20rem;
  }
  @media (max-width: 640px) {
    .trophy-name.admin.editing {
      padding-right: 13.5rem;
    }
  }
  /* One line each (label, date, time); the two stack when they don't fit side by side. */
  .media-meta span {
    white-space: nowrap;
  }
  .media-meta b {
    font-weight: 600;
    color: var(--color-text);
  }
  .stats-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px; /* a touch target */
  }
  /* Usage runs the dialog's full width under the photo and details. */
  .usage {
    margin-top: var(--space-4);
  }
  .trophy-dialog .usage-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .no-specs { margin-top: var(--space-3); }
  .usage-grid .row-start {
    grid-column-start: 1;
  }

  .trophy-detail .specs {
    margin-bottom: var(--space-3);
  }
  /* Two to a row, as in the edit form, so pairs (Dial min | Speed at dial min) share a row. */
  .trophy-dialog .stat-grid.specs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* An odd last fact takes the whole row, so no row has an empty cell. */
  .trophy-dialog .stat-grid.specs .stat:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
  .trophy-dialog .stat {
    flex: 1 1 8.5rem;
    min-width: 0;
  }
  .trophy-dialog .stat-value {
    overflow-wrap: anywhere;
  }
  @media (max-width: 640px) {
    /* A near-full-width sheet only as tall as its content; the square picture is capped so the facts stay in reach. */
    .trophy-dialog {
      width: calc(100% - 1rem);
      max-height: calc(100dvh - 1rem);
    }
    /* The picture sits left of the corner buttons, capped; the edit form's image row under it takes the full width. */
    .trophy-detail .trophy-img {
      max-width: 9.5rem;
    }
  }
  /* Usage on one line where there is room (phones wrap, rows stay full). */
  @media (min-width: 641px) {
    .trophy-dialog .usage-grid {
      grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    }
  }
  /* Phone landscape (333px tall): picture beside the facts. */
  @media (max-width: 1100px) and (max-height: 500px) {
    .trophy-detail {
      grid-template-columns: 11rem 1fr;
      gap: var(--space-3);
    }
    .trophy-detail .detail-media {
      width: auto;
    }
    /* The narrow photo column: a stamp wraps rather than overflowing it. */
    .media-meta span {
      white-space: normal;
    }
  }
</style>
