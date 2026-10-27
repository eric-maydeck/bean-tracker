<script lang="ts">
  import Usd from '$lib/components/Usd.svelte';
  import PreviewMeta from '$lib/components/PreviewMeta.svelte';
  import { coffeePreview } from '$lib/linkPreview';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { goto, invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import { coffeeImage } from '$lib/coffeeImage';
  import { isFrozen } from '$lib/coffeeFilters';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import { originWithFlag } from '$lib/countryFlags';
  import { formatDate, formatUpdated } from '$lib/formatDate';
  import { localDate } from '$lib/localDate';
  import {
    stageFieldChange,
    stageStatusAction,
    hasPending,
    mergeStagedCoffee,
    clonePrefill,
    type PendingChange
  } from '$lib/pendingChanges';
  import { SvelteMap } from 'svelte/reactivity';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import AddedToast from '$lib/components/AddedToast.svelte';
  import type { CoffeeRow } from '$lib/types';
  import { formatBag } from '$lib/grams';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { deltaInk, likeGap } from '$lib/components/deltaColor';
  import FavoriteGrind from './FavoriteGrind.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import { DIAL_LABEL, RATINGS_LABEL, insightsParams, type LikeView } from '$lib/insightsUrl';

  let { data, form } = $props();

  // Vs like coffees under ?ratings / ?dial / ?caffeine (gate P4): the panel names the view; any explicit one offers
  // Back to defaults. The coffee page never writes the insights remembered view.
  let v = $derived(data.likeView);
  let explicit = $derived(Object.keys(v).length > 0);
  const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
  const fixText = (f: LikeView) =>
    [f.ratings === 'all' && 'all ratings', f.dial === 'all' && 'all brews', f.caffeine === 'all' && 'decaf included'].filter(Boolean).join(' and ');

  let clonePrefillData = $state<Partial<CoffeeRow> | null>(null);
  // The same modal with an empty form is "+ Add Coffee": stays on this page.
  let adding = $state(false);
  let addedSlug = $state<string | null>(null);

  function openModal(prefill: Partial<CoffeeRow>, add = false) {
    adding = add;
    clonePrefillData = prefill;
  }

  // Add and Clone both stay here and show the Open/Close popup.
  function cloneCreated() {
    addedSlug = (form && 'slug' in form ? form.slug : null) ?? null;
    clonePrefillData = null;
  }

  let shareUrl = $state<string | null>(null);
  let shareQrDataUrl = $state<string | null>(null);

  // Bean Conqueror's share/QR format can't carry a half-step roast degree
  // or fractional cents (both are whole-number-only in their wire format —
  // see beanConquerorShare.ts) — surfaced here so the exact values this
  // coffee should actually have are obvious and easy to correct by hand
  // after importing, rather than silently trusting whatever number Bean
  // Conqueror displays.
  let shareRoastDegrees = $derived(data.roastLevels.find((r) => r.roast_level === data.coffee.roast_level)?.degrees_of_roast ?? null);

  async function shareToBeanConqueror() {
    // Imported here rather than at the top of the module on purpose:
    // protobufjs and qrcode together are ~160KB of JS that every visitor to
    // every coffee page would otherwise download, for a button most of them
    // never press. Dynamic import moves both into a chunk fetched on click.
    const [{ buildShareUrl }, { default: QRCode }] = await Promise.all([
      import('$lib/beanConquerorShare'),
      import('qrcode')
    ]);
    const url = await buildShareUrl(data.coffee, data.roastLevels);
    shareUrl = url;
    shareQrDataUrl = await QRCode.toDataURL(url);
  }

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);
  let detailImage = $derived(coffeeImage(data.coffee, `${data.coffee.coffee_name} label`));

  // Plain `$state(new Map())` does NOT give reactive Map operations in
  // Svelte 5 — $state only deep-proxies plain objects/arrays, not built-in
  // Map/Set, so in-place `.set()`/`.delete()` calls (exactly what
  // stageFieldChange/stageStatusAction/clearPending perform) would silently
  // fail to trigger re-renders. `SvelteMap` from `svelte/reactivity` is the
  // reactive, API-compatible replacement (found the hard way — via live
  // browser testing — while implementing this task originally).
  let pending = $state(new SvelteMap<number, PendingChange>());
  let commitError = $state<string | null>(null);
  let saving = $state(false);
  let savedSlug: string | undefined;

  // The edit form's instance, when rendered (canEdit) — plain (not
  // $state): only ever read synchronously from within saveChanges.
  let formRef: { applyPendingEdits: () => boolean } | null = null;

  // SvelteKit reuses this component when navigating from one coffee to
  // another (e.g. landing on a freshly saved clone), so per-coffee UI state
  // has to reset when the coffee changes — otherwise the previous coffee's
  // edit mode, staged edits and share QR carry over onto the new page. Keyed
  // on id, not slug, so a staged slug rename (same coffee) keeps its state.
  let shownCoffeeId = untrack(() => data.coffee.id);
  $effect.pre(() => {
    if (data.coffee.id === shownCoffeeId) return;
    shownCoffeeId = data.coffee.id;
    editMode = false;
    pending.clear();
    commitError = null;
    shareUrl = null;
    shareQrDataUrl = null;
    clonePrefillData = null;
  });

  function stageFields(fields: Record<string, string>) {
    stageFieldChange(pending, data.coffee.id, fields);
  }

  function stageDelete() {
    if (pending.get(data.coffee.id)?.statusAction === 'delete') {
      stageStatusAction(pending, data.coffee.id, 'delete');
    } else if (confirm(`Delete ${data.coffee.coffee_name} by ${data.coffee.roaster}? This cannot be undone.`)) {
      stageStatusAction(pending, data.coffee.id, 'delete');
    }
  }

  let formCoffee = $derived.by(() => mergeStagedCoffee(data.coffee, pending.get(data.coffee.id)?.fields));

  async function saveChanges() {
    // Apply the open edit form's pending changes first, the same way its
    // own "Update" button would (same stageFields/onstage call) — otherwise
    // "Save changes" would silently ignore whatever is still sitting in the
    // form. A validation failure there (native required-field UI) aborts
    // the save, matching what clicking Update itself would do. Skipped when
    // this coffee is staged for deletion: the form stays mounted alongside
    // the "Delete this coffee" button on this page, and
    // stageStatusAction deliberately drops any staged field edit when
    // staging 'delete' (pendingChanges.ts) — applying the open form here
    // would silently re-attach fields onto that delete, letting a field
    // validation error block the delete or running a pointless update
    // right before it.
    const isDeleting = pending.get(data.coffee.id)?.statusAction === 'delete';
    if (canEdit && !isDeleting && formRef && !formRef.applyPendingEdits()) return;

    saving = true;
    commitError = null;
    const changes = Array.from(pending.entries()).map(([id, change]) => ({ id, ...change }));
    const wasDeleted = pending.get(data.coffee.id)?.statusAction === 'delete';

    try {
      const validateRes = await fetch('/api/coffees/validate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes })
      });
      if (!validateRes.ok) throw new Error('Validation request failed');
      const { errors } = (await validateRes.json()) as { errors: { id: number; error: string }[] };
      if (errors.length > 0) {
        commitError = errors[0].error;
        saving = false;
        return;
      }

      const commitRes = await fetch('/api/coffees/commit-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes })
      });
      // commit-batch returns a real JSON body ({success, error}) even on a
      // non-2xx status, so parse it regardless of `.ok` — only fall back to
      // the generic error if parsing itself fails (network failure or a
      // genuinely non-JSON response).
      let commitResult: { success: boolean; error?: string; slugs?: Record<number, string> };
      try {
        commitResult = await commitRes.json();
      } catch {
        throw new Error('Commit request failed');
      }
      if (!commitResult.success) {
        commitError = commitResult.error ?? 'Save failed';
        saving = false;
        return;
      }
      savedSlug = commitResult.slugs?.[data.coffee.id];
    } catch {
      commitError = 'Something went wrong saving your changes. Please check your connection and try again.';
      saving = false;
      return;
    }

    // Outside the try/catch above on purpose: the commit itself already
    // succeeded by this point, so a failure in goto()/invalidateAll() must
    // not be misattributed to the save as a whole via the generic
    // catch-all error message.
    pending = new SvelteMap();
    editMode = false;
    saving = false;

    if (wasDeleted) {
      await goto('/coffees');
      return;
    }
    if (savedSlug && savedSlug !== data.coffee.slug) {
      await goto(`/coffees/${savedSlug}`);
      return;
    }
    await invalidateAll();
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitError = null;
    editMode = false;
  }

  beforeNavigate(({ cancel }) => {
    if (hasPending(pending) && !confirm('You have unsaved changes. Leave without saving?')) {
      cancel();
    }
  });

  // "Back" is the browser's back whenever an in-app page came before (the list, Insights, a roaster's coffees...), so the
  // page we left returns with its scroll position and its URL state. Otherwise (direct link, reload, new tab) it stays a
  // plain link to /coffees. `from` is SvelteKit's navigation info: null on the first load, never document.referrer.
  let cameFromApp = $state(false);
  afterNavigate(({ from }) => {
    cameFromApp = !!from;
  });

  function back(e: MouseEvent) {
    if (!cameFromApp || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.back();
  }

  $effect(() => {
    if (!browser) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasPending(pending)) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<svelte:head>
  <title>Bean Tracker - {data.coffee.coffee_name}</title>
</svelte:head>
<PreviewMeta preview={coffeePreview(data.coffee, detailImage)} />

<div class="detail-actions">
  <a class="button button-ghost detail-back" href="/coffees" onclick={back}>&larr; Back</a>
  <button class="button button-secondary detail-import" type="button" onclick={shareToBeanConqueror}>
    Import into Bean Conqueror
  </button>
  {#if data.isAdmin}
    <button class="button button-secondary detail-add" type="button" onclick={() => openModal({}, true)}>+ Add Coffee</button>
    <button class="button button-secondary detail-clone" type="button" onclick={() => openModal(clonePrefill(formCoffee))}>
      Clone
    </button>
  {/if}
  {#if data.isAdmin && !editMode}
    <button class="button button-secondary detail-edit" type="button" onclick={() => (editMode = true)}>Edit</button>
  {/if}
  <ShareButton />
</div>

{#if shareUrl && shareQrDataUrl}
  <div class="chart-panel">
    <div class="share-panel">
      <img src={shareQrDataUrl} alt="QR code to import this coffee into Bean Conqueror" width="140" height="140" />
      <div class="share-panel-text-and-button">
        <p class="text-muted share-panel-hint">Scan the QR code or click the button.</p>
        <a class="button button-secondary" href={shareUrl} target="_blank" rel="noopener noreferrer">Open in Bean Conqueror</a>
      </div>
    </div>
    <div class="share-panel-callout">
      <strong>Double-check these after importing</strong> — Bean Conqueror's share format can't carry exact
      half-step roast degrees or cents, so it may show something slightly off:
      <ul>
        <li>Roast level should be <strong>{shareRoastDegrees ?? '—'} beans</strong> ({data.coffee.roast_level ?? 'not set'})</li>
        <li>Cost should be <strong>{#if data.coffee.cost != null}<Usd n={data.coffee.cost} />{:else}—{/if}</strong></li>
      </ul>
    </div>
  </div>
{/if}

{#if data.isAdmin && editMode}
  <div class="search-row detail-edit-row">
    <button class="button button-success button-solid" type="button" disabled={saving} onclick={saveChanges}>
      {saving ? 'Saving…' : 'Save changes'}
    </button>
    <button class="button button-danger" type="button" disabled={saving} onclick={discardChanges}>Discard changes</button>
  </div>
{/if}
{#if data.isAdmin && commitError}
  <p class="badge badge-urgent">{commitError}</p>
{/if}

{#if canEdit}
  <CoffeeForm
    bind:this={formRef}
    coffee={formCoffee}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    roasterImages={data.roasterImages}
    origins={data.origins}
    processingMethods={data.processingMethods}
    restHistory={data.restHistory}
    subscriptions={data.subscriptions}
    onstage={stageFields}
    onclone={(prefill) => openModal(prefill)}
    showSubmit={false}
    showClone={false}
  />

  <button class="button button-danger" type="button" disabled={saving} onclick={stageDelete}>
    {pending.get(data.coffee.id)?.statusAction === 'delete' ? 'Pending: delete (Save to confirm)' : 'Delete this coffee'}
  </button>
{:else}
  <article class="detail">
    <div class="detail-media">
      {#if detailImage}
        <img src={detailImage.src} alt={detailImage.alt} style:background-color={detailImage.fill} />
      {:else}
        <div class="detail-media-placeholder" aria-hidden="true">☕</div>
      {/if}
    </div>

    <div class="detail-body">
      <div class="detail-header">
        <div>
          <h1>
            <CoffeeName name={data.coffee.coffee_name} />
            {#if data.coffee.status === 'archive'}
              <span class="badge badge-fresh">Archive</span>
            {:else if data.coffee.status === 'open'}
              <span class="badge badge-warm">Open</span>
            {:else}
              <span class="badge badge-neutral">Backlog</span>
            {/if}
            {#if data.coffee.decaf}
              <span class="badge badge-decaf">Decaf</span>
            {/if}
            {#if isFrozen(data.coffee)}
              <span class="badge badge-frozen">Frozen</span>
            {/if}
          </h1>
          <p class="text-muted">
            {data.coffee.roaster}
            {#if data.coffee.product_url}
              · <a href={data.coffee.product_url} target="_blank" rel="noopener noreferrer">Product page ↗</a>
            {/if}
          </p>
          <p class="text-muted">
            <small>Added {formatDate(data.coffee.created_at)} · Updated {formatUpdated(data.coffee.updated_at)}</small>
          </p>
          {#if data.beanConqueror}
            <div class="bc-link-line text-muted">
              <span>
                {'Bean Conqueror: '}<CoffeeName name={data.beanConqueror.name} />{` · ${data.beanConqueror.brewCount} ${data.beanConqueror.brewCount === 1 ? 'brew' : 'brews'}`}
              </span>
              {#if data.isAdmin}
                <form method="POST" action="?/unlinkBeanConqueror" use:enhance>
                  <button class="button button-ghost" type="submit">Unlink</button>
                </form>
              {/if}
            </div>
            {#if form && 'unlinkError' in form}
              <p class="badge badge-urgent">{form.unlinkError}</p>
            {/if}
          {/if}
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Origin</span>
          <span class="stat-value">{data.coffee.origin ? originWithFlag(data.coffee.origin) : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Roast level</span>
          <span class="stat-value">{data.coffee.roast_level ?? '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Processing</span>
          <span class="stat-value">{data.coffee.processing ?? '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Amount</span>
          <span class="stat-value">{data.coffee.amount_g != null ? formatBag(data.coffee.amount_g, data.coffee.grams_left) : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cost</span>
          <span class="stat-value">{#if data.coffee.cost != null}<Usd n={data.coffee.cost} />{:else}—{/if}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cost/gram</span>
          <span class="stat-value">
            {#if data.coffee.cost_per_gram != null}<Usd n={data.coffee.cost_per_gram} />{:else}—{/if}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Subscription</span>
          <span class="stat-value">{#if data.subscription}<a href="/subscriptions">{data.subscription}</a>{:else}—{/if}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Urgency</span>
          <span class="stat-value" style={urgencyColorStyle(data.coffee.urgency_rating)}>
            {data.coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(data.coffee.urgency_rating))}
          </span>
        </div>
      </div>

      <section class="detail-section timing" data-section="timing">
        <h2>Timing</h2>
        <div class="stat-grid timing-grid" class:has-fave={data.favoriteGrind.length}>
          <div class="stat">
            <span class="stat-label">Roast date</span>
            <span class="stat-value">{data.coffee.roast_date ?? '—'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Days since roast</span>
            <span class="stat-value">
              {data.coffee.days_since_roast != null ? `${data.coffee.days_since_roast}d` : '—'}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Drink after</span>
            <span class="stat-value">{data.coffee.drink_after ?? '—'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Recommended rest</span>
            <span class="stat-value">
              {data.coffee.rest_days_low ?? '—'}–{data.coffee.rest_days_high ?? '—'} days
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Drink before</span>
            <span class="stat-value">{data.coffee.drink_before ?? '—'}</span>
          </div>
          {#if data.coffee.frozen_start_date}
            <div class="stat">
              <span class="stat-label">Frozen start</span>
              <span class="stat-value">{data.coffee.frozen_start_date}</span>
            </div>
          {/if}
          {#if data.coffee.frozen_end_date}
            <div class="stat">
              <span class="stat-label">Frozen end</span>
              <span class="stat-value">{data.coffee.frozen_end_date}</span>
            </div>
          {/if}
          {#if data.coffee.opened_date}
            <div class="stat">
              <span class="stat-label">Opened</span>
              <span class="stat-value">{localDate(data.coffee.opened_date)}</span>
            </div>
          {/if}
          {#if data.coffee.status === 'archive' && data.coffee.moved_date}
            <div class="stat">
              <span class="stat-label">Archived on</span>
              <span class="stat-value">{localDate(data.coffee.moved_date)}</span>
            </div>
          {/if}
          {#if data.favoriteGrind.length}<FavoriteGrind items={data.favoriteGrind} />{/if}
        </div>
      </section>
      {#if data.like}
        {@const l = data.like}
        <section class="detail-section" data-section="like">
          <h2>Vs like coffees</h2>
          <p class="text-muted">Compared with {l.label}: all time, <span class="setting-name">{lower(DIAL_LABEL[v.dial ?? 'dialed'])}</span>, <span class="setting-name">{lower(RATINGS_LABEL[v.ratings ?? 'current'])}</span>{v.caffeine ? ', decaf included' : ''}.{#if explicit}{' '}<a href="/coffees/{data.coffee.slug}" data-sveltekit-noscroll>Back to defaults</a>{/if}</p>
          <div class="stat-grid">
            <div class="stat">
              <span class="stat-label">Score</span>
              <span class="stat-value">{l.score.toFixed(1)}{#if l.sample.small}{' '}<SampleNote s={l.sample} />{/if}</span>
            </div>
            <div class="stat"><span class="stat-label">Like coffees</span><span class="stat-value">{l.groupMean.toFixed(1)}</span></div>
            <div class="stat"><span class="stat-label">Gap</span><span class="stat-value {deltaInk(l.gap)}">{likeGap(l.gap)}</span></div>
            <div class="stat"><span class="stat-label">Rank</span><span class="stat-value">{l.place}</span></div>
          </div>
        </section>
      {:else if data.noLike}
        {@const n = data.noLike}
        <!-- Why there's no panel (gate P4): one line, its counts in the tip, and a link to the nearest view that has one. -->
        <section class="detail-section" data-section="like">
          <h2>Vs like coffees</h2>
          <p class="text-muted like-none">
            <TextTip label={n.why} tip={{ title: 'Why no comparison', rows: n.rows }} />
            {#if n.fix}<a href="?{insightsParams(n.fix)}" data-sveltekit-noscroll>Compare with {fixText(n.fix)}</a>{/if}
            {#if explicit}<a href="/coffees/{data.coffee.slug}" data-sveltekit-noscroll>Back to defaults</a>{/if}
          </p>
        </section>
      {/if}
    </div>
  </article>
{/if}

{#if clonePrefillData}
  <div class="modal-backdrop">
    <div class="modal">
      <h2>{adding ? 'Add Coffee' : 'Clone '}{#if !adding}<CoffeeName name={data.coffee.coffee_name} />{/if}</h2>
      <CoffeeForm
        prefill={clonePrefillData}
        roastLevels={data.roastLevels}
        roasters={data.roasters}
        roasterImages={data.roasterImages}
        origins={data.origins}
        processingMethods={data.processingMethods}
        restHistory={data.restHistory}
        subscriptions={data.subscriptions}
        formError={form?.error ?? null}
        oncancel={() => (clonePrefillData = null)}
        onsuccess={cloneCreated}
      />
    </div>
  </div>
{/if}

<AddedToast bind:slug={addedSlug} />

<style>
  /* Timing: children 1-5 are Roast date, Days since roast, Drink after, Recommended rest, Drink before, so two columns
     read Roast | Days / After | Rest / Before. From 30rem, three columns with Recommended rest under Days since roast and
     Drink before under Drink after (the cell under Roast date takes the first Frozen/Opened/Archived extra). From 44rem
     the Favorite grind block takes the last column over both rows. Below that it is last, at full width. */
  .timing {
    container-type: inline-size;
  }
  .timing-grid > :global(.fave) {
    grid-column: 1 / -1;
  }
  @container (min-width: 30rem) {
    .timing-grid {
      grid-template-columns: repeat(3, minmax(7.5rem, 1fr));
    }
    .timing-grid > :nth-child(1) { grid-area: 1 / 1; }
    .timing-grid > :nth-child(2) { grid-area: 1 / 2; }
    .timing-grid > :nth-child(3) { grid-area: 1 / 3; }
    .timing-grid > :nth-child(4) { grid-area: 2 / 2; }
    .timing-grid > :nth-child(5) { grid-area: 2 / 3; }
  }
  @container (min-width: 44rem) {
    .has-fave {
      grid-template-columns: repeat(3, minmax(7.5rem, 1fr)) minmax(15rem, 1.8fr);
    }
    .has-fave > :global(.fave) { grid-area: 1 / 4 / span 2; }
  }
  .like-none {
    margin: 0;
  }
  .like-none a {
    margin-left: var(--space-2);
  }
  .bc-link-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
</style>
