<script lang="ts">
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { invalidateAll, beforeNavigate } from '$app/navigation';
  import { defaultViewForWidth } from '$lib/defaultView';
  import { stageFieldChange, stageStatusAction, hasPending, type PendingChange } from '$lib/pendingChanges';
  import { SvelteMap } from 'svelte/reactivity';
  let { data, form } = $props();

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);

  let view = $state<'compact' | 'list'>('list');
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

  $effect(() => {
    if (!browser) return;
    try {
      const savedView = localStorage.getItem('bean-tracker-subscriptions-view');
      if (savedView === 'compact' || savedView === 'list') {
        view = savedView;
      } else {
        view = defaultViewForWidth(window.innerWidth);
      }
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
    }
  });

  function setView(next: 'compact' | 'list') {
    view = next;
    try {
      localStorage.setItem('bean-tracker-subscriptions-view', next);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  function toggleExpanded(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function stageFieldsFor(sub: { id: number }, formEl: HTMLFormElement) {
    const formData = new FormData(formEl);
    const fields: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') fields[key] = value;
    }
    stageFieldChange(pending, sub.id, fields);
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
    editMode = false;
    expandedId = null;
    saving = false;
    await invalidateAll();
  }

  function discardChanges() {
    pending = new SvelteMap();
    commitErrors = new Map();
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

  let totalPrice = $derived.by(() => {
    const withPrice = data.subscriptions.filter((s) => s.price != null);
    if (withPrice.length === 0) return null;
    return withPrice.reduce((sum, s) => sum + (s.price ?? 0), 0);
  });

  let totalGrams = $derived.by(() => {
    const withGrams = data.subscriptions.filter((s) => s.total_grams != null);
    if (withGrams.length === 0) return null;
    return withGrams.reduce((sum, s) => sum + (s.total_grams ?? 0), 0);
  });
</script>

<svelte:head>
  <title>Bean Tracker - Subscriptions</title>
</svelte:head>

<h1>Subscriptions</h1>

{#if data.isAdmin}
  <div class="search-row">
    {#if editMode}
      <button class="button button-success" type="button" disabled={saving} onclick={saveChanges}>
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

<div class="tab-group">
  <button aria-pressed={view === 'compact'} onclick={() => setView('compact')}>Compact</button>
  <button aria-pressed={view === 'list'} onclick={() => setView('list')}>Table</button>
</div>

{#if view === 'list'}
<div class="table-scroll">
  <table class="data-table">
    <thead>
      <tr>
        <th>Roaster/Service</th>
        <th>Name</th>
        <th>Price</th>
        <th>Total grams</th>
        <th>Next renewal</th>
        {#if canEdit}
          <th>Bags × g/bag</th>
          <th>Renewal day</th>
          <th>Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each data.subscriptions as sub (sub.id)}
        <tr>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="roaster_service" required value={sub.roaster_service} />
            {:else}
              {sub.roaster_service}
            {/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="subscription_name" value={sub.subscription_name ?? ''} />
            {:else}
              {sub.subscription_name ?? '—'}
            {/if}
          </td>
          <td>
            {#if canEdit}
              <input class="inline-input" form={`sub-form-${sub.id}`} name="price" type="number" step="0.01" value={sub.price ?? ''} />
            {:else}
              {sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}
            {/if}
          </td>
          <td>{sub.total_grams ?? '—'}</td>
          <td>{sub.next_renewal_date ?? '—'}</td>
          {#if canEdit}
            <td>
              <input class="inline-input" form={`sub-form-${sub.id}`} name="bag_count" type="number" step="1" placeholder="# bags" value={sub.bag_count ?? ''} />
              <input class="inline-input" form={`sub-form-${sub.id}`} name="amount_per_bag_g" type="number" step="1" placeholder="g/bag" value={sub.amount_per_bag_g ?? ''} />
            </td>
            <td>
              <input
                class="inline-input"
                form={`sub-form-${sub.id}`}
                name="renewal_day"
                type="number"
                step="1"
                min="1"
                max="31"
                placeholder="day"
                value={sub.renewal_day ?? ''}
              />
            </td>
            <td>
              <form
                id={`sub-form-${sub.id}`}
                method="POST"
                onsubmit={(e) => {
                  e.preventDefault();
                  stageFieldsFor(sub, e.currentTarget as HTMLFormElement);
                }}
              >
                <input type="hidden" name="id" value={sub.id} />
                <button class="button" type="submit" disabled={saving}>Update</button>
              </form>
              <button class="button button-danger" type="button" disabled={saving} onclick={() => stageDelete(sub)}>
                {pending.get(sub.id)?.statusAction === 'delete' ? 'Pending: delete' : 'Delete'}
              </button>
              {#if pending.has(sub.id) && pending.get(sub.id)?.statusAction !== 'delete'}
                <span class="badge badge-neutral">Pending: edited</span>
              {/if}
              {#if commitErrors.get(sub.id)}
                <p class="badge badge-urgent">{commitErrors.get(sub.id)}</p>
              {/if}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2"><strong>Totals</strong></td>
        <td><strong>{totalPrice != null ? `$${totalPrice.toFixed(2)}` : '—'}</strong></td>
        <td><strong>{totalGrams ?? '—'}</strong></td>
        <td></td>
        {#if canEdit}
          <td></td>
          <td></td>
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
              <div class="compact-row-title">{sub.roaster_service}</div>
              <div class="compact-row-sub text-muted">{sub.subscription_name ?? '—'}</div>
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
                <div class="form-field">
                  <label for={`compact-roaster-${sub.id}`}>Roaster/Service</label>
                  <input id={`compact-roaster-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="roaster_service" required value={sub.roaster_service} />
                </div>
                <div class="form-field">
                  <label for={`compact-name-${sub.id}`}>Subscription name</label>
                  <input id={`compact-name-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="subscription_name" value={sub.subscription_name ?? ''} />
                </div>
                <div class="form-field">
                  <label for={`compact-price-${sub.id}`}>Price</label>
                  <input id={`compact-price-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="price" type="number" step="0.01" value={sub.price ?? ''} />
                </div>
                <div class="form-field">
                  <label for={`compact-bags-${sub.id}`}># bags</label>
                  <input id={`compact-bags-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="bag_count" type="number" step="1" value={sub.bag_count ?? ''} />
                </div>
                <div class="form-field">
                  <label for={`compact-grams-${sub.id}`}>g/bag</label>
                  <input id={`compact-grams-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="amount_per_bag_g" type="number" step="1" value={sub.amount_per_bag_g ?? ''} />
                </div>
                <div class="form-field">
                  <label for={`compact-day-${sub.id}`}>Renewal day</label>
                  <input id={`compact-day-${sub.id}`} class="inline-input" form={`sub-form-${sub.id}`} name="renewal_day" type="number" step="1" min="1" max="31" value={sub.renewal_day ?? ''} />
                </div>
              </div>
              <form
                id={`sub-form-${sub.id}`}
                method="POST"
                onsubmit={(e) => {
                  e.preventDefault();
                  stageFieldsFor(sub, e.currentTarget as HTMLFormElement);
                }}
              >
                <input type="hidden" name="id" value={sub.id} />
                <button class="button" type="submit" disabled={saving}>Update</button>
              </form>
              <button class="button button-danger" type="button" disabled={saving} onclick={() => stageDelete(sub)}>
                {pending.get(sub.id)?.statusAction === 'delete' ? 'Pending: delete' : 'Delete'}
              </button>
              {#if pending.has(sub.id) && pending.get(sub.id)?.statusAction !== 'delete'}
                <span class="badge badge-neutral">Pending: edited</span>
              {/if}
              {#if commitErrors.get(sub.id)}
                <p class="badge badge-urgent">{commitErrors.get(sub.id)}</p>
              {/if}
            </div>
          {/if}
        {:else}
          <button
            type="button"
            class="compact-row"
            aria-expanded={expandedId === sub.id}
            onclick={() => toggleExpanded(sub.id)}
          >
            <span class="compact-row-main">
              <span class="compact-row-title">{sub.roaster_service}</span>
              <span class="compact-row-sub text-muted">{sub.subscription_name ?? '—'}</span>
            </span>
            <span class="compact-row-trailing">
              {sub.price != null ? `$${sub.price.toFixed(2)}` : '—'}
            </span>
          </button>
          {#if expandedId === sub.id}
            <div class="compact-row-detail">
              <div class="compact-detail-grid">
                <div><span class="eyebrow">Total grams</span><br />{sub.total_grams ?? '—'}</div>
                <div><span class="eyebrow">Next renewal</span><br />{sub.next_renewal_date ?? '—'}</div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  <div class="compact-row-detail" style="border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-2);">
    <strong>Totals:</strong> {totalPrice != null ? `$${totalPrice.toFixed(2)}` : '—'} · {totalGrams ?? '—'}g
  </div>
{/if}

{#if canEdit}
  <h2 class="section-heading">Add subscription</h2>
  <form method="POST" action="?/create" use:enhance>
    <div class="form-grid">
      <div class="form-field">
        <label for="roaster_service">Roaster/Service</label>
        <input id="roaster_service" name="roaster_service" required />
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
