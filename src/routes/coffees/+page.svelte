<script lang="ts">
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import { coffeeImage } from '$lib/coffeeImage';
  import RoastBeans from '$lib/components/RoastBeans.svelte';
  import { invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { defaultViewForWidth } from '$lib/defaultView';
  import { originWithFlag } from '$lib/countryFlags';
  import {
    stageFieldChange,
    stageStatusAction,
    hasPending,
    mergeStagedCoffee,
    clonePrefill,
    type PendingChange
  } from '$lib/pendingChanges';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import type { CoffeeRow } from '$lib/types';
  import type { Snapshot } from './$types';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { currentParams } from '$lib/pageUrlState';
  import { applyFilters, COLUMNS, isFrozen, type ColumnKey } from '$lib/coffeeFilters';
  import {
    fromParams,
    toParams,
    isUntouched,
    loadViewState,
    resetView,
    serializeViewState,
    VIEW_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    type CoffeeViewState,
    type CoffeeView,
    type StatusTab,
    type SortKey,
    type SortDir
  } from '$lib/coffeeViewState';
  import { writeUrlParams } from '$lib/urlState';
  import { formatBag, formatGrams } from '$lib/grams';

  let { data, form } = $props();

  let roastDegrees = $derived(new Map(data.roastLevels.map((r) => [r.roast_level, r.degrees_of_roast])));
  function degreesFor(roastLevel: string | null): number {
    if (!roastLevel) return 0;
    return roastDegrees.get(roastLevel) ?? 0;
  }
  // Every text column's values across all tabs, so a hand-typed
  // `processing=washed` maps onto `Washed` (and the address bar follows).
  function knownValues(): Partial<Record<ColumnKey, string[]>> {
    const all = [...data.backlog, ...data.open, ...data.archive];
    const known: Partial<Record<ColumnKey, string[]>> = {};
    for (const c of COLUMNS) {
      if (c.kind !== 'text') continue;
      known[c.key] = [...new Set(all.map((row) => row[c.key as keyof CoffeeRow]).filter((v): v is string => typeof v === 'string'))];
    }
    return known;
  }

  // The view state the user explicitly chose (see coffeeViewState.ts):
  // mirrored into the URL and remembered for 12h. Read from the URL here so
  // SSR and the first paint already show the linked view. Untouched fields
  // fall back to the defaults below. Edit state (editMode, pending, the Add
  // form, expandedId...) is deliberately kept out of it. currentParams()
  // (pageUrlState.ts) reads `location` on the client, not `page.url`: a
  // history back to this page reports the URL it was first loaded with,
  // not the one we rewrote since -- reading that would put stale state
  // back in the URL.
  let explicit = $state<CoffeeViewState>(fromParams(currentParams(page.url), knownValues()));
  // Writing the URL/storage waits until the remembered state has been read,
  // so a bare URL can't overwrite it with the empty initial state.
  let viewStateLoaded = $state(false);
  // Untouched layout = width-based default, measured on the client (SSR
  // renders List, as before).
  let widthView = $state<CoffeeView>('list');
  let filter = $derived<StatusTab>(explicit.status ?? 'backlog');
  let query = $derived(explicit.query ?? '');
  let view = $derived<CoffeeView>(explicit.view ?? widthView);

  let editMode = $state(false);
  // A row's own Edit button opens only that row (editIds), which then gets
  // its own Save/Discard scoped to that coffee; the page-level Edit button
  // opens every row (editAll) with the toolbar's Save/Discard for all.
  let editAll = $state(false);
  const editIds = new SvelteSet<number>();
  function canEdit(id: number) {
    return editMode && data.isAdmin && (editAll || editIds.has(id));
  }
  let expandedId = $state<number | 'new' | null>(null);
  let addPrefill = $state<Partial<CoffeeRow> | null>(null);

  // Back from a coffee page (a real history back) re-expands the compact
  // row the user opened it from, so it's clear where they were.
  export const snapshot: Snapshot<number | null> = {
    capture: () => (view === 'compact' && !editMode && typeof expandedId === 'number' ? expandedId : null),
    restore: (id) => {
      if (id != null) expandedId = id;
    }
  };

  // Plain `Map` wrapped in `$state()` is NOT deeply reactive in Svelte 5 —
  // `$state()`'s proxy only wraps plain objects/arrays, so in-place
  // `.set()`/`.delete()` calls (as `stageFieldChange`/`stageStatusAction`
  // perform) would silently fail to trigger re-renders. `SvelteMap` from
  // `svelte/reactivity` is the reactive, API-compatible replacement that
  // tracks per-key reads/writes. `commitErrors` doesn't need this — it's
  // always replaced wholesale via reassignment, never mutated in place.
  let pending = $state(new SvelteMap<number, PendingChange>());
  let commitErrors = $state(new Map<number, string>());
  let saving = $state(false);

  // The currently-expanded row's CoffeeForm instance, if any — plain (not
  // $state): only ever read synchronously from within saveChanges, never
  // rendered.
  let expandedFormRef: { applyPendingEdits: () => boolean } | null = null;

  // A floating notice over the page, held a second after the reload lands.
  let refreshState = $state<'idle' | 'busy' | 'done'>('idle');
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    clearTimeout(refreshTimer);
    refreshState = 'busy';
    try {
      await invalidateAll();
      refreshState = 'done';
      refreshTimer = setTimeout(() => (refreshState = 'idle'), 1000);
    } catch {
      refreshState = 'idle';
    }
  }

  function toggleEdit(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function openAdd() {
    addPrefill = null;
    expandedId = 'new';
  }

  // Closes any open edit form and swaps in the Add form pre-filled from
  // the clone source.
  async function openClone(prefill: Partial<CoffeeRow>) {
    addPrefill = prefill;
    expandedId = 'new';
    await tick();
    document.getElementById('add-coffee')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeExpanded() {
    expandedId = null;
    addPrefill = null;
  }

  function enterEditMode() {
    editMode = true;
    editAll = true;
  }

  async function saveChanges(onlyId?: number) {
    // An open per-row edit form's changes aren't in `pending` until its own
    // "Update" button stages them — apply them first, the same way Update
    // would, so "Save changes" doesn't silently ignore whatever is still
    // sitting in an open form. A validation failure there (native required-
    // field UI) aborts the save entirely, matching what clicking Update
    // itself would do. Skipped when this row also has a delete staged (the
    // compact view shows the delete action right next to an open form):
    // stageStatusAction deliberately drops any staged field edit when
    // staging 'delete' (pendingChanges.ts), and applying the open form here
    // would silently re-attach fields onto that delete, letting a field
    // validation error block the delete or running a pointless update
    // right before it.
    const openRowId = typeof expandedId === 'number' && (onlyId == null || expandedId === onlyId) ? expandedId : null;
    const openRowIsDeleting = openRowId != null && pending.get(openRowId)?.statusAction === 'delete';
    if (openRowId != null && !openRowIsDeleting && expandedFormRef && !expandedFormRef.applyPendingEdits()) return;

    saving = true;
    const changes = Array.from(pending.entries())
      .filter(([id]) => onlyId == null || id === onlyId)
      .map(([id, change]) => ({ id, ...change }));
    if (onlyId != null && changes.length === 0) {
      saving = false;
      discardRow(onlyId);
      return;
    }

    try {
      const validateRes = await fetch('/api/coffees/validate-batch', {
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
        // Re-open the first failing row so its inline error is immediately
        // visible, rather than leaving the user to guess which row failed.
        expandedId = errors[0].id;
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
      let commitResult: { success: boolean; error?: string };
      try {
        commitResult = await commitRes.json();
      } catch {
        throw new Error('Commit request failed');
      }
      if (!commitResult.success) {
        // Atomic commit failed as a whole (Decision 5/3) — nothing was
        // partially applied. Not tied to any one row, so it isn't keyed by
        // id; surfaced via commitErrors.get(-1) in the template instead.
        commitErrors = new Map([[-1, commitResult.error ?? 'Save failed']]);
        saving = false;
        return;
      }
    } catch {
      // Network error, non-2xx response, or an unexpected response shape
      // (e.g. an expired session serializing as something other than
      // {errors: [...]} / {success: ...}) — none of these are tied to a
      // specific row, so surface generically via commitErrors.get(-1) and
      // make sure `saving` always gets reset (otherwise the disabled
      // "Save changes" button would stay stuck until a page reload).
      commitErrors = new Map([[-1, 'Something went wrong saving your changes. Please check your connection and try again.']]);
      saving = false;
      return;
    }

    // Outside the try/catch above on purpose: the commit itself already
    // succeeded by this point, so a failure in invalidateAll() (or
    // anything else here) must not be misattributed to the save as a
    // whole via the generic catch-all error message.
    if (onlyId != null) {
      saving = false;
      discardRow(onlyId);
      await invalidateAll();
      return;
    }
    pending = new SvelteMap();
    commitErrors = new Map();
    editMode = false;
    editAll = false;
    editIds.clear();
    expandedId = null;
    saving = false;
    await invalidateAll();
  }

  // A row opened by its own Edit button (not the page-level Edit): it gets
  // a Save button, and its Cancel discards that coffee's staged changes.
  function soloEdit(id: number) {
    return !editAll && editIds.has(id);
  }
  function showCancel(id: number) {
    return expandedId === id || soloEdit(id);
  }

  function discardRow(id: number) {
    pending.delete(id);
    commitErrors = new Map();
    editIds.delete(id);
    if (expandedId === id) expandedId = null;
    if (!editAll && editIds.size === 0) editMode = false;
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitErrors = new Map();
    editMode = false;
    editAll = false;
    editIds.clear();
    expandedId = null;
  }

  function formCoffeeFor(coffee: CoffeeRow): CoffeeRow {
    return mergeStagedCoffee(coffee, pending.get(coffee.id)?.fields);
  }

  beforeNavigate(({ cancel }) => {
    if (hasPending(pending) && !confirm('You have unsaved changes. Leave without saving?')) {
      cancel();
      return;
    }
    // Leaving the Coffees page counts as "using" it, so the 12h expiry
    // clock restarts here too -- otherwise sitting on the list >12h, then
    // opening a coffee and coming back, would find an already-expired key.
    stampLastUsed();
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

  // On arrival (first load, or a client navigation to /coffees while
  // already here): the URL's params win; a bare URL restores the
  // remembered state, which the effect below then writes into the URL.
  afterNavigate(() => {
    widthView = defaultViewForWidth(window.innerWidth);
    const fromUrl = fromParams(currentParams(page.url), knownValues());
    try {
      explicit = isUntouched(fromUrl) ? loadViewState(localStorage.getItem(VIEW_STORAGE_KEY), Date.now()) : fromUrl;
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
      explicit = fromUrl;
    }
    viewStateLoaded = true;
  });

  // Every save stamps lastUsed, so loading the page, changing the view, or
  // leaving the page (see beforeNavigate/pagehide) all restart the 12h
  // expiry (and overwrite an expired key).
  function stampLastUsed() {
    if (!viewStateLoaded) return;
    try {
      if (isUntouched(explicit)) localStorage.removeItem(VIEW_STORAGE_KEY);
      else localStorage.setItem(VIEW_STORAGE_KEY, serializeViewState(explicit, Date.now()));
    } catch {
      // ignore — the view still works for this visit, it just isn't remembered
    }
  }

  $effect(() => {
    if (!viewStateLoaded) return;
    writeUrlParams(toParams(explicit));
    stampLastUsed();
  });

  // beforeNavigate only covers SvelteKit client-side navigation; pagehide
  // also catches a full unload (reload, close tab, external link) so time
  // spent on the page before that still counts toward the 12h expiry.
  $effect(() => {
    if (!browser) return;
    window.addEventListener('pagehide', stampLastUsed);
    return () => window.removeEventListener('pagehide', stampLastUsed);
  });

  // Each setter records an explicit choice, even one equal to the default.
  function setView(next: CoffeeView) {
    explicit.view = next;
  }

  function setFilter(next: StatusTab) {
    explicit.status = next;
  }

  // Back to defaults (including the width-based layout), keeping the status tab.
  function reset() {
    explicit = resetView(explicit);
  }

  let source = $derived(
    filter === 'backlog'
      ? data.backlog
      : filter === 'open'
        ? data.open
        : filter === 'archive'
          ? data.archive
          : [...data.backlog, ...data.open, ...data.archive]
  );

  let coffees = $derived(
    applyFilters(
      source.filter((c) =>
        `${c.roaster} ${c.coffee_name} ${c.origin ?? ''} ${c.roast_level ?? ''} ${c.decaf ? 'decaf' : 'caffeinated'}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
      explicit.filters
    )
  );

  let sortKey = $derived<SortKey>(explicit.sort?.key ?? 'urgency');
  let sortDir = $derived<SortDir>(explicit.sort?.dir ?? 'desc');

  function setSort(key: SortKey, dir: SortDir) {
    explicit.sort = { key, dir };
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key, 'asc');
    }
  }

  function sortValue(c: (typeof coffees)[number], key: SortKey): string | number {
    switch (key) {
      case 'roaster':
        return c.roaster.toLowerCase();
      case 'coffee_name':
        return c.coffee_name.toLowerCase();
      case 'origin':
        return c.origin?.toLowerCase() ?? '';
      case 'roast_level':
        return degreesFor(c.roast_level);
      case 'decaf':
        return c.decaf ? 1 : 0;
      case 'processing':
        return c.processing?.toLowerCase() ?? '';
      case 'cost_per_gram':
        return c.cost_per_gram ?? -Infinity;
      case 'amount_g':
        return c.amount_g ?? -Infinity;
      case 'roast_date':
        return c.roast_date ?? '';
      case 'frozen_start_date':
        return c.frozen_start_date ?? '';
      case 'frozen_end_date':
        return c.frozen_end_date ?? '';
      case 'rest_window':
        return c.drink_after ?? '';
      case 'urgency':
        return typeof c.urgency_rating === 'number' ? c.urgency_rating : -Infinity;
    }
  }

  let sortedCoffees = $derived.by(() => {
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...coffees].sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  });

  // Reflects whatever combination of status tab/search/filters is
  // currently active — sorting doesn't change which rows are included, so
  // computing from `coffees` (pre-sort) rather than `sortedCoffees` would
  // give the same numbers, but deriving from the final displayed list
  // keeps this tied to "what's actually on screen" as that list evolves.
  let visibleTotalGrams = $derived(sortedCoffees.reduce((sum, c) => sum + (c.amount_g ?? 0), 0));
</script>

<svelte:head>
  <title>Bean Tracker - Coffees</title>
</svelte:head>

{#snippet cloneButton(coffee: CoffeeRow, icons = false)}
  <button class="button button-secondary" class:button-icon={icons} type="button" disabled={saving} onclick={() => openClone(clonePrefill(formCoffeeFor(coffee)))}
    title={icons ? 'Clone' : undefined} aria-label={icons ? 'Clone' : undefined}>
    {#if icons}<Icon name="clone" />{:else}Clone{/if}
  </button>
{/snippet}

{#snippet editButton(coffee: CoffeeRow, icons = false)}
  <button
    class="button button-secondary" class:button-icon={icons}
    type="button"
    title={icons ? 'Edit' : undefined} aria-label={icons ? 'Edit' : undefined}
    onclick={() => {
      editMode = true;
      editIds.add(coffee.id);
      expandedId = coffee.id;
    }}>{#if icons}<Icon name="edit" />{:else}Edit{/if}</button
  >
{/snippet}

{#snippet adminActions(coffee: CoffeeRow, icons = false)}
  <!-- Two fixed rows (save/cancel/delete over the status actions) so the
       Actions column never wraps to a third row and squeezes the table. -->
  <div class="action-stack">
    <div class="action-row">
      {#if soloEdit(coffee.id)}
        <button class="button button-success" class:button-icon={icons} type="button" disabled={saving} onclick={() => saveChanges(coffee.id)}
          title={icons ? 'Save' : undefined} aria-label={icons ? 'Save' : undefined}>
          {#if icons}<Icon name="save" />{:else}{saving ? 'Saving…' : 'Save'}{/if}
        </button>
      {/if}
      <button class="button button-secondary" class:button-icon={icons} class:button-danger={icons && showCancel(coffee.id)} type="button" disabled={saving} onclick={() => (soloEdit(coffee.id) ? discardRow(coffee.id) : toggleEdit(coffee.id))}
        title={icons ? (showCancel(coffee.id) ? 'Cancel' : 'Edit') : undefined} aria-label={icons ? (showCancel(coffee.id) ? 'Cancel' : 'Edit') : undefined}>
        {#if icons}<Icon name={showCancel(coffee.id) ? 'cancel' : 'edit'} />{:else}{showCancel(coffee.id) ? 'Cancel' : 'Edit'}{/if}
      </button>
      {#if coffee.status !== 'archive'}
        <button
          class="button button-danger" class:button-icon={icons}
          type="button"
          aria-pressed={pending.get(coffee.id)?.statusAction === 'delete'}
          disabled={saving}
          onclick={() => {
            if (pending.get(coffee.id)?.statusAction === 'delete') {
              stageStatusAction(pending, coffee.id, 'delete');
            } else if (confirm(`Delete ${coffee.coffee_name} by ${coffee.roaster}? This cannot be undone.`)) {
              stageStatusAction(pending, coffee.id, 'delete');
            }
          }}
          title={icons ? 'Delete' : undefined} aria-label={icons ? 'Delete' : undefined}
        >
          {#if icons}<Icon name="delete" />{:else}Delete{/if}
        </button>
      {/if}
    </div>
    <div class="action-row">
      {#if coffee.status === 'archive'}
        <button
          class="button button-secondary" class:button-icon={icons}
          type="button"
          aria-pressed={pending.get(coffee.id)?.statusAction === 'restore'}
          disabled={saving}
          onclick={() => stageStatusAction(pending, coffee.id, 'restore')}
          title={icons ? 'Restore' : undefined} aria-label={icons ? 'Restore' : undefined}
        >
          {#if icons}<Icon name="restore" />{:else}Restore{/if}
        </button>
      {:else}
        {#if coffee.status === 'backlog'}
          <button
            class="button" class:button-icon={icons}
            type="button"
            aria-pressed={pending.get(coffee.id)?.statusAction === 'open'}
            disabled={saving}
            onclick={() => stageStatusAction(pending, coffee.id, 'open')}
            title={icons ? 'Open' : undefined} aria-label={icons ? 'Open' : undefined}
          >
            {#if icons}<Icon name="open" />{:else}Open{/if}
          </button>
          {#if coffee.frozen_start_date && !coffee.frozen_end_date}
            <button
              class="button button-secondary" class:button-icon={icons}
              type="button"
              aria-pressed={pending.get(coffee.id)?.statusAction === 'thaw'}
              disabled={saving}
              onclick={() => stageStatusAction(pending, coffee.id, 'thaw')}
              title={icons ? 'Thaw' : undefined} aria-label={icons ? 'Thaw' : undefined}
            >
              {#if icons}<Icon name="thaw" />{:else}Thaw{/if}
            </button>
          {:else}
            <button
              class="button button-secondary" class:button-icon={icons}
              type="button"
              aria-pressed={pending.get(coffee.id)?.statusAction === 'freeze'}
              disabled={saving}
              onclick={() => stageStatusAction(pending, coffee.id, 'freeze')}
              title={icons ? 'Freeze' : undefined} aria-label={icons ? 'Freeze' : undefined}
            >
              {#if icons}<Icon name="freeze" />{:else}Freeze{/if}
            </button>
          {/if}
        {:else if coffee.status === 'open'}
          <button
            class="button button-secondary" class:button-icon={icons}
            type="button"
            aria-pressed={pending.get(coffee.id)?.statusAction === 'unopen'}
            disabled={saving}
            onclick={() => stageStatusAction(pending, coffee.id, 'unopen')}
            title={icons ? 'Unopen' : undefined} aria-label={icons ? 'Unopen' : undefined}
          >
            {#if icons}<Icon name="unopen" />{:else}Unopen{/if}
          </button>
        {/if}
        <button
          class="button button-secondary" class:button-icon={icons}
          type="button"
          aria-pressed={pending.get(coffee.id)?.statusAction === 'archive'}
          disabled={saving}
          onclick={() => stageStatusAction(pending, coffee.id, 'archive')}
          title={icons ? 'Archive' : undefined} aria-label={icons ? 'Archive' : undefined}
        >
          {#if icons}<Icon name="archive" />{:else}Archive{/if}
        </button>
      {/if}
    </div>
  </div>
  {#if pending.has(coffee.id)}
    <span class="badge badge-neutral">
      {pending.get(coffee.id)?.statusAction
        ? `Pending: ${pending.get(coffee.id)?.statusAction}`
        : 'Pending: edited'}
    </span>
  {/if}
{/snippet}

{#snippet expandedForm(coffee)}
  <CoffeeForm
    bind:this={expandedFormRef}
    coffee={formCoffeeFor(coffee)}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    roasterImages={data.roasterImages}
    origins={data.origins}
    processingMethods={data.processingMethods}
    restHistory={[...data.backlog, ...data.open, ...data.archive]}
    formError={commitErrors.get(coffee.id) ?? null}
    showSubmit={editAll}
    onclone={openClone}
    showClone={view !== 'list'}
    onstage={(fields) => {
      stageFieldChange(pending, coffee.id, fields);
      closeExpanded();
    }}
  />
{/snippet}

<h1>Coffee Collection</h1>

<div class="toolbar">
  <div class="tab-group">
    <button aria-pressed={filter === 'backlog'} onclick={() => setFilter('backlog')}>
      Backlog ({data.backlog.length})
    </button>
    <button aria-pressed={filter === 'open'} onclick={() => setFilter('open')}>
      Open ({data.open.length})
    </button>
    <button aria-pressed={filter === 'archive'} onclick={() => setFilter('archive')}>
      Archive ({data.archive.length})
    </button>
    <button aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>All</button>
  </div>

  <div class="tab-group">
    <button aria-pressed={view === 'compact'} onclick={() => setView('compact')}>Compact</button>
    <button aria-pressed={view === 'list'} onclick={() => setView('list')}>List</button>
    <button aria-pressed={view === 'cards'} onclick={() => setView('cards')}>Cards</button>
  </div>
</div>

{#if refreshState !== 'idle'}
  <div class="refresh-toast" role="status">
    {#if refreshState === 'busy'}<span class="refresh-spinner" aria-hidden="true"></span>Refreshing…{:else}Updated{/if}
  </div>
{/if}

<div class="search-row">
  <input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={explicit.query} />
  <FilterBar bind:filters={explicit.filters} coffees={source} />
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
  <button class="button button-secondary" type="button" onclick={reset}>Reset</button>
  <ShareButton />
  {#if data.isAdmin}
    {#if editAll}
      <button class="button button-success" type="button" disabled={saving} onclick={() => saveChanges()}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button class="button button-danger" type="button" disabled={saving} onclick={discardChanges}>
        Discard changes
      </button>
    {:else}
      <button class="button button-secondary" type="button" onclick={enterEditMode}>Edit</button>
    {/if}
  {/if}
  {#if commitErrors.get(-1)}
    <p class="badge badge-urgent">{commitErrors.get(-1)}</p>
  {/if}
</div>

<p class="text-muted">
  {sortedCoffees.length} coffee{sortedCoffees.length === 1 ? '' : 's'} · {formatGrams(visibleTotalGrams)}
</p>

{#if data.isAdmin}
  {#if expandedId === 'new'}
    <!-- Keyed so a second clone while the form is open starts from a fresh form. -->
    {#key addPrefill}
      <div id="add-coffee">
        <CoffeeForm
          prefill={addPrefill}
          roastLevels={data.roastLevels}
          roasters={data.roasters}
          roasterImages={data.roasterImages}
          origins={data.origins}
          processingMethods={data.processingMethods}
          restHistory={[...data.backlog, ...data.open, ...data.archive]}
          formError={form?.error ?? null}
          oncancel={closeExpanded}
          onsuccess={closeExpanded}
        />
      </div>
    {/key}
  {:else}
    <div class="search-row">
      <button class="button" type="button" onclick={openAdd}>+ Add Coffee</button>
    </div>
  {/if}
{/if}

{#if view === 'cards'}
  <section class="grid">
    {#each coffees as coffee (coffee.id)}
      {#if data.isAdmin}
        <div class="card">
          {#if canEdit(coffee.id) && expandedId === coffee.id}
            {@render expandedForm(coffee)}
            <!-- Save/Cancel under the open form, like Compact: the card's own
                 action row is replaced by the form. -->
            <div class="action-buttons under-form">
              {@render adminActions(coffee, true)}
            </div>
          {:else}
            {@const img = coffeeImage(coffee, '')}
            <div class="card-body">
              {#if img}
                <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
              {/if}
              <h2><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></h2>
              <p class="text-muted">{coffee.roaster}</p>
              <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
              <p class="roast-row">
                <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
                <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
              </p>
              {#if coffee.processing}
                <p class="text-muted">{coffee.processing}</p>
              {/if}
              <p class="text-muted">
                {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : 'Cost unknown'}
                {coffee.amount_g != null ? ` · ${formatBag(coffee.amount_g, coffee.grams_left)}` : ''}
              </p>
              {#if coffee.roast_date}
                <p class="text-muted">
                  Roasted {coffee.roast_date}
                  {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
                </p>
              {/if}
              {#if coffee.drink_after && coffee.drink_before}
                <p class="text-muted">Rest window: {coffee.drink_after} – {coffee.drink_before}</p>
              {/if}
              {#if coffee.status === 'archive'}
                <span class="badge badge-fresh">Archive</span>
              {:else if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
              {#if coffee.decaf}
                <span class="badge badge-decaf">Decaf</span>
              {/if}
              {#if isFrozen(coffee)}
                <span class="badge badge-frozen">Frozen</span>
              {/if}
            </div>
            <div class="action-buttons">
              {#if canEdit(coffee.id)}
                {@render adminActions(coffee, true)}
              {:else}
                {@render editButton(coffee, true)}
                {@render cloneButton(coffee, true)}
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        {@const img = coffeeImage(coffee, '')}
        <a class="card" href={`/coffees/${coffee.slug}`}>
          {#if img}
            <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
          {/if}
          <h2>{coffee.coffee_name}</h2>
          <p class="text-muted">{coffee.roaster}</p>
          <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
          <p class="roast-row">
            <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
          </p>
          {#if coffee.processing}
            <p class="text-muted">{coffee.processing}</p>
          {/if}
          <p class="text-muted">
            {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : 'Cost unknown'}
            {coffee.amount_g != null ? ` · ${formatBag(coffee.amount_g, coffee.grams_left)}` : ''}
          </p>
          {#if coffee.roast_date}
            <p class="text-muted">
              Roasted {coffee.roast_date}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </p>
          {/if}
          {#if coffee.drink_after && coffee.drink_before}
            <p class="text-muted">Rest window: {coffee.drink_after} – {coffee.drink_before}</p>
          {/if}
          {#if coffee.status === 'archive'}
            <span class="badge badge-fresh">Archive</span>
          {:else if coffee.status === 'open'}
            <span class="badge badge-warm">Open</span>
          {:else}
            <span class="badge badge-neutral">Backlog</span>
          {/if}
          {#if coffee.decaf}
            <span class="badge badge-decaf">Decaf</span>
          {/if}
          {#if isFrozen(coffee)}
            <span class="badge badge-frozen">Frozen</span>
          {/if}
        </a>
      {/if}
    {/each}
  </section>
{:else if view === 'compact'}
  <div class="compact-list">
    {#each sortedCoffees as coffee (coffee.id)}
      <div class="compact-row-wrap">
        {#if canEdit(coffee.id)}
          <div class="compact-row">
            <div class="compact-row-main">
              <div class="compact-row-title">
                <a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a>
                {#if coffee.decaf}<span class="badge badge-decaf">Decaf</span>{/if}{#if isFrozen(coffee)}<span class="badge badge-frozen">Frozen</span>{/if}
              </div>
              <div class="compact-row-sub text-muted">
                {coffee.roaster} · {coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}
              </div>
            </div>
            <div class="compact-row-trailing" style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </div>
          </div>
          {#if expandedId === coffee.id}
            {@render expandedForm(coffee)}
          {/if}
          <div class="action-buttons">
            {@render adminActions(coffee, true)}
          </div>
        {:else}
          <button
            type="button"
            class="compact-row"
            aria-expanded={expandedId === coffee.id}
            onclick={() => toggleEdit(coffee.id)}
          >
            <span class="compact-row-main">
              <span class="compact-row-title">
                {coffee.coffee_name}
                {#if coffee.decaf}<span class="badge badge-decaf">Decaf</span>{/if}{#if isFrozen(coffee)}<span class="badge badge-frozen">Frozen</span>{/if}
              </span>
              <span class="compact-row-sub text-muted">
                {coffee.roaster} · {coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}
              </span>
            </span>
            <span class="compact-row-trailing" style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </span>
          </button>
          {#if expandedId === coffee.id}
            <div class="compact-row-detail">
              <div class="compact-detail-grid">
                <div><span class="eyebrow">Roast</span>{coffee.roast_level ?? '—'}</div>
                <div><span class="eyebrow">Processing</span>{coffee.processing ?? '—'}</div>
                <div>
                  <span class="eyebrow">Cost/g · amount</span>
                  {coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}/g` : '—'}{#if coffee.amount_g != null}
                    · <span class="nowrap">{formatBag(coffee.amount_g, coffee.grams_left)}</span>{/if}
                </div>
                <div>
                  <span class="eyebrow">Roasted</span>
                  {coffee.roast_date ?? '—'}{coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
                </div>
                <div>
                  <span class="eyebrow">Rest window</span>
                  {#if coffee.drink_after && coffee.drink_before}{coffee.drink_after} – {coffee.drink_before}{:else}—{/if}
                </div>
                <div><span class="eyebrow">Frozen</span>{coffee.frozen_start_date ?? '—'}</div>
                <div><span class="eyebrow">Unfrozen</span>{coffee.frozen_end_date ?? '—'}</div>
              </div>
              {#if coffee.status === 'archive'}
                <span class="badge badge-fresh">Archive</span>
              {:else if coffee.status === 'open'}
                <span class="badge badge-warm">Open</span>
              {:else}
                <span class="badge badge-neutral">Backlog</span>
              {/if}
            </div>
          {/if}
          {#if expandedId === coffee.id}
            <div class="action-buttons">
              <a class="button button-secondary button-icon" href={`/coffees/${coffee.slug}`} title="Open coffee page" aria-label="Open coffee page"><Icon name="page" /></a>
              {#if data.isAdmin}
                {@render editButton(coffee, true)}
                {@render cloneButton(coffee, true)}
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="table-scroll">
    <table class="data-table compact">
      <colgroup>
        <col style="width: 7%" />
        <col style="width: 11%" />
        <col style="width: 6%" />
        <col style="width: 6%" />
        <col style="width: 4%" />
        <col style="width: 7%" />
        <col style="width: 5%" />
        <col style="width: 9%" />
        <col style="width: 7%" />
        <col style="width: 7%" />
        <col style="width: 7%" />
        <col style="width: 8%" />
        <col style="width: 5%" />
        {#if data.isAdmin}
          <col style="width: 11%" />
        {/if}
      </colgroup>
      <thead>
        <tr>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roaster')}>
              Roaster
              <span class="sort-indicator"
                >{sortKey === 'roaster' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('coffee_name')}>
              Coffee
              <span class="sort-indicator"
                >{sortKey === 'coffee_name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('origin')}>
              Origin
              <span class="sort-indicator"
                >{sortKey === 'origin' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roast_level')}>
              Roast
              <span class="sort-indicator"
                >{sortKey === 'roast_level' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('decaf')}>
              Decaf
              <span class="sort-indicator"
                >{sortKey === 'decaf' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('processing')}>
              Processing
              <span class="sort-indicator"
                >{sortKey === 'processing' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('cost_per_gram')}>
              Cost/g
              <span class="sort-indicator"
                >{sortKey === 'cost_per_gram' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('amount_g')}>
              Amount
              <span class="sort-indicator"
                >{sortKey === 'amount_g' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('roast_date')}>
              Roasted
              <span class="sort-indicator"
                >{sortKey === 'roast_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('frozen_start_date')}>
              Frozen
              <span class="sort-indicator"
                >{sortKey === 'frozen_start_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('frozen_end_date')}>
              Unfrozen
              <span class="sort-indicator"
                >{sortKey === 'frozen_end_date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('rest_window')}>
              Rest window
              <span class="sort-indicator"
                >{sortKey === 'rest_window' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          <th>
            <button class="sort-button" onclick={() => toggleSort('urgency')}>
              Urgency
              <span class="sort-indicator"
                >{sortKey === 'urgency' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span
              >
            </button>
          </th>
          {#if data.isAdmin}
            <th>Actions</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each sortedCoffees as coffee (coffee.id)}
          <tr>
            <td>{coffee.roaster}</td>
            <td><a href={`/coffees/${coffee.slug}`}>{coffee.coffee_name}</a></td>
            <td>{coffee.origin ? originWithFlag(coffee.origin) : '—'}</td>
            <td>
              <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            </td>
            <td>{coffee.decaf ? 'Yes' : 'No'}</td>
            <td>{coffee.processing ?? '—'}</td>
            <td>{coffee.cost_per_gram != null ? `$${coffee.cost_per_gram.toFixed(3)}` : '—'}</td>
            <td class="nowrap">{coffee.amount_g != null ? formatBag(coffee.amount_g, coffee.grams_left) : '—'}</td>
            <td>
              {coffee.roast_date ?? '—'}
              {#if coffee.days_since_roast != null}<br />({coffee.days_since_roast}d ago){/if}
            </td>
            <td>{coffee.frozen_start_date ?? '—'}</td>
            <td>{coffee.frozen_end_date ?? '—'}</td>
            <td>
              {#if coffee.drink_after && coffee.drink_before}
                {coffee.drink_after} –<br />{coffee.drink_before}
              {:else}
                —
              {/if}
            </td>
            <td style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </td>
            {#if data.isAdmin}
              <td>
                <div class="action-buttons">
                  {#if canEdit(coffee.id)}
                    <!-- While this row's form is open its actions sit under the form (below). -->
                    {#if expandedId !== coffee.id}
                      {@render adminActions(coffee, true)}
                    {/if}
                  {:else}
                    {@render editButton(coffee, true)}
                    {@render cloneButton(coffee, true)}
                  {/if}
                </div>
              </td>
            {/if}
          </tr>
          {#if canEdit(coffee.id) && expandedId === coffee.id}
            <tr>
              <td colspan={data.isAdmin ? 14 : 13}>
                {@render expandedForm(coffee)}
                <!-- Under the form, like Compact: on a phone the row above is off-screen. -->
                <div class="action-buttons under-form">
                  {@render adminActions(coffee, true)}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .refresh-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 90;
    transform: translate(-50%, -50%);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-6);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    box-shadow: var(--shadow-hover);
    font-weight: 600;
    font-size: 1.1rem;
    white-space: nowrap;
    animation: refresh-toast-in 150ms ease-out;
  }
  .refresh-spinner {
    width: 0.9em;
    height: 0.9em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: refresh-spin 700ms linear infinite;
  }
  @keyframes refresh-spin {
    to {
      rotate: 360deg;
    }
  }
  @keyframes refresh-toast-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .refresh-toast,
    .refresh-spinner {
      animation: none;
    }
  }
</style>
