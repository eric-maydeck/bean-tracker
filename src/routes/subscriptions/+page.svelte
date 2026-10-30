<script lang="ts">
  import Usd from '$lib/components/Usd.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import { usd, wholeUsd } from '$lib/money';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
  import { defaultViewForWidth } from '$lib/defaultView';
  import { currentParams, pickOne } from '$lib/pageUrlState';
  import { loadChoice, serializeChoice } from '$lib/rememberedChoice';
  import { writeUrlParams } from '$lib/urlState';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { stageFieldChange, stageStatusAction, hasPending, type PendingChange } from '$lib/pendingChanges';
  import { SvelteMap } from 'svelte/reactivity';
  import { siteOrigin, subscriptionTotals, togglePauseStage, pendingLabel, pendingParts, pauseButtonLabel, effectivePaused, deleteButtonLabel, totalGramsText, urlWarning, fillValues, variantValues, variantChipLabel, type SubscriptionFillVariant } from '$lib/subscriptionView';
  import { afterFailedFill } from '$lib/coffeeFormFill';
  import type { SubscriptionRow } from '$lib/types';
  let { data, form } = $props();

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);

  type View = 'compact' | 'list';
  const VIEWS = ['compact', 'list'] as const satisfies readonly View[];
  // Bumped storage key (-v2): the old key stored a bare 'compact'/'list'
  // string with no expiry -- loadChoice expects the {value, lastUsed} JSON
  // shape, and a stale unbounded preference shouldn't silently carry over.
  const VIEW_STORAGE_KEY = 'bean-tracker-subscriptions-view-v2';
  const LEGACY_VIEW_STORAGE_KEY = 'bean-tracker-subscriptions-view';

  // Untouched = undefined -> effective width-based default. Writing/
  // remembering waits for `loaded` so a bare URL can't stomp the
  // remembered choice before afterNavigate has restored it.
  let explicitView = $state<View | undefined>(pickOne(currentParams(page.url), 'view', VIEWS));
  let loaded = $state(false);
  let widthView = $state<View>('list');
  let view = $derived(explicitView ?? widthView);
  let expandedId = $state<number | null>(null);

  // Plain `$state(new Map())` does NOT give reactive Map operations in
  // Svelte 5 — $state only deep-proxies plain objects/arrays, not built-in
  // Map/Set, so in-place `.set()`/`.delete()` calls (exactly what
  // stageFieldChange/stageStatusAction/clearPending perform) would silently
  // fail to trigger re-renders. `SvelteMap` from `svelte/reactivity` is the
  // reactive, API-compatible replacement (found the hard way — via live
  // browser testing — while implementing this task originally).
  let pending = $state(new SvelteMap<number, PendingChange>());
  let commitErrors = $state(new Map<number, string>());
  let saving = $state(false);

  afterNavigate(() => {
    widthView = defaultViewForWidth(window.innerWidth);
    const fromUrl = pickOne(currentParams(page.url), 'view', VIEWS);
    try {
      explicitView = fromUrl ?? loadChoice(localStorage.getItem(VIEW_STORAGE_KEY), VIEWS, Date.now());
      localStorage.removeItem(LEGACY_VIEW_STORAGE_KEY);
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
      explicitView = fromUrl;
    }
    loaded = true;
  });

  function setView(next: View) {
    explicitView = next;
  }

  $effect(() => {
    if (!loaded) return;
    const params = new URLSearchParams();
    if (explicitView) params.set('view', explicitView);
    writeUrlParams(params);
    try {
      if (explicitView) localStorage.setItem(VIEW_STORAGE_KEY, serializeChoice(explicitView, Date.now()));
    } catch {
      // ignore — the choice still works for this visit, it just isn't remembered
    }
  });

  function toggleExpanded(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  // Edits stage as you type: every input of a row stages the row's whole
  // field set (its inputs are tied to the row's form by form=…).
  function stageRow(id: number) {
    const formEl = document.getElementById(`sub-form-${id}`) as HTMLFormElement | null;
    if (!formEl) return;
    const fields: Record<string, string> = {};
    for (const [key, value] of new FormData(formEl).entries()) {
      if (typeof value === 'string' && key !== 'id') fields[key] = value;
    }
    // A staged Pause/Resume isn't a form input; keep it.
    const paused = pending.get(id)?.fields?.paused;
    if (paused != null) fields.paused = paused;
    stageFieldChange(pending, id, fields);
  }

  // An input's value: the staged one if any (so a re-opened editor or a view
  // switch shows what's pending), else the saved one.
  function val(sub: SubscriptionRow, key: keyof SubscriptionRow): string {
    return pending.get(sub.id)?.fields?.[key] ?? String(sub[key] ?? '');
  }

  let addUrl = $state('');
  let addRoaster = $state('');
  let addFormEl = $state<HTMLFormElement>();

  // Fill from page, per form: 'add' or a subscription's id. Transient form
  // state, so (like inline edits) never in the URL.
  type FillKey = 'add' | number;
  interface FillState {
    filling: boolean;
    error: string | null;
    offer: string | null;
    notes: string[];
    variants: SubscriptionFillVariant[];
    selected: number | null;
    lastFilled: string | null;
  }
  const NO_FILL: FillState = { filling: false, error: null, offer: null, notes: [], variants: [], selected: null, lastFilled: null };
  let fills = $state(new SvelteMap<FillKey, FillState>());
  const fillOf = (key: FillKey) => fills.get(key) ?? NO_FILL;
  const patchFill = (key: FillKey, patch: Partial<FillState>) => fills.set(key, { ...fillOf(key), ...patch });
  const hasFillOutput = (key: FillKey) => !!(fillOf(key).error || fillOf(key).notes.length || fillOf(key).variants.length);

  // The Add form, or the hidden form an edit row's inputs belong to (form=…).
  function formFor(key: FillKey): HTMLFormElement | null {
    return key === 'add' ? (addFormEl ?? null) : (document.getElementById(`sub-form-${key}`) as HTMLFormElement | null);
  }

  function inputValue(form: HTMLFormElement, name: string): string {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement ? el.value : '';
  }

  // Sets each input and fires the input event typing fires, so the Add
  // form's bindings update and an edit row stages exactly as if typed.
  function writeFields(form: HTMLFormElement, values: Record<string, string | number>) {
    for (const [name, value] of Object.entries(values)) {
      const el = form.elements.namedItem(name);
      if (!(el instanceof HTMLInputElement) || el.value === String(value)) continue;
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // savedUrl: what a failed fill reverts the field to (the coffee form's rule).
  async function fillFromPage(key: FillKey, savedUrl: string) {
    const form = formFor(key);
    if (!form) return;
    const url = inputValue(form, 'subscription_url').trim();
    patchFill(key, { error: null, offer: null });
    if (!url) {
      patchFill(key, { error: 'Paste the subscription page URL first' });
      return;
    }
    const failed = (message: string) => {
      const { revertTo, offer } = afterFailedFill(url, fillOf(key).lastFilled, savedUrl);
      writeFields(form, { subscription_url: revertTo });
      patchFill(key, { error: message, offer });
    };
    patchFill(key, { filling: true });
    try {
      const res = await fetch('/api/subscriptions/fill-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.fields) {
        // SvelteKit's own errors (e.g. 401) come back as { message }.
        failed(data.error ?? data.message ?? `Fill failed (HTTP ${res.status})`);
        return;
      }
      writeFields(form, fillValues((name) => inputValue(form, name), data.fields, key === 'add'));
      patchFill(key, { lastFilled: url, notes: data.notes, variants: data.variants, selected: data.selected });
    } catch {
      failed("Couldn't reach the server");
    } finally {
      patchFill(key, { filling: false });
    }
  }

  function chooseVariant(key: FillKey, i: number) {
    const form = formFor(key);
    if (!form) return;
    writeFields(form, variantValues(fillOf(key).variants[i]));
    patchFill(key, { selected: i });
  }

  function keepTriedUrl(key: FillKey) {
    const form = formFor(key);
    if (form) writeFields(form, { subscription_url: fillOf(key).offer ?? '' });
    patchFill(key, { offer: null });
  }

  // Enter in a URL field means "fill", not "submit".
  function fillOnEnter(e: KeyboardEvent, key: FillKey, savedUrl: string) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    fillFromPage(key, savedUrl);
  }
  function warningFor(sub: SubscriptionRow) {
    return urlWarning(val(sub, 'subscription_url'), val(sub, 'roaster_service'));
  }

  function stageDelete(sub: { id: number; roaster_service: string }) {
    if (pending.get(sub.id)?.statusAction === 'delete') {
      stageStatusAction(pending, sub.id, 'delete');
    } else if (confirm(`Delete ${sub.roaster_service}? This cannot be undone.`)) {
      stageStatusAction(pending, sub.id, 'delete');
    }
  }

  async function saveChanges() {
    saving = true;
    commitErrors = new Map();
    const changes = Array.from(pending.entries()).map(([id, change]) => ({ id, ...change }));

    try {
      const validateRes = await fetch('/api/subscriptions/validate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes })
      });
      if (!validateRes.ok) throw new Error('Validation request failed');
      const { errors } = (await validateRes.json()) as { errors: { id: number; error: string }[] };
      if (errors.length > 0) {
        const newErrors = new Map<number, string>();
        for (const e of errors) newErrors.set(e.id, e.error);
        commitErrors = newErrors;
        expandedId = errors[0].id;
        saving = false;
        return;
      }

      const commitRes = await fetch('/api/subscriptions/commit-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes })
      });
      // commit-batch returns a real JSON body ({success, error}) even on a
      // non-2xx status, so parse it regardless of `.ok` — only fall back to
      // the generic error if parsing itself fails (network failure or a
      // genuinely non-JSON response).
      let commitResult: { success: boolean; error?: string };
      try {
        commitResult = await commitRes.json();
      } catch {
        throw new Error('Commit request failed');
      }
      if (!commitResult.success) {
        commitErrors = new Map([[-1, commitResult.error ?? 'Save failed']]);
        saving = false;
        return;
      }
    } catch {
      commitErrors = new Map([[-1, 'Something went wrong saving your changes. Please check your connection and try again.']]);
      saving = false;
      return;
    }

    // Outside the try/catch above on purpose: the commit itself already
    // succeeded by this point, so a failure in invalidateAll() must not be
    // misattributed to the save as a whole via the generic catch-all error
    // message.
    pending = new SvelteMap();
    commitErrors = new Map();
    fills.clear();
    editMode = false;
    expandedId = null;
    saving = false;
    await invalidateAll();
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitErrors = new Map();
    fills.clear();
    editMode = false;
    expandedId = null;
  }

  beforeNavigate(({ cancel }) => {
    if (hasPending(pending) && !confirm('You have unsaved changes. Leave without saving?')) {
      cancel();
    }
  });

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

  let totals = $derived(subscriptionTotals(data.subscriptions));
  // One money format for the price column and its total (ui-rules 46).
  let priceWhole = $derived(wholeUsd([...data.subscriptions.map((s) => s.price), totals.price]));
  import PreviewMeta from '$lib/components/PreviewMeta.svelte';
  import { subscriptionsPreview } from '$lib/linkPreview';
</script>

<svelte:head>
  <title>Bean Tracker - Subscriptions</title>
</svelte:head>
<PreviewMeta preview={subscriptionsPreview(data.subscriptions)} />

<!-- Solid "Fill from page" in a form; in the edit table (one per row) a tonal
     "Fill", so the rows don't stack primaries and the table still fits. -->
{#snippet fillButton(key: FillKey, savedUrl: string, disabled = false, inTable = false)}
  <button
    class={inTable ? 'button button-secondary' : 'button'}
    type="button"
    aria-label={inTable ? 'Fill from page' : undefined}
    disabled={disabled || fillOf(key).filling}
    onclick={() => fillFromPage(key, savedUrl)}
  >
    {fillOf(key).filling ? 'Filling…' : inTable ? 'Fill' : 'Fill from page'}
  </button>
{/snippet}

{#snippet fillOutput(key: FillKey)}
  {@const f = fillOf(key)}
  {#if f.error}
    <p class="fill-error" role="alert">{f.error}</p>
    {#if f.offer}
      <div class="fill-offer">
        <p class="fill-note">Save <code class="fill-offer-url">{f.offer}</code> as the subscription page anyway?</p>
        <div class="fill-offer-actions">
          <button class="button button-secondary" type="button" onclick={() => keepTriedUrl(key)}>Yes</button>
          <button class="button button-ghost" type="button" onclick={() => patchFill(key, { offer: null })}>No</button>
        </div>
      </div>
    {/if}
  {/if}
  {#if f.notes.length}
    <p class="text-muted fill-note" aria-live="polite">{f.notes.join(' · ')}</p>
  {/if}
  {#if f.variants.length}
    <div class="form-field group-field">
      <span>Option</span>
      <div class="tab-group fill-sizes" role="group" aria-label="Subscription option">
        {#each f.variants as v, i (i)}
          <button type="button" aria-pressed={f.selected === i} onclick={() => chooseVariant(key, i)}>{variantChipLabel(v, i)}</button>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<div class="toolbar">
  <h1>Subscriptions</h1>
  <ShareButton />
</div>

{#if data.isAdmin}
  <div class="search-row">
    {#if editMode}
      <button class="button button-success button-solid" type="button" disabled={saving} onclick={saveChanges}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button class="button button-danger" type="button" disabled={saving} onclick={discardChanges}>Discard changes</button>
    {:else}
      <button class="button button-secondary" type="button" onclick={() => (editMode = true)}>Edit</button>
    {/if}
  </div>
  {#if commitErrors.get(-1)}
    <p class="badge badge-urgent">{commitErrors.get(-1)}</p>
  {/if}
{/if}

{#if form?.error}
  <p class="badge badge-urgent">{form.error}</p>
{/if}

<div class="form-field group-field">
  <span>View</span>
  <div class="tab-group" role="group" aria-label="View">
    <button aria-pressed={view === 'compact'} onclick={() => setView('compact')}>Compact</button>
    <button aria-pressed={view === 'list'} onclick={() => setView('list')}>Table</button>
  </div>
</div>

{#if view === 'list'}
<div class="table-scroll">
  <table class="data-table" class:editing={canEdit}>
    <thead>
      <tr>
        <th>Roaster/Service</th>
        <th>Name</th>
        <th>Price</th>
        {#if canEdit}
          <th>Bags</th>
          <th>g/bag</th>
          <th>Renewal day</th>
          <th>Subscription page</th>
          <th>Actions</th>
        {:else}
          <th>Total grams</th>
          <th>Next renewal</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each data.subscriptions as sub (sub.id)}
        <tr
          class:paused={sub.paused && !canEdit}
          class:pending={canEdit && !!pendingLabel(pending.get(sub.id))}
        >
          <td>
            {#if canEdit}
              <input
                class="inline-input"
                form={`sub-form-${sub.id}`}
                name="roaster_service"
                required
                value={val(sub, 'roaster_service')}
                disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                oninput={() => stageRow(sub.id)}
              />
            {:else if sub.subscription_url}
              <a href={siteOrigin(sub.subscription_url)} target="_blank" rel="noopener noreferrer">{sub.roaster_service}</a>
            {:else}
              {sub.roaster_service}
            {/if}
            {#if sub.paused && !canEdit}<span class="badge badge-neutral">Paused</span>{/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="subscription_name" value={val(sub, 'subscription_name')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
            {:else if sub.subscription_url}
              <a href={sub.subscription_url} target="_blank" rel="noopener noreferrer">{sub.subscription_name ?? 'Subscription page'}</a>
            {:else}
              {sub.subscription_name ?? '—'}
            {/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="price" type="number" step="0.01" value={val(sub, 'price')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
            {:else}
              {#if sub.price != null}<Usd n={sub.price} whole={priceWhole} />{:else}—{/if}
            {/if}
          </td>
          {#if !canEdit}
            <td>{sub.total_grams ?? '—'}</td>
            <td>{sub.paused ? '—' : (sub.next_renewal_date ?? '—')}</td>
          {:else}
            <td>
              <input
                class="inline-input num-input"
                form={`sub-form-${sub.id}`}
                name="bag_count"
                type="number"
                step="1"
                aria-label="Bags"
                value={val(sub, 'bag_count')}
                disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                oninput={() => stageRow(sub.id)}
              />
            </td>
            <td>
              <input
                class="inline-input num-input"
                form={`sub-form-${sub.id}`}
                name="amount_per_bag_g"
                type="number"
                step="1"
                aria-label="g/bag"
                value={val(sub, 'amount_per_bag_g')}
                disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                oninput={() => stageRow(sub.id)}
              />
              <span class="total-note">{totalGramsText(val(sub, 'bag_count'), val(sub, 'amount_per_bag_g'))}</span>
            </td>
            <td>
              <input
                class="inline-input num-input"
                form={`sub-form-${sub.id}`}
                name="renewal_day"
                type="number"
                step="1"
                min="1"
                max="31"
                placeholder="day"
                value={val(sub, 'renewal_day')}
                disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                oninput={() => stageRow(sub.id)}
              />
            </td>
            <td class="url-cell">
              <div class="inline-row">
                <input
                  class="inline-input url-input"
                  form={`sub-form-${sub.id}`}
                  name="subscription_url"
                  type="url"
                  aria-label="Subscription page"
                  placeholder="https://…"
                  value={val(sub, 'subscription_url')}
                  disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                  oninput={() => stageRow(sub.id)}
                  onkeydown={(e) => fillOnEnter(e, sub.id, sub.subscription_url ?? '')}
                />
                {@render fillButton(sub.id, sub.subscription_url ?? '', effectivePaused(sub.paused, pending.get(sub.id)), true)}
              </div>
              {#if warningFor(sub)}<p class="url-warning">{warningFor(sub)}</p>{/if}
            </td>
            <td class="actions-cell">
              <form
                id={`sub-form-${sub.id}`}
                method="POST"
                onsubmit={(e) => e.preventDefault()}
              >
                <input type="hidden" name="id" value={sub.id} />
              </form>
              <div class="sub-actions" data-button-row>
                <button
                  class="button button-secondary pause-button"
                  type="button"
                  disabled={saving}
                  onclick={() => togglePauseStage(pending, sub.id, sub.paused)}
                >
                  {pauseButtonLabel(sub.paused, pending.get(sub.id))}
                </button>
                <button
                  class="button {pending.get(sub.id)?.statusAction === 'delete' ? 'button-success' : 'button-danger'}"
                  type="button"
                  aria-pressed={pending.get(sub.id)?.statusAction === 'delete'}
                  disabled={saving}
                  onclick={() => stageDelete(sub)}
                >
                  {deleteButtonLabel(pending.get(sub.id))}
                </button>
              </div>
              <!-- Pending: the row's left accent and this chip; its tip (and its accessible name) lists what.
                   Always rendered (hidden when empty), so staging never grows the row. -->
              <span class="badge badge-neutral pending-chip" class:empty={!pendingParts(pending.get(sub.id)).length}><TextTip value label="Pending"
                tip={{ title: 'Pending changes', lines: pendingParts(pending.get(sub.id)).map((p) => p[0].toUpperCase() + p.slice(1)) }} /></span>
              {#if commitErrors.get(sub.id)}
                <p class="badge badge-urgent">{commitErrors.get(sub.id)}</p>
              {/if}
            </td>
          {/if}
        </tr>
        {#if canEdit && hasFillOutput(sub.id)}
          <tr class="fill-row">
            <td colspan="8">{@render fillOutput(sub.id)}</td>
          </tr>
        {/if}
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2"><strong>Totals</strong></td>
        <td><strong>{#if totals.price != null}<Usd n={totals.price} whole={priceWhole} />{:else}—{/if}</strong></td>
        {#if canEdit}
          <td colspan="2"><strong>{totals.grams != null ? `${totals.grams}g` : '—'}</strong></td>
          <td></td>
          <td></td>
          <td></td>
        {:else}
          <td><strong>{totals.grams ?? '—'}</strong></td>
          <td></td>
        {/if}
      </tr>
    </tfoot>
  </table>
</div>
{:else}
  <div class="compact-list">
    {#each data.subscriptions as sub (sub.id)}
      <div class="compact-row-wrap">
        {#if canEdit}
          <div class="compact-row">
            <div class="compact-row-main">
              <div class="compact-row-title">
                {#if sub.subscription_url}
                  <a href={siteOrigin(sub.subscription_url)} target="_blank" rel="noopener noreferrer">{sub.roaster_service}</a>
                {:else}
                  {sub.roaster_service}
                {/if}
              </div>
              <div class="compact-row-sub text-muted">
                {#if sub.subscription_url}
                  <a href={sub.subscription_url} target="_blank" rel="noopener noreferrer">{sub.subscription_name ?? 'Subscription page'}</a>
                {:else}
                  {sub.subscription_name ?? '—'}
                {/if}
              </div>
            </div>
            <button
              type="button"
              class="nav-link-button"
              aria-expanded={expandedId === sub.id}
              onclick={() => toggleExpanded(sub.id)}
            >
              {expandedId === sub.id ? 'Done' : 'Edit'}
            </button>
          </div>
          {#if expandedId === sub.id}
            <div class="compact-row-detail">
              <div class="form-grid">
                <div class="form-field url-field">
                  <label for={`compact-url-${sub.id}`}>Subscription page</label>
                  <div class="inline-row">
                    <input
                      id={`compact-url-${sub.id}`}
                      class="inline-input url-input"
                      form={`sub-form-${sub.id}`}
                      name="subscription_url"
                      type="url"
                      placeholder="https://roaster.example/products/…"
                      value={val(sub, 'subscription_url')}
                      disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                      oninput={() => stageRow(sub.id)}
                      onkeydown={(e) => fillOnEnter(e, sub.id, sub.subscription_url ?? '')}
                    />
                    {@render fillButton(sub.id, sub.subscription_url ?? '', effectivePaused(sub.paused, pending.get(sub.id)))}
                  </div>
                  {@render fillOutput(sub.id)}
                  {#if warningFor(sub)}<p class="url-warning">{warningFor(sub)}</p>{/if}
                </div>
                <div class="form-field">
                  <label for={`compact-roaster-${sub.id}`}>Roaster/Service</label>
                  <input
                    id={`compact-roaster-${sub.id}`}
                    class="inline-input"
                    form={`sub-form-${sub.id}`}
                    name="roaster_service"
                    required
                    value={val(sub, 'roaster_service')}
                    disabled={effectivePaused(sub.paused, pending.get(sub.id))}
                oninput={() => stageRow(sub.id)}
                  />
                </div>
                <div class="form-field">
                  <label for={`compact-name-${sub.id}`}>Subscription name</label>
                  <input id={`compact-name-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="subscription_name" value={val(sub, 'subscription_name')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
                </div>
                <div class="form-field">
                  <label for={`compact-price-${sub.id}`}>Price</label>
                  <input id={`compact-price-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="price" type="number" step="0.01" value={val(sub, 'price')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
                </div>
                <div class="form-field">
                  <label for={`compact-bags-${sub.id}`}># bags</label>
                  <input id={`compact-bags-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="bag_count" type="number" step="1" value={val(sub, 'bag_count')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
                </div>
                <div class="form-field">
                  <label for={`compact-grams-${sub.id}`}>g/bag</label>
                  <input id={`compact-grams-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="amount_per_bag_g" type="number" step="1" value={val(sub, 'amount_per_bag_g')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
                </div>
                <div class="form-field">
                  <label for={`compact-day-${sub.id}`}>Renewal day</label>
                  <input id={`compact-day-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="renewal_day" type="number" step="1" min="1" max="31" value={val(sub, 'renewal_day')} disabled={effectivePaused(sub.paused, pending.get(sub.id))} oninput={() => stageRow(sub.id)} />
                </div>
              </div>
              <form
                id={`sub-form-${sub.id}`}
                method="POST"
                onsubmit={(e) => e.preventDefault()}
              >
                <input type="hidden" name="id" value={sub.id} />
              </form>
              <div class="sub-actions" data-button-row>
                <button
                  class="button button-secondary pause-button"
                  type="button"
                  disabled={saving}
                  onclick={() => togglePauseStage(pending, sub.id, sub.paused)}
                >
                  {pauseButtonLabel(sub.paused, pending.get(sub.id))}
                </button>
                <button
                  class="button {pending.get(sub.id)?.statusAction === 'delete' ? 'button-success' : 'button-danger'}"
                  type="button"
                  aria-pressed={pending.get(sub.id)?.statusAction === 'delete'}
                  disabled={saving}
                  onclick={() => stageDelete(sub)}
                >
                  {deleteButtonLabel(pending.get(sub.id))}
                </button>
              </div>
              <!-- Always rendered (hidden when empty) so it never moves the buttons. -->
              <span class="badge badge-neutral pending-slot" class:empty={!pendingLabel(pending.get(sub.id))}>
                {pendingLabel(pending.get(sub.id)) ?? 'Pending'}
              </span>
              {#if commitErrors.get(sub.id)}
                <p class="badge badge-urgent">{commitErrors.get(sub.id)}</p>
              {/if}
            </div>
          {/if}
        {:else}
          <button
            type="button"
            class="compact-row"
            class:paused={sub.paused}
            aria-expanded={expandedId === sub.id}
            onclick={() => toggleExpanded(sub.id)}
          >
            <span class="compact-row-main">
              <span class="compact-row-title">{sub.roaster_service}{#if sub.paused}<span class="badge badge-neutral">Paused</span>{/if}</span>
              <span class="compact-row-sub text-muted">{sub.subscription_name ?? '—'}</span>
            </span>
            <span class="compact-row-trailing">
              {sub.price != null ? usd(sub.price, priceWhole) : '—'}
            </span>
          </button>
          {#if expandedId === sub.id}
            <div class="compact-row-detail">
              <div class="compact-detail-grid">
                <div><span class="eyebrow">Total grams</span>{sub.total_grams ?? '—'}</div>
                <div><span class="eyebrow">Next renewal</span>{sub.paused ? '—' : (sub.next_renewal_date ?? '—')}</div>
                {#if sub.subscription_url}
                  <!-- The row above is a button, so its names can't be links; they link here. -->
                  <div class="sub-links">
                    <span class="eyebrow">Subscription page</span>
                    <a class="tap-link" href={sub.subscription_url} target="_blank" rel="noopener noreferrer">{sub.subscription_name ?? 'Subscription page'}</a>
                    (<a class="tap-link" href={siteOrigin(sub.subscription_url)} target="_blank" rel="noopener noreferrer">{sub.roaster_service}</a>)
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  <div class="compact-row-detail" style="border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-2);">
    <strong>Totals:</strong> {#if totals.price != null}<Usd n={totals.price} whole={priceWhole} />{:else}—{/if} · {totals.grams ?? '—'}g
  </div>
{/if}

{#if canEdit}
  <h2 class="section-heading">Add subscription</h2>
  <form
    method="POST"
    action="?/create"
    bind:this={addFormEl}
    use:enhance={() =>
      async ({ result, update }) => {
        await update();
        if (result.type === 'success') {
          addUrl = '';
          addRoaster = '';
          fills.delete('add');
        }
      }}
  >
    <div class="form-grid">
      <div class="form-field url-field">
        <label for="subscription_url">Subscription page</label>
        <div class="inline-row">
          <input
            id="subscription_url"
            name="subscription_url"
            type="url"
            placeholder="https://roaster.example/products/…"
            bind:value={addUrl}
            onkeydown={(e) => fillOnEnter(e, 'add', '')}
          />
          {@render fillButton('add', '')}
        </div>
        {@render fillOutput('add')}
        {#if urlWarning(addUrl, addRoaster)}<p class="url-warning">{urlWarning(addUrl, addRoaster)}</p>{/if}
      </div>
      <div class="form-field">
        <label for="roaster_service">Roaster/Service</label>
        <input id="roaster_service" name="roaster_service" required bind:value={addRoaster} />
      </div>
      <div class="form-field">
        <label for="subscription_name">Subscription name</label>
        <input id="subscription_name" name="subscription_name" />
      </div>
      <div class="form-field">
        <label for="price">Price</label>
        <input id="price" name="price" type="number" step="0.01" />
      </div>
      <div class="form-field">
        <label for="bag_count"># bags/tins</label>
        <input id="bag_count" name="bag_count" type="number" step="1" />
      </div>
      <div class="form-field">
        <label for="amount_per_bag_g">Amount per bag/tin (g)</label>
        <input id="amount_per_bag_g" name="amount_per_bag_g" type="number" step="1" />
      </div>
      <div class="form-field">
        <label for="renewal_day">Renewal day of month</label>
        <input id="renewal_day" name="renewal_day" type="number" step="1" min="1" max="31" />
      </div>
    </div>
    <button class="button" type="submit">Add</button>
  </form>
{/if}

<style>
  /* Paused: content dimmed, action buttons stay fully usable. */
  tr.paused > td:not(.actions-cell),
  .compact-row.paused .compact-row-main {
    opacity: 0.55;
  }
  /* The compact row's Edit/Done toggle: a full 44px tap target (ui-rules 4). */
  .compact-row .nav-link-button {
    min-width: 44px;
  }

  /* Pause/Resume and Delete/Restore: equal size, wide enough for the
     longest label, so swapping labels never resizes them. */
  .sub-actions {
    display: flex;
    gap: var(--space-2);
  }
  .sub-actions .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    min-width: 6.5rem;
    margin: 0;
    padding-block: 0;
    white-space: nowrap;
  }
  /* The pending badge's slot is always there (hidden when empty) and sits
     below the buttons, so it never moves them. */
  .pending-slot {
    margin-top: var(--space-2);
  }
  .pending-slot.empty {
    visibility: hidden;
  }

  /* Edit-mode table: rows are input height plus cell padding and the line
     under (the bags × g total, the Pending chip), everything top-aligned so
     inputs and buttons share one line; buttons exactly input height. Only a
     shown URL warning adds height. */
  .data-table.editing td {
    vertical-align: top;
  }
  /* A paused row's inputs in edit mode: visibly off. */
  .inline-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* A row with staged changes: a left accent and the Pending chip under its
     buttons (its slot always kept, so staging adds no height). */
  tr.pending > td:first-child {
    box-shadow: inset 4px 0 0 var(--color-accent);
  }
  .data-table .inline-input,
  .data-table .sub-actions .button {
    box-sizing: border-box;
    height: 2.25rem;
  }
  /* Wide enough for both buttons. */
  .actions-cell {
    width: 15rem;
    min-width: 15rem;
  }
  /* Inputs fill their cells down to a usable minimum, so the table fits a
     desktop window; .table-scroll only catches phones. */
  .data-table .inline-input {
    width: 100%;
    max-width: none;
    min-width: 4rem;
  }
  .data-table input[name='roaster_service'] {
    min-width: 7rem;
  }
  .data-table input[name='subscription_name'] {
    min-width: 13rem;
  }
  /* The bags × g total under the g/bag input. */
  /* The Pending chip sits midway between the buttons and the row's divider: a block (no line-box strut) whose gap
     above equals the cell's bottom padding. The total under g/bag lines up with the chip's text: the same gap plus
     the badge's top padding, the badge's font size; its left edge is the g/bag input's text (border + padding). */
  .total-note {
    display: block;
    margin-top: calc(var(--space-2) + 0.15rem);
    padding-left: calc(1px + 0.5rem);
    font-size: 0.8rem;
    white-space: nowrap;
    color: var(--color-text-muted);
  }
  .pending-chip {
    display: block;
    width: fit-content;
    margin-top: var(--space-2);
  }
  .pending-chip.empty {
    visibility: hidden;
  }
  /* Small numbers: just wide enough for their value plus the spinner. */
  .data-table .num-input {
    width: calc(5ch + 2rem);
    min-width: 0;
  }
  .data-table .url-input {
    min-width: 9rem;
  }
  /* Phones: fixed widths and the table scrolls (a 100% input in a squeezed
     cell overflows it in Firefox). */
  @media (max-width: 640px) {
    .data-table .inline-input {
      width: 8rem;
    }
    /* Phone buttons are 44px tall (app.css), the inputs 2.25rem: the total drops by the difference to stay on the
       chip's line. */
    .total-note {
      margin-top: calc(var(--space-2) + 0.15rem + 44px - 2.25rem);
    }
    .data-table .num-input {
      width: calc(5ch + 2rem);
    }
    .data-table .url-input {
      width: 16rem;
    }
  }

  /* Compact editor: the URL spans the field grid; the buttons sit on the
     same grid (.form-grid's tracks): Pause in the first column, Delete in
     the last, input height. Where the fields go single-column (phones), the
     min() makes two equal columns so the buttons share the row. */
  .url-field {
    grid-column: 1 / -1;
  }
  .compact-row-detail .sub-actions {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(220px, calc(50% - var(--space-5) / 2)), 1fr));
    column-gap: var(--space-5);
    max-width: 720px;
  }
  .compact-row-detail .sub-actions .button:last-child {
    grid-column: -2 / -1;
  }
  .compact-row-detail .inline-input,
  .compact-row-detail .sub-actions .button {
    box-sizing: border-box;
    height: 2.5rem;
  }

  /* URL + Fill from page: the coffee form's product URL row (CoffeeForm.svelte). */
  .inline-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: stretch;
  }
  .inline-row input {
    flex: 1;
    /* A real floor, so a narrow row wraps the button below the input. */
    min-width: 10rem;
  }
  .inline-row .button {
    flex-shrink: 0;
    margin: 0;
    white-space: nowrap;
  }
  /* The edit table keeps URL and button on one line (the table scrolls). */
  .url-cell .inline-row {
    flex-wrap: nowrap;
  }
  .data-table .url-cell .button {
    box-sizing: border-box;
    height: 2.25rem;
    padding-block: 0;
    padding-inline: 0.75rem;
  }
  .data-table .url-cell .url-input {
    min-width: 8rem;
  }
  /* The compact editor's URL input stretches to the button's height (44px
     on phones), so the two line up. */
  .compact-row-detail .url-field .inline-input {
    height: auto;
    min-height: 2.5rem;
  }
  /* A sentence, so it wraps (a badge never does). */
  .fill-error {
    margin: var(--space-2) 0 0;
    color: var(--color-urgent);
    font-size: 0.85rem;
  }
  .fill-row td {
    padding-top: 0;
  }
  .fill-note {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  .fill-sizes {
    margin-top: var(--space-2);
  }
  .fill-offer-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .fill-offer-actions .button {
    flex: 1;
    margin: 0;
    text-align: center;
  }
  .fill-offer-url {
    overflow-wrap: anywhere;
  }

  .url-warning {
    margin: var(--space-2) 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  /* Compact detail: the links line spans the grid, and each link is a
     44px tap target. */
  .sub-links {
    grid-column: 1 / -1;
  }
  .tap-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
</style>
