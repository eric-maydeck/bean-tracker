<script lang="ts">
  let { data } = $props();
</script>

<a class="button button-secondary" href="/">&larr; Back to collection</a>

<article class="card">
  <h1>{data.coffee.coffee_name}</h1>
  <p class="text-muted">{data.coffee.roaster}</p>

  <dl>
    <dt>Origin</dt>
    <dd>{data.coffee.origin ?? '—'}</dd>
    <dt>Roast level</dt>
    <dd>{data.coffee.roast_level ?? '—'}</dd>
    <dt>Processing</dt>
    <dd>{data.coffee.processing ?? '—'}</dd>
    <dt>Amount</dt>
    <dd>{data.coffee.amount_g ?? '—'} g</dd>
    <dt>Cost</dt>
    <dd>{data.coffee.cost != null ? `$${data.coffee.cost.toFixed(2)}` : '—'}</dd>
    <dt>Cost per gram</dt>
    <dd>{data.coffee.cost_per_gram != null ? `$${data.coffee.cost_per_gram.toFixed(3)}` : '—'}</dd>
    <dt>Roast date</dt>
    <dd>{data.coffee.roast_date ?? '—'}</dd>
    <dt>Drink after</dt>
    <dd>{data.coffee.drink_after ?? '—'}</dd>
    <dt>Drink before</dt>
    <dd>{data.coffee.drink_before ?? '—'}</dd>
    <dt>Days since roast</dt>
    <dd>{data.coffee.days_since_roast ?? '—'}{data.coffee.days_since_roast != null ? ' days' : ''}</dd>
    <dt>Urgency</dt>
    <dd>{data.coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(data.coffee.urgency_rating))}</dd>
    <dt>Status</dt>
    <dd>{data.coffee.status === 'active' ? 'In rotation' : 'Finished'}</dd>
    {#if data.coffee.frozen_start_date}
      <dt>Frozen start date</dt>
      <dd>{data.coffee.frozen_start_date}</dd>
    {/if}
    {#if data.coffee.frozen_end_date}
      <dt>Frozen end date</dt>
      <dd>{data.coffee.frozen_end_date}</dd>
    {/if}
    <dt>Recommended rest days</dt>
    <dd>
      {data.coffee.rest_days_low ?? '—'}–{data.coffee.rest_days_high ?? '—'}
    </dd>
    {#if data.coffee.status === 'finished' && data.coffee.moved_date}
      <dt>Finished on</dt>
      <dd>{data.coffee.moved_date.slice(0, 10)}</dd>
    {/if}
  </dl>
</article>
