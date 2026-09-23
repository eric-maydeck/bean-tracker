<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import Chart from '$lib/components/Chart.svelte';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import { defaultViewForWidth } from '$lib/defaultView';
  import type { UnmatchedBean } from '$lib/server/beanconqueror';
  import type { CoffeeRow } from '$lib/types';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let createModalBean = $state<UnmatchedBean | null>(null);

  // Same width-based default the Coffees/Subscriptions pages use (List on
  // desktop, Compact on mobile) — deliberately no manual toggle or
  // localStorage persistence here, unlike those pages: this is a
  // candidate-review section, not a page people spend a lot of time
  // choosing a preferred layout for.
  let candidateView = $state<'list' | 'compact'>('list');

  $effect(() => {
    if (!browser) return;
    candidateView = defaultViewForWidth(window.innerWidth);
  });

  function prefillFor(bean: UnmatchedBean): Partial<CoffeeRow> {
    return {
      roaster: bean.roaster ?? '',
      coffee_name: bean.name,
      origin: bean.origin,
      processing: bean.processing,
      amount_g: bean.weightG,
      cost: bean.cost,
      roast_date: bean.roastDate,
      decaf: bean.decaffeinated ? 1 : 0
    };
  }

  function openCreateModal(bean: UnmatchedBean) {
    createModalBean = bean;
  }

  async function closeCreateModal() {
    createModalBean = null;
    await invalidateAll();
  }

  type Dimension = 'roaster' | 'origin' | 'processing' | 'roastLevel' | 'caffeine';
  type Metric = 'grams' | 'count';

  const dimensionLabels: Record<Dimension, string> = {
    roaster: 'Roaster',
    origin: 'Origin',
    processing: 'Processing',
    roastLevel: 'Roast Level',
    caffeine: 'Caffeinated vs. Decaf'
  };

  let dimension = $state<Dimension>('roaster');
  let metric = $state<Metric>('grams');
  let editingRates = $state(false);

  // Caps how many bars the composition chart draws — without this, a
  // dimension like Roaster with 20+ distinct values crams so many bars into
  // the chart that Chart.js starts skipping y-axis labels to avoid overlap.
  const COMPOSITION_BAR_LIMIT = 10;

  let breakdownEntries = $derived(data.stats.breakdowns[dimension]);
  // Roast Level keeps its intentional light-to-dark order regardless of
  // metric — every other dimension re-sorts by whichever metric is active,
  // since "Big" by grams isn't necessarily "Big" by count.
  let sortedBreakdownEntries = $derived(
    dimension === 'roastLevel'
      ? breakdownEntries
      : [...breakdownEntries].sort((a, b) => (metric === 'grams' ? b.grams - a.grams : b.count - a.count))
  );
  let visibleBreakdownEntries = $derived(sortedBreakdownEntries.slice(0, COMPOSITION_BAR_LIMIT));
  let breakdownLabels = $derived(visibleBreakdownEntries.map((e) => e.label));
  let breakdownValues = $derived(visibleBreakdownEntries.map((e) => (metric === 'grams' ? e.grams : e.count)));
  // A fixed per-bar thickness (rather than a fixed chart height) keeps bars
  // a consistent size across dimensions/tabs instead of stretching thin
  // with many categories or ballooning thick with few.
  let compositionChartHeight = $derived(Math.max(220, visibleBreakdownEntries.length * 34 + 40));

  // --- Bean Conqueror stats/breakdowns ---

  type BcTab = 'overview' | 'favorites' | 'brewing' | 'economics';
  type BcFavoriteDimension = 'roaster' | 'origin' | 'processing' | 'roastLevel';

  const bcFavoriteDimensionLabels: Record<BcFavoriteDimension, string> = {
    roaster: 'Roaster',
    origin: 'Origin',
    processing: 'Processing',
    roastLevel: 'Roast Level'
  };

  let bcTab = $state<BcTab>('overview');
  let bcFavoriteDimension = $state<BcFavoriteDimension>('roaster');
  let bcBrewingMetric = $state<'rating' | 'count'>('rating');

  // Same reasoning as COMPOSITION_BAR_LIMIT above, applied to the Bean
  // Conqueror breakdowns — capping how many bars a chart draws keeps bar
  // thickness/label legibility consistent across dimensions with wildly
  // different cardinalities (a handful of grinders vs. dozens of roasters).
  const BEANCONQUEROR_BAR_LIMIT = 10;

  let bcFavoriteGroups = $derived(
    {
      roaster: data.beanConquerorStats.favoritesByRoaster,
      origin: data.beanConquerorStats.favoritesByOrigin,
      processing: data.beanConquerorStats.favoritesByProcessing,
      roastLevel: data.beanConquerorStats.favoritesByRoastLevel
    }[bcFavoriteDimension]
  );
  let bcVisibleFavoriteGroups = $derived(bcFavoriteGroups.slice(0, BEANCONQUEROR_BAR_LIMIT));
  let bcFavoriteChartHeight = $derived(Math.max(220, bcVisibleFavoriteGroups.length * 34 + 40));

  let bcVisibleMethodGroups = $derived(data.beanConquerorStats.byMethod.slice(0, BEANCONQUEROR_BAR_LIMIT));
  let bcVisibleGrinderGroups = $derived(data.beanConquerorStats.byGrinder.slice(0, BEANCONQUEROR_BAR_LIMIT));
  let bcMethodChartHeight = $derived(Math.max(220, bcVisibleMethodGroups.length * 34 + 40));
  let bcGrinderChartHeight = $derived(Math.max(220, bcVisibleGrinderGroups.length * 34 + 40));

  let bcVisibleCostByRoaster = $derived(
    data.beanConquerorStats.costPerGramByRoaster.slice(0, BEANCONQUEROR_BAR_LIMIT)
  );
  let bcCostChartHeight = $derived(Math.max(220, bcVisibleCostByRoaster.length * 34 + 40));

  // Same "top N of M" treatment the charts above get, applied to the
  // not-yet-tracked candidate list: a real export produces a couple hundred
  // unmatched beans, and rendering every one of them buries the rest of the
  // page. The list is already ordered newest-bean-first, so the cap keeps
  // the most relevant candidates.
  const UNMATCHED_BEAN_LIMIT = 20;
  let visibleUnmatchedBeans = $derived(data.unmatchedBeans.slice(0, UNMATCHED_BEAN_LIMIT));

  let bcRatingsDates = $derived(data.beanConquerorStats.ratingsOverTime.map((r) => r.date));
  let bcRatingsValues = $derived(data.beanConquerorStats.ratingsOverTime.map((r) => r.rating));

  function formatRating(value: number | null): string {
    return value === null ? '—' : value.toFixed(1);
  }

  function formatPercent(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}%`;
  }

  function formatCostPerGram(value: number | null): string {
    return value === null ? '—' : `$${value.toFixed(3)}/g`;
  }

  // Section tiles are dense enough that every character counts toward how
  // large the value font can go before it overflows — switching to a
  // decimal-kg reading above 1000g is both more scannable and 1-2 chars
  // shorter than the equivalent comma-grouped gram figure (e.g. "10.6kg"
  // vs "10,587g"). A one-decimal kg reading only fits the tile up to
  // ~100kg (measured live: "200.8kg" already spills past the tile edge) —
  // past that, drop the decimal and round instead. No thousands separator
  // here even though every other count on this page has one: measured
  // live, the comma alone is enough to push a 4-digit kg reading (e.g.
  // "1,000kg") past the tile edge, while the same digits with no comma
  // ("1000kg") stay safely within it up through "9999kg".
  function formatGrams(g: number): string {
    if (g >= 100000) {
      return `${Math.round(g / 1000)}kg`;
    }
    if (g >= 1000) {
      return `${(g / 1000).toFixed(1)}kg`;
    }
    return `${Math.round(g).toLocaleString('en-US')}g`;
  }

  // Only meaningful once formatGrams has rounded away the decimal (the
  // >=100kg case) — null otherwise, so the caller knows not to render a
  // tooltip when the displayed value is already exact.
  function formatGramsTooltip(g: number): string | null {
    if (g >= 100000) {
      return `${(g / 1000).toFixed(1)}kg`;
    }
    return null;
  }

  function formatKg(g: number): string {
    return `${(g / 1000).toFixed(1)} kg`;
  }

  const currencyCompactFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  });

  // "$1860.41" -> "$1.9K": a hero-adjacent tile doesn't need exact cents,
  // and the shorter string leaves far more room for a larger value font
  // before it overflows the tile.
  function formatCurrencyCompact(amount: number): string {
    return currencyCompactFormatter.format(amount);
  }

  function formatClearBy(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function formatDays(days: number): string {
    return `${days.toLocaleString('en-US', { maximumFractionDigits: 1 })}d`;
  }
</script>

<svelte:head>
  <title>Bean Tracker - Stats</title>
</svelte:head>

<h1>Stats</h1>

{#if data.isAdmin}
  <div class="rate-edit">
    {#if editingRates}
      <form
        method="POST"
        action="?/updateRates"
        class="rate-edit-form"
        use:enhance={() => {
          return async ({ update, result }) => {
            await update();
            if (result.type === 'success') {
              editingRates = false;
            }
          };
        }}
      >
        <label>
          Your rate (g/day)
          <input type="number" name="selfGPerDay" min="1" step="1" value={data.rates.selfGPerDay} required />
        </label>
        <label>
          Household rate (g/day)
          <input
            type="number"
            name="householdGPerDay"
            min="1"
            step="1"
            value={data.rates.householdGPerDay}
            required
          />
        </label>
        <button class="button" type="submit">Save</button>
        <button class="button button-secondary" type="button" onclick={() => (editingRates = false)}>
          Cancel
        </button>
      </form>
      {#if form?.error}
        <p class="badge badge-urgent">{form.error}</p>
      {/if}
    {:else}
      <button class="button button-secondary" type="button" onclick={() => (editingRates = true)}>
        ✏️ Edit consumption rates
      </button>
    {/if}
  </div>
{/if}

<section class="stats-hero">
  <div class="stats-hero-tile">
    <span class="stat-value">{data.stats.totalBacklogCount}</span>
    <div class="stat-caption">
      <span class="stat-label">bags on hand</span>
    </div>
  </div>
  <div class="stats-hero-tile">
    <span class="stat-value">{formatKg(data.stats.totalBacklogGrams)}</span>
    <div class="stat-caption">
      <span class="stat-label">total weight</span>
    </div>
  </div>
  <div class="stats-hero-tile">
    {#if data.stats.daysToClearHousehold === null || data.stats.clearByDateHousehold === null}
      <span class="stat-value">🎉</span>
      <div class="stat-caption">
        <span class="stat-label">Nothing left to drink through!</span>
      </div>
    {:else}
      <span class="stat-value">{data.stats.daysToClearHousehold}d</span>
      <div class="stat-caption">
        <span class="stat-label"
          >to clear as a household — empty by {formatClearBy(data.stats.clearByDateHousehold)}</span
        >
      </div>
    {/if}
  </div>
</section>

<section class="chart-panel">
  <h2>Weight</h2>
  <div class="stat-row stat-row-4up">
    <div class="stat-item">
      <span class="stat-value" title={formatGramsTooltip(data.stats.openedGrams)}
        >{formatGrams(data.stats.openedGrams)}</span
      >
      <div class="stat-caption">
        <span class="stat-label">Opened</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value" title={formatGramsTooltip(data.stats.unopenedBacklogGrams)}
        >{formatGrams(data.stats.unopenedBacklogGrams)}</span
      >
      <div class="stat-caption">
        <span class="stat-label">Unopened weight</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value" title={formatGramsTooltip(data.stats.totalBacklogGrams)}
        >{formatGrams(data.stats.totalBacklogGrams)}</span
      >
      <div class="stat-caption">
        <span class="stat-label">Total (opened + unopened)</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value" title={formatGramsTooltip(data.stats.finishedGrams)}
        >{formatGrams(data.stats.finishedGrams)}</span
      >
      <div class="stat-caption">
        <span class="stat-label">Finished</span>
      </div>
    </div>
  </div>
</section>

<section class="chart-panel">
  <h2>Bag Count</h2>
  <div class="stat-row stat-row-4up">
    <div class="stat-item">
      <span class="stat-value">{data.stats.openedCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Coffees opened</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{data.stats.unopenedBacklogCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Unopened bags</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{data.stats.totalBacklogCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Total backlog</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{data.stats.finishedCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Finished</span>
      </div>
    </div>
  </div>
</section>

<section class="chart-panel">
  <h2>Time to Clear</h2>
    <div class="stat-row stat-row-4up">
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.daysToClearSelf === null ? '—' : `${data.stats.daysToClearSelf}d`}
        </span>
        {#if data.stats.clearByDateSelf}
          <span class="stat-unit">by {formatClearBy(data.stats.clearByDateSelf)}</span>
        {/if}
        <div class="stat-caption">
          <span class="stat-label">To clear solo</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.daysToClearHousehold === null ? '—' : `${data.stats.daysToClearHousehold}d`}
        </span>
        {#if data.stats.clearByDateHousehold}
          <span class="stat-unit">by {formatClearBy(data.stats.clearByDateHousehold)}</span>
        {/if}
        <div class="stat-caption">
          <span class="stat-label">To clear as a household</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">{data.rates.selfGPerDay}g</span>
        <span class="stat-unit">per day</span>
        <div class="stat-caption">
          <span class="stat-label">Your rate</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">{data.rates.householdGPerDay}g</span>
        <span class="stat-unit">per day</span>
        <div class="stat-caption">
          <span class="stat-label">Household rate</span>
        </div>
      </div>
    </div>
</section>

<section class="chart-panel">
  <h2>Coffee Age</h2>
    <div class="stat-row stat-row-4up">
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.oldestUnopenedBag ? `${data.stats.oldestUnopenedBag.daysOld}d` : '—'}
        </span>
        {#if data.stats.oldestUnopenedBag}
          <a class="stat-sublink" href={`/coffees/${data.stats.oldestUnopenedBag.slug}`}
            >{data.stats.oldestUnopenedBag.roaster} · {data.stats.oldestUnopenedBag.coffeeName}</a
          >
        {/if}
        <div class="stat-caption">
          <span class="stat-label">Oldest unopened</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.youngestUnopenedBag ? `${data.stats.youngestUnopenedBag.daysOld}d` : '—'}
        </span>
        {#if data.stats.youngestUnopenedBag}
          <a class="stat-sublink" href={`/coffees/${data.stats.youngestUnopenedBag.slug}`}
            >{data.stats.youngestUnopenedBag.roaster} · {data.stats.youngestUnopenedBag.coffeeName}</a
          >
        {/if}
        <div class="stat-caption">
          <span class="stat-label">Newest unopened</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.averageAgeBacklogAndOpen === null ? '—' : formatDays(data.stats.averageAgeBacklogAndOpen)}
        </span>
        <div class="stat-caption">
          <span class="stat-label">Average age (backlog + open)</span>
        </div>
      </div>
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.averageDaysToOpen === null ? '—' : formatDays(data.stats.averageDaysToOpen)}
        </span>
        <div class="stat-caption">
          <span class="stat-label">Average time in backlog before opening</span>
        </div>
      </div>
    </div>
</section>

<section class="chart-panel">
  <h2>Economics</h2>
  <div class="stat-row stat-row-4up">
    <div class="stat-item">
      <span class="stat-value">{formatCurrencyCompact(data.stats.totalCost)}</span>
      <div class="stat-caption">
        <span class="stat-label">Tied up in backlog + open</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{formatCurrencyCompact(data.stats.totalSpentAllTime)}</span>
      <div class="stat-caption">
        <span class="stat-label">Spent all-time</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{data.stats.distinctRoasterCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Distinct roasters</span>
      </div>
    </div>
    <div class="stat-item">
      <span
        class="stat-value"
        title={data.stats.averageBagSizeGrams === null
          ? null
          : formatGramsTooltip(data.stats.averageBagSizeGrams)}
      >
        {data.stats.averageBagSizeGrams === null ? '—' : formatGrams(data.stats.averageBagSizeGrams)}
      </span>
      <div class="stat-caption">
        <span class="stat-label">Average bag size</span>
      </div>
    </div>
  </div>
</section>

<div class="chart-panel-row chart-panel-row-donuts">
  <section class="chart-panel">
    <h2>Open vs. backlog</h2>
    {#if data.stats.totalBacklogGrams === 0}
      <p class="text-muted">Nothing in the backlog yet.</p>
    {:else}
      <Chart
        type="doughnut"
        labels={['Open', 'Unopened backlog']}
        values={[data.stats.openedGrams, data.stats.unopenedBacklogGrams]}
        datasetLabel="Grams"
      />
    {/if}
  </section>

  <section class="chart-panel">
    <h2>Finished vs. still have</h2>
    {#if data.stats.finishedGrams === 0 && data.stats.totalBacklogGrams === 0}
      <p class="text-muted">Nothing tracked yet.</p>
    {:else}
      <Chart
        type="doughnut"
        labels={['Finished', 'Still have']}
        values={[data.stats.finishedGrams, data.stats.totalBacklogGrams]}
        datasetLabel="Grams"
      />
    {/if}
  </section>
</div>

<section class="chart-panel">
  <h2>Top Coffees by Category</h2>
  <div class="chart-panel-controls">
    <div class="tab-group">
      {#each Object.entries(dimensionLabels) as [key, label] (key)}
        <button aria-pressed={dimension === key} onclick={() => (dimension = key as Dimension)}>{label}</button>
      {/each}
    </div>
    <div class="tab-group">
      <button aria-pressed={metric === 'grams'} onclick={() => (metric = 'grams')}>Grams</button>
      <button aria-pressed={metric === 'count'} onclick={() => (metric = 'count')}>Count</button>
    </div>
  </div>
  {#if breakdownEntries.length === 0}
    <p class="text-muted">Nothing in the backlog yet.</p>
  {:else}
    <p class="text-muted">Showing top {visibleBreakdownEntries.length} of {breakdownEntries.length}.</p>
    <Chart
      type="bar"
      labels={breakdownLabels}
      values={breakdownValues}
      datasetLabel={dimensionLabels[dimension]}
      height={compositionChartHeight}
    />
  {/if}
</section>

<section class="chart-panel">
  <h2>Bean Conqueror</h2>
  <p class="text-muted">
    Last updated:
    {data.beanConquerorLastImportedAt
      ? new Date(data.beanConquerorLastImportedAt).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'
      : 'never'}
  </p>
  {#if data.isAdmin}
    <form method="POST" action="?/importBeanConqueror" enctype="multipart/form-data" use:enhance>
      <input type="file" name="file" accept=".xlsx" required />
      <button class="button" type="submit">Import</button>
    </form>
    {#if form?.error}
      <p class="badge badge-urgent">{form.error}</p>
    {/if}
  {/if}

  {#snippet candidateActions(bean: UnmatchedBean)}
    <div class="action-buttons candidate-actions">
      <button class="button button-secondary" type="button" onclick={() => openCreateModal(bean)}>Create</button>
      <form
        method="POST"
        action="?/dismissBeanConqueror"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
          };
        }}
      >
        <input type="hidden" name="id" value={bean.id} />
        <button class="button button-danger" type="submit">Dismiss</button>
      </form>
    </div>
  {/snippet}

  {#if data.unmatchedBeans.length > 0}
    <h3>Not yet tracked ({data.unmatchedBeans.length})</h3>
    <p class="text-muted">Showing top {visibleUnmatchedBeans.length} of {data.unmatchedBeans.length}.</p>
    {#if candidateView === 'compact'}
      <div class="compact-list">
        {#each visibleUnmatchedBeans as bean (bean.id)}
          <div class="compact-row-wrap">
            <div class="compact-row">
              <div class="compact-row-main">
                <div class="compact-row-title">{bean.name}</div>
                <div class="compact-row-sub text-muted">{bean.roaster ?? 'Unknown roaster'}</div>
              </div>
            </div>
            {#if data.isAdmin}
              {@render candidateActions(bean)}
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Roaster</th>
              <th>Origin</th>
              <th>Processing</th>
              <th>Roast date</th>
              <th>Decaf</th>
              {#if data.isAdmin}<th>Actions</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each visibleUnmatchedBeans as bean (bean.id)}
              <tr>
                <td>{bean.name}</td>
                <td>{bean.roaster ?? 'Unknown roaster'}</td>
                <td>{bean.origin ?? '—'}</td>
                <td>{bean.processing ?? '—'}</td>
                <td>{bean.roastDate ?? '—'}</td>
                <td>{bean.decaffeinated ? 'Yes' : 'No'}</td>
                {#if data.isAdmin}
                  <td>{@render candidateActions(bean)}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  {#if data.beanConquerorStats.totalBrews > 0 || data.beanConquerorStats.totalBeans > 0}
    <h3>Stats &amp; breakdowns</h3>
    <div class="chart-panel-controls">
      <div class="tab-group">
        <button aria-pressed={bcTab === 'overview'} onclick={() => (bcTab = 'overview')}>Overview</button>
        <button aria-pressed={bcTab === 'favorites'} onclick={() => (bcTab = 'favorites')}>Favorites</button>
        <button aria-pressed={bcTab === 'brewing'} onclick={() => (bcTab = 'brewing')}>Brewing</button>
        <button aria-pressed={bcTab === 'economics'} onclick={() => (bcTab = 'economics')}>Economics</button>
      </div>
    </div>

    {#if bcTab === 'overview'}
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">{data.beanConquerorStats.totalBrews}</span>
          <div class="stat-caption">
            <span class="stat-label">Total brews</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value">{data.beanConquerorStats.totalBeans}</span>
          <div class="stat-caption">
            <span class="stat-label">Total beans</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value">{formatRating(data.beanConquerorStats.averageRating)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average rating</span>
          </div>
        </div>
      </div>
      {#if bcRatingsDates.length === 0}
        <p class="text-muted">No rated brews yet.</p>
      {:else}
        <Chart type="line" labels={bcRatingsDates} values={bcRatingsValues} datasetLabel="Rating" />
      {/if}
    {:else if bcTab === 'favorites'}
      <div class="chart-panel-controls">
        <div class="tab-group">
          {#each Object.entries(bcFavoriteDimensionLabels) as [key, label] (key)}
            <button
              aria-pressed={bcFavoriteDimension === key}
              onclick={() => (bcFavoriteDimension = key as BcFavoriteDimension)}>{label}</button
            >
          {/each}
        </div>
      </div>
      {#if bcFavoriteGroups.length === 0}
        <p class="text-muted">No rated brews yet.</p>
      {:else}
        <p class="text-muted">Showing top {bcVisibleFavoriteGroups.length} of {bcFavoriteGroups.length}.</p>
        <Chart
          type="bar"
          labels={bcVisibleFavoriteGroups.map((g) => g.label)}
          values={bcVisibleFavoriteGroups.map((g) => g.averageRating)}
          datasetLabel="Average rating"
          height={bcFavoriteChartHeight}
        />
      {/if}
    {:else if bcTab === 'brewing'}
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">{formatPercent(data.beanConquerorStats.averageExtractionYieldPercent)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average extraction yield</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value">{formatPercent(data.beanConquerorStats.averageTdsPercent)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average TDS</span>
          </div>
        </div>
      </div>
      <div class="chart-panel-controls">
        <div class="tab-group">
          <button aria-pressed={bcBrewingMetric === 'rating'} onclick={() => (bcBrewingMetric = 'rating')}
            >Rating</button
          >
          <button aria-pressed={bcBrewingMetric === 'count'} onclick={() => (bcBrewingMetric = 'count')}
            >Count</button
          >
        </div>
      </div>
      <div class="chart-panel-row">
        <div>
          <h3>By Method</h3>
          {#if bcVisibleMethodGroups.length === 0}
            <p class="text-muted">No rated brews yet.</p>
          {:else}
            <Chart
              type="bar"
              labels={bcVisibleMethodGroups.map((g) => g.label)}
              values={bcVisibleMethodGroups.map((g) => (bcBrewingMetric === 'rating' ? g.averageRating : g.brewCount))}
              datasetLabel={bcBrewingMetric === 'rating' ? 'Average rating' : 'Brews'}
              height={bcMethodChartHeight}
            />
          {/if}
        </div>
        <div>
          <h3>By Grinder</h3>
          {#if bcVisibleGrinderGroups.length === 0}
            <p class="text-muted">No rated brews yet.</p>
          {:else}
            <Chart
              type="bar"
              labels={bcVisibleGrinderGroups.map((g) => g.label)}
              values={bcVisibleGrinderGroups.map((g) =>
                bcBrewingMetric === 'rating' ? g.averageRating : g.brewCount
              )}
              datasetLabel={bcBrewingMetric === 'rating' ? 'Average rating' : 'Brews'}
              height={bcGrinderChartHeight}
            />
          {/if}
        </div>
      </div>
    {:else if bcTab === 'economics'}
      <div class="stats-hero">
        <div class="stats-hero-tile">
          <span class="stat-value">{formatCostPerGram(data.beanConquerorStats.averageCostPerGram)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average cost per gram</span>
          </div>
        </div>
      </div>
      {#if bcVisibleCostByRoaster.length === 0}
        <p class="text-muted">No cost data yet.</p>
      {:else}
        <p class="text-muted">
          Showing top {bcVisibleCostByRoaster.length} of {data.beanConquerorStats.costPerGramByRoaster.length}.
        </p>
        <Chart
          type="bar"
          labels={bcVisibleCostByRoaster.map((g) => g.label)}
          values={bcVisibleCostByRoaster.map((g) => g.averageCostPerGram)}
          datasetLabel="Cost per gram ($)"
          height={bcCostChartHeight}
        />
      {/if}
    {/if}
  {/if}

  {#if createModalBean}
    <div class="modal-backdrop">
      <div class="modal">
        <h2>Create coffee from {createModalBean.name}</h2>
        <CoffeeForm
          prefill={prefillFor(createModalBean)}
          roastLevels={data.roastLevels}
          roasters={data.roasters}
          origins={data.origins}
          processingMethods={data.processingMethods}
          formError={form?.error ?? null}
          oncancel={() => (createModalBean = null)}
          onsuccess={closeCreateModal}
        />
      </div>
    </div>
  {/if}
</section>
