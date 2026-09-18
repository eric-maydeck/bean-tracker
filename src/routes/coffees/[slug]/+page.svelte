<script lang="ts">
  import { enhance } from '$app/forms';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';

  let { data, form } = $props();

  let editMode = $state(false);
  let canEdit = $derived(editMode && data.isAdmin);
</script>

<a class="button button-secondary" href="/">&larr; Back to collection</a>

{#if data.isAdmin}
  <div class="search-row">
    <button
      class="button button-secondary"
      type="button"
      aria-pressed={editMode}
      onclick={() => (editMode = !editMode)}
    >
      {editMode ? 'Done editing' : 'Edit'}
    </button>
  </div>
{/if}

{#if canEdit}
  <CoffeeForm
    coffee={data.coffee}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    origins={data.origins}
    processingMethods={data.processingMethods}
    formError={form?.error ?? null}
    onsuccess={() => (editMode = false)}
  />

  <form method="POST" action="?/delete" use:enhance>
    <input type="hidden" name="id" value={data.coffee.id} />
    <button
      class="button button-danger"
      type="submit"
      onclick={(e) => {
        if (!confirm(`Delete ${data.coffee.coffee_name} by ${data.coffee.roaster}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      Delete this coffee
    </button>
  </form>
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
          <h1>{data.coffee.coffee_name}</h1>
          <p class="text-muted">{data.coffee.roaster}</p>
        </div>
        {#if data.coffee.status === 'archive'}
          <span class="badge badge-fresh">Archive</span>
        {:else if data.coffee.status === 'open'}
          <span class="badge badge-warm">Open</span>
        {:else}
          <span class="badge badge-neutral">Backlog</span>
        {/if}
      </div>

      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Origin</span>
          <span class="stat-value">{data.coffee.origin ?? '—'}</span>
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
