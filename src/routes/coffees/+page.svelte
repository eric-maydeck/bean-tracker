<script lang="ts">
  import { formatDate } from '#lib/formatDate.ts';
  import { labelTip } from '#lib/components/labelTip.ts';
  import { bqImportHref } from '#lib/bqImportUrl.ts';
  import { coffeeToast, commitChanges, restoreStates, undoable, type States } from '#lib/coffeeToast.ts';
  import { showToast } from '#lib/toast.svelte.ts';
  import Usd from '#lib/components/Usd.svelte';
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import { usd } from '#lib/money.ts';
  import { browser } from '$app/env';
  import { urgencyColorStyle } from '#lib/urgencyColor.ts';
  import { coffeeImage } from '#lib/coffeeImage.ts';
  import RoastBeans from '#lib/components/RoastBeans.svelte';
  import { beforeNavigate, afterNavigate, snapshot } from '$app/navigation';
  import { page } from '$app/state';
  import CoffeeForm from '#lib/components/CoffeeForm.svelte';
  import CoffeeEditModal from '#lib/components/CoffeeEditModal.svelte';
  import CoffeeStatusActions from '#lib/components/CoffeeStatusActions.svelte';
  import AddedToast from '#lib/components/AddedToast.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import CollapsibleBar from '#lib/components/CollapsibleBar.svelte';
  import { defaultViewForWidth } from '#lib/defaultView.ts';
  import { originWithFlag } from '#lib/countryFlags.ts';
  import {
    stageFieldChange,
    stageStatusAction,
    hasPending,
    mergeStagedCoffee,
    clonePrefill,
    type PendingChange
  } from '#lib/pendingChanges.ts';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import type { CoffeeRow } from '#lib/types.ts';
  import FilterBar from '#lib/components/FilterBar.svelte';
  import ShareButton from '#lib/components/ShareButton.svelte';
  import { currentParams } from '#lib/pageUrlState.ts';
  import { applyFilters, COLUMNS, previewChip, isFrozen, withoutStalePlans, type ColumnKey } from '#lib/coffeeFilters.ts';
  import PreviewMeta from '#lib/components/PreviewMeta.svelte';
  import { coffeesPreview } from '#lib/linkPreview.ts';
  import {
    fromParams,
    toParams,
    isUntouched,
    SORT_KEYS,
    loadViewState,
    resetView,
    serializeViewState,
    toggleStatus,
    litStatuses,
    VIEW_STORAGE_KEY,
    LEGACY_STORAGE_KEYS,
    type CoffeeViewState,
    type CoffeeView,
    type StatusTab,
    type Status,
    type SortKey,
    type SortDir
  } from '#lib/coffeeViewState.ts';
  import { writeUrlParams, refreshTracked } from '#lib/urlState.ts';
  import { formatBag, formatGrams } from '#lib/grams.ts';

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
  // fall back to the defaults below. Edit state (editAll, pending, the Add
  // form, expandedId...) is deliberately kept out of it. currentParams()
  // (pageUrlState.ts) reads `location` on the client, not `page.url`: a
  // history back to this page reports the URL it was first loaded with,
  // not the one we rewrote since -- reading that would put stale state
  // back in the URL.
  let explicit = $state<CoffeeViewState>(withoutStalePlans(fromParams(currentParams(page.url), knownValues()), data.plans));
  // Writing the URL/storage waits until the remembered state has been read,
  // so a bare URL can't overwrite it with the empty initial state.
  let viewStateLoaded = $state(false);
  // Untouched layout = width-based default, measured on the client (SSR
  // renders List, as before).
  let widthView = $state<CoffeeView>('list');
  let lit = $derived<StatusTab[]>(explicit.status ?? ['backlog']);
  let query = $derived(explicit.query ?? '');
  let view = $derived<CoffeeView>(explicit.view ?? widthView);

  // The toolbar's Edit opens every row inline (editAll) with the toolbar's Save/Discard for all. A row's own Edit
  // button opens that coffee in the overlay instead (editingId), whose header has its own Save/Cancel.
  let editAll = $state(false);
  let editingId = $state<number | null>(null);
  function canEdit(_id: number) {
    return editAll && data.isAdmin;
  }
  // Rows whose inline edit form is open; several can be open at once, each
  // closing only via its own Save/Cancel/Update (or the toolbar's).
  const openForms = new SvelteSet<number>();
  // The Add overlay ('new') or the compact view's (non-edit) detail row.
  let expandedId = $state<number | 'new' | null>(null);
  let addPrefill = $state<Partial<CoffeeRow> | null>(null);

  // Back from a coffee page (a real history back) re-expands the compact
  // row the user opened it from, so it's clear where they were.
  snapshot<number | null>({
    id: 'coffees-expanded-row', // explicit: the default id comes from the call-site stack and changes every build
    capture: () => (view === 'compact' && !editAll && typeof expandedId === 'number' ? expandedId : null),
    restore: (id) => {
      if (id != null) expandedId = id;
    }
  });

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

  // Each open row form's CoffeeForm instance by coffee id (null once
  // closed) — plain (not $state): only ever read synchronously from within
  // saveChanges, never rendered.
  const formRefs: Record<number, { applyPendingEdits: () => Promise<boolean> } | null> = {};
  // The edit overlay's form, applied before its Save commits.
  let modalRef: { applyPendingEdits: () => Promise<boolean> } | null = null;

  // A floating notice over the page, held a second after the reload lands.
  let refreshState = $state<'idle' | 'busy' | 'done'>('idle');
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    clearTimeout(refreshTimer);
    refreshState = 'busy';
    try {
      await refreshTracked();
      refreshState = 'done';
      refreshTimer = setTimeout(() => (refreshState = 'idle'), 1000);
    } catch {
      refreshState = 'idle';
    }
  }

  function toggleEdit(id: number) {
    if (!openForms.delete(id)) openForms.add(id);
  }

  function openAdd() {
    addPrefill = null;
    expandedId = 'new';
  }

  // Opens the overlay pre-filled from the clone source.
  function openClone(prefill: Partial<CoffeeRow>) {
    addPrefill = prefill;
    expandedId = 'new';
  }

  function closeExpanded() {
    expandedId = null;
    addPrefill = null;
  }

  // The backlog row's Open icon: opens now (no Edit mode), toasts with Undo.
  async function quickOpen(coffee: CoffeeRow) {
    const changes = [{ id: coffee.id, statusAction: 'open' }];
    let states;
    try {
      states = await commitChanges(changes);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong.');
      return;
    }
    showToast(coffeeToast(changes, () => coffee.coffee_name) ?? '', { undo: async () => { await restoreStates(states); await refreshTracked(); } });
    await refreshTracked();
  }

  let addedSlug = $state<string | null>(null);
  // Undo for the add/clone prompt: delete the new coffee (only when its id came back).
  let addedId = $state<number | null>(null);
  const undoAdded = $derived(addedId ? async () => {
    try {
      await commitChanges([{ id: addedId!, statusAction: 'delete' }]);
      await refreshTracked();
      showToast('Undone.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not undo that.');
    }
  } : undefined);
  function added() {
    addedSlug = (form && 'slug' in form ? form.slug : null) ?? null;
    addedId = form && 'id' in form && typeof form.id === 'number' && form.id > 0 ? form.id : null;
    closeExpanded();
  }

  function enterEditMode() {
    editAll = true;
  }

  // The overlay's Save: its own form first (as Update would), then that one coffee's commit.
  async function saveOverlay(id: number) {
    if (pending.get(id)?.statusAction !== 'delete' && modalRef && !(await modalRef.applyPendingEdits())) return;
    await saveChanges(id);
  }

  async function saveChanges(onlyId?: number) {
    // An open per-row edit form's changes aren't in `pending` until its own
    // "Update" button stages them — apply every open form in scope first,
    // the same way Update would, so "Save changes" doesn't silently ignore
    // whatever is still sitting in an open form. A validation failure in
    // any of them (native required-field UI) aborts the save entirely,
    // matching what clicking Update itself would do. Skipped for a row that
    // also has a delete staged (the
    // compact view shows the delete action right next to an open form):
    // stageStatusAction deliberately drops any staged field edit when
    // staging 'delete' (pendingChanges.ts), and applying the open form here
    // would silently re-attach fields onto that delete, letting a field
    // validation error block the delete or running a pointless update
    // right before it.
    // Copied: a successful apply stages via onstage, which closes that form.
    for (const id of [...openForms]) {
      if ((onlyId != null && id !== onlyId) || pending.get(id)?.statusAction === 'delete') continue;
      if (formRefs[id] && !(await formRefs[id].applyPendingEdits())) return;
    }

    saving = true;
    const changes = Array.from(pending.entries())
      .filter(([id]) => onlyId == null || id === onlyId)
      .map(([id, change]) => ({ id, ...change }));
    let undoStates: States | null = null; // from commit-batch: what an Undo restores
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
        // Re-open every failing row so its inline error is immediately
        // visible, rather than leaving the user to guess which row failed.
        if (editAll) for (const e of errors) openForms.add(e.id);
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
      let commitResult: { success: boolean; error?: string; before?: unknown[]; after?: unknown[] };
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
      undoStates = { before: commitResult.before ?? [], after: commitResult.after ?? [] };
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
    // succeeded by this point, so a failure in refreshAll() (or
    // anything else here) must not be misattributed to the save as a
    // whole via the generic catch-all error message.
    const toastText = coffeeToast(changes, (id) => [...data.backlog, ...data.open, ...data.archive].find((c) => c.id === id)?.coffee_name ?? 'this coffee');
    if (toastText) showToast(toastText, undoable(changes) && undoStates ? { undo: async () => { await restoreStates(undoStates!); await refreshTracked(); } } : {});
    if (onlyId != null) {
      saving = false;
      discardRow(onlyId);
      await refreshTracked();
      return;
    }
    pending = new SvelteMap();
    commitErrors = new Map();
    editAll = false;
    openForms.clear();
    saving = false;
    await refreshTracked();
  }

  // Closes a coffee's overlay and drops what was staged for it.
  function discardRow(id: number) {
    pending.delete(id);
    commitErrors = new Map();
    openForms.delete(id);
    if (editingId === id) editingId = null;
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitErrors = new Map();
    editAll = false;
    openForms.clear();
  }

  const allCoffees = $derived([...data.backlog, ...data.open, ...data.archive]);
  const editingCoffee = $derived(editingId == null ? null : (allCoffees.find((c) => c.id === editingId) ?? null));
  const formProps = $derived({
    roastLevels: data.roastLevels,
    roasters: data.roasters,
    roasterImages: data.roasterImages,
    origins: data.origins,
    processingMethods: data.processingMethods,
    restHistory: allCoffees,
    subscriptions: data.subscriptions
  });

  function formCoffeeFor(coffee: CoffeeRow): CoffeeRow {
    return mergeStagedCoffee(coffee, pending.get(coffee.id)?.fields);
  }

  beforeNavigate(({ cancel, shallow, type }) => {
    if (shallow && type === 'goto') return;
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
  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;
    widthView = defaultViewForWidth(window.innerWidth);
    const fromUrl = withoutStalePlans(fromParams(currentParams(page.url), knownValues()), data.plans);
    try {
      const saved = withoutStalePlans(loadViewState(localStorage.getItem(VIEW_STORAGE_KEY), Date.now()), data.plans);
      explicit = isUntouched(fromUrl) ? saved : fromUrl;
      // A linked ?status=all keeps the remembered All-off restore.
      if (explicit.status?.[0] === 'all' && saved.prev) explicit.prev = saved.prev;
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

  function tapStatus(tapped: StatusTab) {
    const next = toggleStatus(lit, tapped, explicit.prev ?? null);
    // Entering All remembers what was lit; any other result forgets it.
    if (next[0] === 'all') explicit.prev = lit as Status[];
    else delete explicit.prev;
    explicit.status = next;
  }

  // Back to defaults (including the width-based layout), keeping the status tab.
  function reset() {
    explicit = resetView(explicit);
  }

  let source = $derived(litStatuses(explicit.status).flatMap((st) => data[st]));

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

  // The Sort by dropdown's options: the list view's column headers, in the same order, plus the two dates.
  const SORT_LABELS: Record<SortKey, string> = {
    roaster: 'Roaster', coffee_name: 'Coffee', origin: 'Origin', roast_level: 'Roast', decaf: 'Decaf',
    processing: 'Processing', cost_per_gram: 'Cost/g', amount_g: 'Amount', roast_date: 'Roasted',
    frozen_start_date: 'Frozen', frozen_end_date: 'Unfrozen', rest_window: 'Rest window', urgency: 'Urgency',
    created_at: 'Date added', updated_at: 'Date updated'
  };
  let dirLabel = $derived(sortDir === 'asc' ? 'Ascending' : 'Descending');

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
      case 'created_at':
        return c.created_at;
      case 'updated_at':
        return c.updated_at;
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
<PreviewMeta preview={coffeesPreview({ count: sortedCoffees.length, grams: visibleTotalGrams, status: lit, query, chips: explicit.filters.map((f) => previewChip(f, data.plans)) })} />

{#snippet brewButton(coffee: CoffeeRow)}
  {#if coffee.status === 'backlog' && data.isAdmin}
    <button class="button button-icon" type="button" onclick={() => quickOpen(coffee)} use:labelTip={'Open'} aria-label="Open"><Icon name="open" /></button>
  {:else if coffee.status === 'open'}
    <a class="button button-secondary button-icon" href={`/coffees/${coffee.slug}/brew`} use:labelTip={'Brew now'} aria-label="Brew now"><Icon name="coffee" /></a>
  {/if}
{/snippet}
{#snippet importButton(coffee: CoffeeRow)}
  {#if coffee.status !== 'archive'}
    <a class="button button-secondary button-icon" href={bqImportHref(coffee.slug)} use:labelTip={'Import into Bean Conqueror'} aria-label="Import into Bean Conqueror"><Icon name="share-network" /></a>
  {/if}
{/snippet}
{#snippet cloneButton(coffee: CoffeeRow, icons = false)}
  <button class="button button-secondary" class:button-icon={icons} type="button" disabled={saving} onclick={() => openClone(clonePrefill(formCoffeeFor(coffee)))}
    use:labelTip={icons ? 'Clone' : undefined} aria-label={icons ? 'Clone' : undefined}>
    {#if icons}<Icon name="clone" />{:else}Clone{/if}
  </button>
{/snippet}

{#snippet editButton(coffee: CoffeeRow, icons = false)}
  <button
    class="button button-secondary" class:button-icon={icons}
    type="button"
    use:labelTip={icons ? 'Edit' : undefined} aria-label={icons ? 'Edit' : undefined}
    onclick={() => (editingId = coffee.id)}>{#if icons}<Icon name="edit" />{:else}Edit{/if}</button
  >
{/snippet}

{#snippet adminActions(coffee: CoffeeRow)}
  <CoffeeStatusActions {coffee} pressed={pending.get(coffee.id)?.statusAction} disabled={saving} onaction={(a) => stageStatusAction(pending, coffee.id, a)}>
    <button class="button button-secondary button-icon" class:button-danger={openForms.has(coffee.id)} type="button" disabled={saving} onclick={() => toggleEdit(coffee.id)}
      use:labelTip={openForms.has(coffee.id) ? 'Cancel' : 'Edit'} aria-label={openForms.has(coffee.id) ? 'Cancel' : 'Edit'}>
      <Icon name={openForms.has(coffee.id) ? 'cancel' : 'edit'} />
    </button>
  </CoffeeStatusActions>
  {#if pending.has(coffee.id)}
    <span class="badge badge-neutral">
      {pending.get(coffee.id)?.statusAction
        ? `Pending: ${pending.get(coffee.id)?.statusAction}`
        : 'Pending: edited'}
    </span>
  {/if}
{/snippet}

{#snippet expandedForm(coffee: CoffeeRow)}
  <CoffeeForm
    bind:this={formRefs[coffee.id]}
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
      openForms.delete(coffee.id);
    }}
  />
{/snippet}

{#snippet sortControl(where: 'toolbar' | 'row')}
  <div class="form-field group-field sort-field sort-in-{where}">
    <label for="sort-by-{where}">Sort by</label>
    <div class="sort-controls">
      <select
        id="sort-by-{where}"
        class="ctl-select"
        value={sortKey}
        onchange={(e) => setSort(e.currentTarget.value as SortKey, sortDir)}
      >
        {#each SORT_KEYS as k (k)}
          <option value={k}>{SORT_LABELS[k]}</option>
        {/each}
      </select>
      <button
        type="button"
        class="icon-button sort-dir"
        aria-label="Sort {dirLabel.toLowerCase()}"
        use:labelTip={`${dirLabel}: tap for ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
        onclick={() => setSort(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
      >
        <Icon name={sortDir === 'asc' ? 'sort-ascending' : 'sort-descending'} />
      </button>
    </div>
  </div>
{/snippet}

<h1 class="tight-h1">Coffee Collection</h1>

{#if refreshState !== 'idle'}
  <div class="refresh-toast" role="status">
    {#if refreshState === 'busy'}<span class="spinner" aria-hidden="true"></span>Refreshing…{:else}Updated{/if}
  </div>
{/if}

<AddedToast bind:slug={addedSlug} undo={undoAdded} />

<CollapsibleBar>
{#snippet children()}
<div class="toolbar coffees-toolbar">
  <div class="form-field group-field show-field">
    <span>Show</span>
    <div class="tab-group" role="group" aria-label="Show">
      <button aria-pressed={lit.includes('backlog')} onclick={() => tapStatus('backlog')}>
        Backlog ({data.backlog.length})
      </button>
      <button aria-pressed={lit.includes('open')} onclick={() => tapStatus('open')}>
        Open ({data.open.length})
      </button>
      <button aria-pressed={lit.includes('archive')} onclick={() => tapStatus('archive')}>
        Archive ({data.archive.length})
      </button>
      <button aria-pressed={lit[0] === 'all'} onclick={() => tapStatus('all')}>All</button>
    </div>
  </div>

  <div class="form-field group-field view-field">
    <span>View</span>
    <div class="tab-group" role="group" aria-label="View">
      <button aria-pressed={view === 'compact'} onclick={() => setView('compact')}>Compact</button>
      <button aria-pressed={view === 'list'} onclick={() => setView('list')}>List</button>
      <button aria-pressed={view === 'cards'} onclick={() => setView('cards')}>Cards</button>
    </div>
  </div>

  <!-- Phones: Sort by sits right of View; desktop shows it in the Add Coffee row below. -->
  {@render sortControl('toolbar')}
</div>

<div class="search-row coffees-search-row" class:editing={editAll}>
  <input class="search-input" placeholder="Search roaster, coffee, origin…" bind:value={explicit.query} />
  <FilterBar bind:filters={explicit.filters} coffees={source} plans={data.plans} />
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
  <button class="button button-secondary" type="button" onclick={reset}>Reset</button>
  {#if data.isAdmin}
    {#if editAll}
      <button class="button button-success button-solid" type="button" aria-label="Save changes" disabled={saving} onclick={() => saveChanges()}>
        {#if saving}Saving…{:else}Save <span class="more">changes</span>{/if}
      </button>
      <button class="button button-danger" type="button" disabled={saving} aria-label="Discard changes" onclick={discardChanges}>
        Discard <span class="more">changes</span>
      </button>
    {:else}
      <button class="button button-secondary" type="button" onclick={enterEditMode}>Edit</button>
    {/if}
  {/if}
  <ShareButton />
  {#if commitErrors.get(-1)}
    <p class="badge badge-urgent">{commitErrors.get(-1)}</p>
  {/if}
</div>

<div class="search-row add-sort-row">
  <span class="text-muted results">
    {sortedCoffees.length} coffee{sortedCoffees.length === 1 ? '' : 's'} · {formatGrams(visibleTotalGrams)}
  </span>
  {#if data.isAdmin}
    <button class="button add-coffee-button" type="button" onclick={openAdd}>+ Add Coffee</button>
  {/if}
  {@render sortControl('row')}
</div>
{/snippet}

{#snippet summary()}
  {sortedCoffees.length} coffee{sortedCoffees.length === 1 ? '' : 's'} · {SORT_LABELS[sortKey]} {sortDir === 'asc' ? '↑' : '↓'}
{/snippet}
</CollapsibleBar>

{#if data.isAdmin}
  {#if expandedId === 'new'}
    <!-- Keyed so a second clone while the overlay is open starts from a fresh form. -->
    {#key addPrefill}
      <CoffeeEditModal
        mode={addPrefill ? 'clone' : 'add'}
        prefill={addPrefill}
        formProps={formProps}
        formError={form?.error ?? null}
        oncancel={closeExpanded}
        onsuccess={added}
      >
        {#snippet title()}{addPrefill ? 'Clone coffee' : 'Add Coffee'}{/snippet}
      </CoffeeEditModal>
    {/key}
  {:else if editingCoffee}
    {@const ec = editingCoffee}
    {@const id = ec.id}
    <CoffeeEditModal
      bind:this={modalRef}
      mode="edit"
      coffee={formCoffeeFor(ec)}
      formProps={formProps}
      formError={commitErrors.get(id) ?? commitErrors.get(-1) ?? null}
      {saving}
      hasStaged={pending.has(id)}
      onstage={(fields) => stageFieldChange(pending, id, fields)}
      onsave={() => saveOverlay(id)}
      oncancel={() => discardRow(id)}
    >
      {#snippet title()}<CoffeeName name={ec.coffee_name} />{/snippet}
      {#snippet statusActions()}
        <CoffeeStatusActions stable coffee={ec} pressed={pending.get(id)?.statusAction} disabled={saving} onaction={(a) => stageStatusAction(pending, id, a)} />
      {/snippet}
    </CoffeeEditModal>
  {/if}
{/if}

{#if view === 'cards'}
  <section class="grid grid-max-3">
    {#each sortedCoffees as coffee (coffee.id)}
      {#if data.isAdmin}
        <div class="card">
          {#if canEdit(coffee.id) && openForms.has(coffee.id)}
            {@render expandedForm(coffee)}
            <!-- Save/Cancel under the open form, like Compact: the card's own
                 action row is replaced by the form. -->
            <div class="action-buttons under-form">
              {@render adminActions(coffee)}
            </div>
          {:else}
            {@const img = coffeeImage(coffee, '')}
            <div class="card-body">
              {#if img}
                <!-- Same target as the title link; out of the Tab order so each
                     card stays one stop. -->
                <a class="card-thumb-link" href={`/coffees/${coffee.slug}`} tabindex="-1">
                  <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
                </a>
              {/if}
              <h2><a href={`/coffees/${coffee.slug}`}><CoffeeName name={coffee.coffee_name} /></a></h2>
              <p class="text-muted">{coffee.roaster}</p>
              <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
              <p class="roast-row">
                <RoastBeans degrees={degreesFor(coffee.roast_level)} />
                <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
              </p>
              {#if coffee.processing}
                <p class="text-muted">{coffee.processing}</p>
              {/if}
              <p class="text-muted">
                {#if coffee.cost_per_gram != null}<Usd n={coffee.cost_per_gram} suffix="/g" />{:else}Cost unknown{/if}
                {coffee.amount_g != null ? ` · ${formatBag(coffee.amount_g, coffee.grams_left)}` : ''}
              </p>
              {#if coffee.roast_date}
                <p class="text-muted">
                  Roasted {formatDate(coffee.roast_date)}
                  {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
                </p>
              {/if}
              {#if coffee.drink_after && coffee.drink_before}
                <p class="text-muted">Rest window: {formatDate(coffee.drink_after)} – {formatDate(coffee.drink_before)}</p>
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
            <!-- A pending card closed by another card's Edit keeps the open form's
                 action set, so it keeps that row's look too (.under-form). -->
            <div class="action-buttons" class:under-form={canEdit(coffee.id)}>
              {#if canEdit(coffee.id)}
                {@render adminActions(coffee)}
              {:else}
                {@render brewButton(coffee)}
                {@render importButton(coffee)}
                {@render editButton(coffee, true)}
                {@render cloneButton(coffee, true)}
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        {@const img = coffeeImage(coffee, '')}
        <div class="card-wrap">
        <a class="card" href={`/coffees/${coffee.slug}`}>
          {#if img}
            <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
          {/if}
          <h2><CoffeeName name={coffee.coffee_name} /></h2>
          <p class="text-muted">{coffee.roaster}</p>
          <p>{coffee.origin ? originWithFlag(coffee.origin) : 'Origin unknown'}</p>
          <p class="roast-row">
            <RoastBeans degrees={degreesFor(coffee.roast_level)} />
            <span class="text-muted">{coffee.roast_level ?? 'Roast level unknown'}</span>
          </p>
          {#if coffee.processing}
            <p class="text-muted">{coffee.processing}</p>
          {/if}
          <p class="text-muted">
            {coffee.cost_per_gram != null ? `${usd(coffee.cost_per_gram)}/g` : 'Cost unknown'}
            {coffee.amount_g != null ? ` · ${formatBag(coffee.amount_g, coffee.grams_left)}` : ''}
          </p>
          {#if coffee.roast_date}
            <p class="text-muted">
              Roasted {formatDate(coffee.roast_date)}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </p>
          {/if}
          {#if coffee.drink_after && coffee.drink_before}
            <p class="text-muted">Rest window: {formatDate(coffee.drink_after)} – {formatDate(coffee.drink_before)}</p>
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
        {#if coffee.status === 'open'}<a class="button brew-now-link" href={`/coffees/${coffee.slug}/brew`}>Brew now</a>{/if}
        </div>
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
                <a href={`/coffees/${coffee.slug}`}><CoffeeName name={coffee.coffee_name} /></a>
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
          {#if openForms.has(coffee.id)}
            {@render expandedForm(coffee)}
          {/if}
          <div class="action-buttons">
            {@render adminActions(coffee)}
          </div>
        {:else}
          <button
            type="button"
            class="compact-row"
            aria-expanded={expandedId === coffee.id}
            onclick={() => (expandedId = expandedId === coffee.id ? null : coffee.id)}
          >
            <span class="compact-row-main">
              <span class="compact-row-title">
                <CoffeeName name={coffee.coffee_name} />

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
                  {#if coffee.cost_per_gram != null}<Usd n={coffee.cost_per_gram} suffix="/g" />{:else}—{/if}{#if coffee.amount_g != null}
                    · <span class="nowrap">{formatBag(coffee.amount_g, coffee.grams_left)}</span>{/if}
                </div>
                <div>
                  <span class="eyebrow">Roasted</span>
                  {formatDate(coffee.roast_date ?? '—')}{coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
                </div>
                <div>
                  <span class="eyebrow">Rest window</span>
                  {#if coffee.drink_after && coffee.drink_before}{formatDate(coffee.drink_after)} – {formatDate(coffee.drink_before)}{:else}—{/if}
                </div>
                <div><span class="eyebrow">Frozen</span>{formatDate(coffee.frozen_start_date ?? '—')}</div>
                <div><span class="eyebrow">Unfrozen</span>{formatDate(coffee.frozen_end_date ?? '—')}</div>
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
              <a class="button button-secondary button-icon" href={`/coffees/${coffee.slug}`} use:labelTip={'Open coffee page'} aria-label="Open coffee page"><Icon name="page" /></a>
              {@render brewButton(coffee)}
              {@render importButton(coffee)}
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
    <table class="data-table compact coffees-list">
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
          <!-- Signed out the column holds only Brew now, so it skips the admin width (col-actions). -->
          <th class={data.isAdmin ? 'col-actions' : undefined}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedCoffees as coffee (coffee.id)}
          <tr>
            <td>{coffee.roaster}</td>
            <td><div class="name-line"><a class="clamp2" use:labelTip={coffee.coffee_name} href={`/coffees/${coffee.slug}`}><CoffeeName name={coffee.coffee_name} /></a></div></td>
            <td class="origin-cell">{coffee.origin ? originWithFlag(coffee.origin) : '—'}</td>
            <td>
              <RoastBeans degrees={degreesFor(coffee.roast_level)} label={coffee.roast_level} />
            </td>
            <td>{coffee.decaf ? 'Yes' : 'No'}</td>
            <td><span class="clamp2" use:labelTip={coffee.processing}>{coffee.processing ?? '—'}</span></td>
            <td>{#if coffee.cost_per_gram != null}<Usd n={coffee.cost_per_gram} />{:else}—{/if}</td>
            <td class="nowrap">{coffee.amount_g != null ? formatBag(coffee.amount_g, coffee.grams_left) : '—'}</td>
            <td>
              {formatDate(coffee.roast_date ?? '—')}
              {#if coffee.days_since_roast != null}<br />({coffee.days_since_roast}d ago){/if}
            </td>
            <td>{formatDate(coffee.frozen_start_date ?? '—')}</td>
            <td>{formatDate(coffee.frozen_end_date ?? '—')}</td>
            <td>
              {#if coffee.drink_after && coffee.drink_before}
                {formatDate(coffee.drink_after)} –<br />{formatDate(coffee.drink_before)}
              {:else}
                —
              {/if}
            </td>
            <td style={urgencyColorStyle(coffee.urgency_rating)}>
              {coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}
            </td>
            {#if !data.isAdmin}
              <td><div class="action-buttons">{@render brewButton(coffee)}</div></td>
            {:else}
              <td>
                <div class="action-buttons">
                  {#if canEdit(coffee.id)}
                    <!-- While this row's form is open its actions sit under the form (below). -->
                    {#if !openForms.has(coffee.id)}
                      {@render adminActions(coffee)}
                    {/if}
                  {:else}
                    {@render brewButton(coffee)}
                    {@render importButton(coffee)}
                    {@render editButton(coffee, true)}
                    {@render cloneButton(coffee, true)}
                  {/if}
                </div>
              </td>
            {/if}
          </tr>
          {#if canEdit(coffee.id) && openForms.has(coffee.id)}
            <tr>
              <td colspan="14">
                {@render expandedForm(coffee)}
                <!-- Under the form, like Compact: on a phone the row above is off-screen. -->
                <div class="action-buttons under-form">
                  {@render adminActions(coffee)}
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
  @keyframes refresh-toast-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .refresh-toast {
      animation: none;
    }
  }
</style>
