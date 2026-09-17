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
    <dt>Status</dt>
    <dd>{data.coffee.status === 'active' ? 'In rotation' : 'Finished'}</dd>
  </dl>
</article>
