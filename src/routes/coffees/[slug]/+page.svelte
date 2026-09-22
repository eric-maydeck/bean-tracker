<script lang="ts">
  import { goto, invalidateAll, beforeNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import { originWithFlag } from '$lib/countryFlags';
  import { stageFieldChange, stageStatusAction, hasPending, type PendingChange } from '$lib/pendingChanges';
  import { SvelteMap } from 'svelte/reactivity';
  import { buildShareUrl } from '$lib/beanConquerorShare';
  import QRCode from 'qrcode';

  let { data } = $props();

  let shareUrl = $state<string | null>(null);
  let shareQrDataUrl = $state<string | null>(null);

  async function shareToBeanConqueror() {
    const url = await buildShareUrl(data.coffee, data.roastLevels);
    shareUrl = url;
    shareQrDataUrl = await QRCode.toDataURL(url);
  }

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);

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

  // The merge intentionally produces a value whose fields may be strings
  // where CoffeeRow expects numbers (pending.fields comes from captured
  // FormData) — safe here because CoffeeForm only ever interpolates these
  // into <input value=...> attributes, which stringifies regardless.
  let formCoffee = $derived.by(() => {
    const pendingFields = pending.get(data.coffee.id)?.fields;
    if (!pendingFields) return data.coffee;
    return {
      ...data.coffee,
      ...pendingFields,
      // FormData omits an unchecked checkbox entirely and represents a
      // checked one as the string "on" — convert back to the 0/1 integer
      // CoffeeForm's `checked={coffee?.decaf === 1}` comparison expects.
      // Presence of the key (regardless of its exact string value) means
      // it was checked when staged; absence means it was unchecked.
      decaf: pendingFields.decaf != null ? 1 : 0
    } as typeof data.coffee;
  });

  async function saveChanges() {
    saving = true;
    commitError = null;
    const changes = Array.from(pending.entries()).map(([id, change]) => ({ id, ...change }));
    const wasDeleted = pending.get(data.coffee.id)?.statusAction === 'delete';
    const stagedFields = pending.get(data.coffee.id)?.fields;

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
      let commitResult: { success: boolean; error?: string };
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
      await goto('/');
      return;
    }
    if (stagedFields?.slug && stagedFields.slug !== data.coffee.slug) {
      await goto(`/coffees/${stagedFields.slug}`);
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

<a class="button button-secondary" href="/">&larr; Back to collection</a>

<button class="button button-secondary" type="button" onclick={shareToBeanConqueror}>
  Import into Bean Conqueror
</button>
{#if shareUrl && shareQrDataUrl}
  <div class="chart-panel">
    <img src={shareQrDataUrl} alt="QR code to import this coffee into Bean Conqueror" width="200" height="200" />
    <a href={shareUrl}>{shareUrl}</a>
  </div>
{/if}

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
  {#if commitError}
    <p class="badge badge-urgent">{commitError}</p>
  {/if}
{/if}

{#if canEdit}
  <CoffeeForm
    coffee={formCoffee}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    origins={data.origins}
    processingMethods={data.processingMethods}
    onstage={stageFields}
  />

  <button class="button button-danger" type="button" disabled={saving} onclick={stageDelete}>
    {pending.get(data.coffee.id)?.statusAction === 'delete' ? 'Pending: delete (Save to confirm)' : 'Delete this coffee'}
  </button>
{:else}
  <article class="detail">
    <div class="detail-media">
      {#if data.coffee.image_url}
        <img src={data.coffee.image_url} alt={`${data.coffee.coffee_name} label`} />
      {:else}
        <div class="detail-media-placeholder" aria-hidden="true">☕</div>
      {/if}
    </div>

    <div class="detail-body">
      <div class="detail-header">
        <div>
          <h1>
            {data.coffee.coffee_name}
            {#if data.coffee.status === 'archive'}
              <span class="badge badge-fresh">Archive</span>
            {:else if data.coffee.status === 'open'}
              <span class="badge badge-warm">Open</span>
            {:else}
              <span class="badge badge-neutral">Backlog</span>
            {/if}
            {#if data.coffee.decaf}
              <span class="badge badge-neutral">Decaf</span>
            {/if}
          </h1>
          <p class="text-muted">{data.coffee.roaster}</p>
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
          <span class="stat-value">{data.coffee.amount_g != null ? `${data.coffee.amount_g}g` : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cost</span>
          <span class="stat-value">{data.coffee.cost != null ? `$${data.coffee.cost.toFixed(2)}` : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cost/gram</span>
          <span class="stat-value">
            {data.coffee.cost_per_gram != null ? `$${data.coffee.cost_per_gram.toFixed(3)}` : '—'}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Urgency</span>
          <span class="stat-value" style={urgencyColorStyle(data.coffee.urgency_rating)}>
            {data.coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(data.coffee.urgency_rating))}
          </span>
        </div>
      </div>

      <section class="detail-section">
        <h2>Timing</h2>
        <div class="stat-grid">
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
            <span class="stat-label">Drink before</span>
            <span class="stat-value">{data.coffee.drink_before ?? '—'}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Recommended rest</span>
            <span class="stat-value">
              {data.coffee.rest_days_low ?? '—'}–{data.coffee.rest_days_high ?? '—'} days
            </span>
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
              <span class="stat-value">{data.coffee.opened_date.slice(0, 10)}</span>
            </div>
          {/if}
          {#if data.coffee.status === 'archive' && data.coffee.moved_date}
            <div class="stat">
              <span class="stat-label">Archived on</span>
              <span class="stat-value">{data.coffee.moved_date.slice(0, 10)}</span>
            </div>
          {/if}
        </div>
      </section>
    </div>
  </article>
{/if}
