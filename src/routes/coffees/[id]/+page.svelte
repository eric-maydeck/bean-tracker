<script lang="ts">
  let { data } = $props();
  let c = $derived(data.coffee);
</script>

<a class="button button-secondary" href="/">&larr; Back to collection</a>

<article class="detail">
  <div class="detail-media">
    {#if c.image_url}
      <img src={c.image_url} alt={`${c.coffee_name} label`} />
    {:else}
      <div class="detail-media-placeholder" aria-hidden="true">☕</div>
    {/if}
  </div>

  <div class="detail-body">
    <div class="detail-header">
      <div>
        <h1>{c.coffee_name}</h1>
        <p class="text-muted">{c.roaster}</p>
      </div>
      {#if c.status === 'finished'}
        <span class="badge badge-fresh">Finished</span>
      {:else}
        <span class="badge badge-warm">In rotation</span>
      {/if}
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Origin</span>
        <span class="stat-value">{c.origin ?? '—'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Roast level</span>
        <span class="stat-value">{c.roast_level ?? '—'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Processing</span>
        <span class="stat-value">{c.processing ?? '—'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Amount</span>
        <span class="stat-value">{c.amount_g != null ? `${c.amount_g}g` : '—'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Cost</span>
        <span class="stat-value">{c.cost != null ? `$${c.cost.toFixed(2)}` : '—'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Cost/gram</span>
        <span class="stat-value">
          {c.cost_per_gram != null ? `$${c.cost_per_gram.toFixed(3)}` : '—'}
        </span>
      </div>
      <div class="stat">
        <span class="stat-label">Urgency</span>
        <span class="stat-value">
          {c.urgency_rating === 'Done' ? 'Done' : Math.round(Number(c.urgency_rating))}
        </span>
      </div>
    </div>

    <section class="detail-section">
      <h2>Timing</h2>
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-label">Roast date</span>
          <span class="stat-value">{c.roast_date ?? '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Days since roast</span>
          <span class="stat-value">{c.days_since_roast != null ? `${c.days_since_roast}d` : '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Drink after</span>
          <span class="stat-value">{c.drink_after ?? '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Drink before</span>
          <span class="stat-value">{c.drink_before ?? '—'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Recommended rest</span>
          <span class="stat-value">{c.rest_days_low ?? '—'}–{c.rest_days_high ?? '—'} days</span>
        </div>
        {#if c.frozen_start_date}
          <div class="stat">
            <span class="stat-label">Frozen start</span>
            <span class="stat-value">{c.frozen_start_date}</span>
          </div>
        {/if}
        {#if c.frozen_end_date}
          <div class="stat">
            <span class="stat-label">Frozen end</span>
            <span class="stat-value">{c.frozen_end_date}</span>
          </div>
        {/if}
        {#if c.status === 'finished' && c.moved_date}
          <div class="stat">
            <span class="stat-label">Finished on</span>
            <span class="stat-value">{c.moved_date.slice(0, 10)}</span>
          </div>
        {/if}
      </div>
    </section>
  </div>
</article>
