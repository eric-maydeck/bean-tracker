<script lang="ts">
  import { labelTip } from '$lib/components/labelTip';
  import Usd from '$lib/components/Usd.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { placeTip } from '$lib/components/modeTip';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { usd, usdPrecise, wholeUsd } from '$lib/money';
  import { enhance } from '$app/forms';
  import { invalidateAll, afterNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import Chart from '$lib/components/Chart.svelte';
  import { linkPickerGroups, cap } from '$lib/linkPicker';
  import LinkPicker from '$lib/components/LinkPicker.svelte';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { defaultViewForWidth } from '$lib/defaultView';
  import { currentParams, pickOne, pickMany } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import { parseRange, parsePeople, peopleHelp, DEFAULTS, PEOPLE, RANGES, RANGE_LABELS } from '$lib/insightsUrl';
  import { loadChoice, serializeChoice } from '$lib/rememberedChoice';
  import { parseStatsTab, parseBcAverage } from './statsTab';
  import type { UnmatchedBean } from '$lib/server/beanconqueror';
  import { bcPerPerson, type RatedGroup, type PeriodWindow } from './beanConquerorStatsData';
  import type { CoffeeRow } from '$lib/types';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let createModalBean = $state<UnmatchedBean | null>(null);
  // Which "Not yet tracked" row has its Link picker open. Inline action
  // state, like the Create modal, so it's never in the URL.
  let linkingBeanId = $state<string | null>(null);
  let linkCoffeeId = $state<number | null>(null);

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
  const DIMENSIONS = Object.keys(dimensionLabels) as Dimension[];
  const METRICS = ['grams', 'count'] as const satisfies readonly Metric[];

  // URL-only view state (dimension/metric/status/bc/bc_fav/bc_metric) --
  // no localStorage, unlike Coffees/Subscriptions/On Deck: a bare /stats
  // always shows the defaults below. An explicit choice still always
  // writes its param, even when it equals the default.
  let explicitDimension = $state<Dimension | undefined>(pickOne(currentParams(page.url), 'dimension', DIMENSIONS));
  let explicitMetric = $state<Metric | undefined>(pickOne(currentParams(page.url), 'metric', METRICS));
  let dimension = $derived(explicitDimension ?? 'roaster');
  let metric = $derived(explicitMetric ?? 'grams');
  let editingHousehold = $state(false);
  // Time to Clear's own Period (temporary panel) and the people mode (every tab).
  let explicitRange = $state(parseRange(currentParams(page.url), data.years));
  let explicitPeople = $state(parsePeople(currentParams(page.url), data.householdSize));
  let range = $derived(explicitRange ?? DEFAULTS.range);
  // A household of one has no split, even right after saving size 1 with ?people=person still held.
  let people = $derived(data.householdSize > 1 ? (explicitPeople ?? 'household') : 'household');
  let bc = $derived(people === 'person' ? bcPerPerson(data.beanConquerorStats, data.householdSize) : data.beanConquerorStats);
  // 6.5 brews per person, not "6.5000001" or a rounded 7.
  const tenth = (n: number) => String(Math.round(n * 10) / 10);
  const PEOPLE_HELP = $derived(peopleHelp(data.householdSize));
  let use = $derived(data.consumption[range][people]);
  const ROLLING = RANGES.filter((r) => r !== 'ytd' && r !== 'all');

  // Caps how many bars the composition chart draws — without this, a
  // dimension like Roaster with 20+ distinct values crams so many bars into
  // the chart that Chart.js starts skipping y-axis labels to avoid overlap.
  const COMPOSITION_BAR_LIMIT = 10;

  // Multi-select status filter. Iterating statusLabels (backlog, open,
  // archived) keeps the key in the server's canonical combo order.
  const statusLabels = { backlog: 'Backlog', open: 'Open', archived: 'Completed' } as const;
  type Status = keyof typeof statusLabels;
  const STATUSES = Object.keys(statusLabels) as Status[];
  // pickMany already returns undefined for an empty/all-unknown selection,
  // which is exactly the "never empty" default below.
  let explicitStatus = $state<Status[] | undefined>(pickMany(currentParams(page.url), 'status', STATUSES));
  let selectedStatuses = $derived(explicitStatus ?? (['backlog', 'open'] as Status[]));
  function toggleStatus(status: Status) {
    if (!selectedStatuses.includes(status)) explicitStatus = [...selectedStatuses, status];
    // Refuse to deselect the last one — an empty selection has no chart.
    else if (selectedStatuses.length > 1) explicitStatus = selectedStatuses.filter((s) => s !== status);
  }
  let statusKey = $derived(
    (Object.keys(statusLabels) as Status[]).filter((s) => selectedStatuses.includes(s)).join('+')
  );

  let breakdownEntries = $derived(data.stats.breakdowns[statusKey][dimension]);
  // Roast Level keeps its intentional light-to-dark order regardless of
  // metric — every other dimension re-sorts by whichever metric is active,
  // since "Big" by grams isn't necessarily "Big" by count.
  let sortedBreakdownEntries = $derived(
    dimension === 'roastLevel'
      ? breakdownEntries
      : [...breakdownEntries].sort((a, b) => (metric === 'grams' ? b.grams - a.grams : b.count - a.count))
  );
  let visibleBreakdownEntries = $derived(sortedBreakdownEntries.slice(0, COMPOSITION_BAR_LIMIT));
  // Every status selected is the largest any bar can get for this
  // dimension/metric, so the axis stays put while toggling statuses.
  let breakdownAxisMax = $derived(
    Math.max(
      0,
      ...data.stats.breakdowns['backlog+open+archived'][dimension].map((e) => (metric === 'grams' ? e.grams : e.count))
    )
  );
  let breakdownLabels = $derived(visibleBreakdownEntries.map((e) => e.label));
  let breakdownValues = $derived(visibleBreakdownEntries.map((e) => (metric === 'grams' ? e.grams : e.count)));
  // A fixed per-bar thickness (rather than a fixed chart height) keeps bars
  // a consistent size across dimensions/tabs instead of stretching thin
  // with many categories or ballooning thick with few.
  let compositionChartHeight = $derived(Math.max(220, visibleBreakdownEntries.length * 34 + 40));

  // --- Bean Conqueror stats/breakdowns ---

  type BcTab = 'overview' | 'favorites' | 'brewing' | 'economics';
  type BcFavoriteDimension = 'roaster' | 'origin' | 'processing' | 'roastLevel';
  const BC_TABS = ['overview', 'favorites', 'brewing', 'economics'] as const satisfies readonly BcTab[];
  const BC_METRICS = ['rating', 'count'] as const;

  const bcFavoriteDimensionLabels: Record<BcFavoriteDimension, string> = {
    roaster: 'Roaster',
    origin: 'Origin',
    processing: 'Processing',
    roastLevel: 'Roast Level'
  };
  const BC_FAV_DIMENSIONS = Object.keys(bcFavoriteDimensionLabels) as BcFavoriteDimension[];

  let explicitTab = $state(parseStatsTab(currentParams(page.url)));
  let tab = $derived(explicitTab ?? 'general');
  let explicitBc = $state<BcTab | undefined>(pickOne(currentParams(page.url), 'bc', BC_TABS));
  let explicitBcFav = $state<BcFavoriteDimension | undefined>(pickOne(currentParams(page.url), 'bc_fav', BC_FAV_DIMENSIONS));
  let explicitBcMetric = $state<(typeof BC_METRICS)[number] | undefined>(
    pickOne(currentParams(page.url), 'bc_metric', BC_METRICS)
  );
  let bcTab = $derived(explicitBc ?? 'overview');
  let bcFavoriteDimension = $derived(explicitBcFav ?? 'roaster');
  let bcBrewingMetric = $derived(explicitBcMetric ?? 'rating');
  // Per day vs. per brew day for the Brews/Grams window tiles. Unlike the
  // params above, the URL only ever carries the non-default `avg=brew-day`.
  // A clicked choice is also remembered per browser until changed (no TTL);
  // an `avg` param wins over it without overwriting it.
  // Clicking "Per day" stores 'day' explicitly so it overrides a stored
  // 'brew-day'.
  const BC_AVERAGES = ['day', 'brew-day'] as const;
  const BC_AVERAGE_STORAGE_KEY = 'bean-tracker-stats-bc-average';
  let explicitBcAverage = $state<(typeof BC_AVERAGES)[number] | undefined>(parseBcAverage(currentParams(page.url)));
  let bcAverage = $derived(explicitBcAverage ?? 'day');
  const bcWindowLabels: Record<PeriodWindow, string> = { all: 'All time', year: 'Year', month: 'Month', week: 'Week' };

  // Same-route navigation (e.g. opening a different /stats link while
  // already here) re-reads the URL; the $state initializers above already
  // cover the first load (including SSR). `loaded` gates the effect below
  // so it doesn't write/replaceState during hydration, before SvelteKit's
  // router has started (matches On Deck/Subscriptions/Coffees).
  let loaded = $state(false);

  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.scrollPaddingTop = `${barHeight}px`;
    return () => document.documentElement.style.removeProperty('scroll-padding-top');
  });

  afterNavigate(() => {
    const p = currentParams(page.url);
    explicitDimension = pickOne(p, 'dimension', DIMENSIONS);
    explicitMetric = pickOne(p, 'metric', METRICS);
    explicitStatus = pickMany(p, 'status', STATUSES);
    explicitTab = parseStatsTab(p);
    explicitRange = parseRange(p, data.years);
    explicitPeople = parsePeople(p, data.householdSize);
    explicitBc = pickOne(p, 'bc', BC_TABS);
    explicitBcFav = pickOne(p, 'bc_fav', BC_FAV_DIMENSIONS);
    explicitBcMetric = pickOne(p, 'bc_metric', BC_METRICS);
    try {
      explicitBcAverage =
        parseBcAverage(p) ?? loadChoice(localStorage.getItem(BC_AVERAGE_STORAGE_KEY), BC_AVERAGES, Date.now(), Infinity);
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
      explicitBcAverage = parseBcAverage(p);
    }
    loaded = true;
  });

  $effect(() => {
    const params = new URLSearchParams();
    if (explicitDimension) params.set('dimension', explicitDimension);
    if (explicitMetric) params.set('metric', explicitMetric);
    if (explicitStatus) for (const s of explicitStatus) params.append('status', s);
    if (explicitTab) params.set('tab', explicitTab);
    if (explicitRange) params.set('range', explicitRange);
    if (explicitPeople && data.householdSize > 1) params.set('people', explicitPeople);
    if (explicitBc) params.set('bc', explicitBc);
    if (explicitBcFav) params.set('bc_fav', explicitBcFav);
    if (explicitBcMetric) params.set('bc_metric', explicitBcMetric);
    if (explicitBcAverage === 'brew-day') params.set('avg', explicitBcAverage);
    // Gate check comes after reading every param above so the effect still
    // tracks all of them as dependencies even while gated.
    if (!loaded) return;
    writeUrlParams(params);
  });

  // Only a click is remembered; opening a link with `avg` leaves the
  // stored choice alone.
  function chooseBcAverage(choice: (typeof BC_AVERAGES)[number]) {
    explicitBcAverage = choice;
    try {
      localStorage.setItem(BC_AVERAGE_STORAGE_KEY, serializeChoice(choice, Date.now()));
    } catch {
      // ignore — the choice still works for this visit, it just isn't remembered
    }
  }

  // Same reasoning as COMPOSITION_BAR_LIMIT above, applied to the Bean
  // Conqueror breakdowns — capping how many bars a chart draws keeps bar
  // thickness/label legibility consistent across dimensions with wildly
  // different cardinalities (a handful of grinders vs. dozens of roasters).
  const BEANCONQUEROR_BAR_LIMIT = 10;

  let bcFavoriteGroups = $derived(
    {
      roaster: bc.favoritesByRoaster,
      origin: bc.favoritesByOrigin,
      processing: bc.favoritesByProcessing,
      roastLevel: bc.favoritesByRoastLevel
    }[bcFavoriteDimension]
  );
  let bcVisibleFavoriteGroups = $derived(bcFavoriteGroups.slice(0, BEANCONQUEROR_BAR_LIMIT));
  let bcFavoriteChartHeight = $derived(Math.max(220, bcVisibleFavoriteGroups.length * 34 + 40));

  // byMethod/byGrinder arrive sorted by averageRating (the server's default
  // order) — switching the Rating/Count toggle only changed which value
  // each bar showed, not which bars were on top, so the Count view looked
  // unsorted. Re-sorting here by whichever metric is currently selected
  // keeps the chart's bar order matching what it's actually displaying.
  function sortByMetric(groups: RatedGroup[]): RatedGroup[] {
    return [...groups].sort((a, b) =>
      bcBrewingMetric === 'rating' ? b.averageRating - a.averageRating : b.brewCount - a.brewCount
    );
  }
  let bcVisibleMethodGroups = $derived(sortByMetric(bc.byMethod).slice(0, BEANCONQUEROR_BAR_LIMIT));
  let bcVisibleGrinderGroups = $derived(
    sortByMetric(bc.byGrinder).slice(0, BEANCONQUEROR_BAR_LIMIT)
  );
  let bcMethodChartHeight = $derived(Math.max(220, bcVisibleMethodGroups.length * 34 + 40));
  let bcGrinderChartHeight = $derived(Math.max(220, bcVisibleGrinderGroups.length * 34 + 40));

  let bcVisibleCostByRoaster = $derived(
    bc.costPerGramByRoaster.slice(0, BEANCONQUEROR_BAR_LIMIT)
  );
  // One money format for the chart (ui-rules 46): its labels round, its tips keep the cents.
  let costWhole = $derived(wholeUsd(bcVisibleCostByRoaster.map((g) => g.averageCostPerGram)));
  let bcCostChartHeight = $derived(Math.max(220, bcVisibleCostByRoaster.length * 34 + 40));

  // The "top N of M" cap on the not-yet-tracked candidate list is now
  // applied server-side (+page.server.ts) via a SQL LIMIT, with the total
  // count from a separate COUNT(*) query — data.unmatchedBeans.beans is
  // already the capped list.

  let bcRatingsDates = $derived(bc.ratingsOverTime.map((r) => r.date));
  let bcRatingsValues = $derived(bc.ratingsOverTime.map((r) => r.rating));
  let bcBrewsPerDay = $derived(bc.brewsPerDay);

  function formatRating(value: number | null): string {
    return value === null ? '—' : value.toFixed(1);
  }

  function formatTemperature(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)}°C`;
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

<!-- One toggle state, shown in both the Brews and Grams panel headers. -->
<!-- A per-person label's mode word opens its help (ui-rules 27, as on /insights); `id` keys its popover. -->
{#snippet pp(label: string, id: string, sep = ' · ')}{label}{#if people === 'person'}{sep}<button class="mode-tip-button" popovertarget="tip-pp-{id}" aria-describedby="tip-pp-{id}"
    ><span class="tip-text">per person</span><Icon name="question" /></button
  ><span class="mode-tip" id="tip-pp-{id}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Per person', lines: [PEOPLE_HELP.person] }} /></span>{/if}{/snippet}

<!-- A weight; where formatGrams drops the decimal (100 kg and up), the exact grams in the shared text tip (like Usd). -->
{#snippet grams(g: number)}{#if g >= 100000}<TextTip label={formatGrams(g)} tip={{ title: 'Exact', rows: [['To the gram', `${Math.round(g).toLocaleString('en-US')} g`]] }} />{:else}{formatGrams(g)}{/if}{/snippet}

{#snippet bcAverageToggle()}
  <div class="form-field group-field">
    <span>Average</span>
    <div class="tab-group tab-group-compact" role="group" aria-label="Average">
      <button aria-pressed={bcAverage === 'day'} onclick={() => chooseBcAverage('day')}>Per day</button>
      <button aria-pressed={bcAverage === 'brew-day'} onclick={() => chooseBcAverage('brew-day')}
        >Per brew day</button
      >
    </div>
  </div>
{/snippet}

<div class="toolbar">
  <h1>Stats</h1>
  <ShareButton />
</div>

<div class="chart-panel-controls stats-bar filter-bar" bind:offsetHeight={barHeight}>
  <div class="form-field group-field">
    <span>View</span>
    <div class="tab-group" role="group" aria-label="View">
      <button aria-pressed={tab === 'general'} onclick={() => (explicitTab = 'general')}>General</button>
      <button aria-pressed={tab === 'bq'} onclick={() => (explicitTab = 'bq')}>Bean Conqueror</button>
    </div>
  </div>
  {#if data.householdSize > 1}
    <div class="form-field group-field">
      <span>People</span>
      <div class="tab-group" role="group" aria-label="People">
        {#each PEOPLE as m (m)}
          <button
            aria-pressed={people === m}
            use:labelTip={{ title: m === 'person' ? 'Per person' : 'Household', lines: [PEOPLE_HELP[m]] }}
            aria-describedby="people-help-{m}"
            onclick={() => (explicitPeople = m)}>{m === 'person' ? 'Per person' : 'Household'}</button
          >
        {/each}
      </div>
    </div>
    <span id="people-help-household" hidden>{PEOPLE_HELP.household}</span>
    <span id="people-help-person" hidden>{PEOPLE_HELP.person}</span>
  {/if}
  {#if data.isAdmin}
    {#if editingHousehold}
      <form
        method="POST"
        action="?/updateHouseholdSize"
        class="household-edit-form"
        use:enhance={() => {
          return async ({ update, result }) => {
            await update();
            if (result.type === 'success') {
              editingHousehold = false;
              if (data.householdSize === 1) explicitPeople = undefined;
            }
          };
        }}
      >
        <label>
          Household size
          <input type="number" name="householdSize" min="1" max="20" step="1" value={data.householdSize} required />
        </label>
        <button class="button" type="submit">Save</button>
        <button class="button button-ghost" type="button" onclick={() => (editingHousehold = false)}>Cancel</button>
        {#if form?.error}
          <span class="badge badge-urgent"><CoffeeName text={form.error} /></span>
        {/if}
      </form>
    {:else}
      <button class="button button-secondary" type="button" onclick={() => (editingHousehold = true)}>
        Edit household size
      </button>
    {/if}
  {/if}
</div>

{#if tab === 'general'}
<section class="chart-panel">
  <h2>At a Glance</h2>
  <div class="stat-row">
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{data.stats.totalBacklogCount}</span>
      <div class="stat-caption">
        <span class="stat-label">Bags on hand</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{@render grams(data.stats.totalBacklogGrams)}</span>
      <div class="stat-caption">
        <span class="stat-label">Total weight</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      {#if data.onHand === 0}
        <span class="stat-value">🎉</span>
        <div class="stat-caption">
          <span class="stat-label">Nothing left to drink through!</span>
        </div>
      {:else}
        <span class="stat-value">{use.daysToClear === null ? '—' : `${use.daysToClear}d`}</span>
        {#if use.clearBy}<span class="stat-unit">by {formatClearBy(use.clearBy)}</span>{/if}
        <div class="stat-caption">
          <span class="stat-label">{#if people === 'person'}{@render pp('To clear', 'hero-clear', ' ')}{:else}To clear as a household{/if}</span>
        </div>
      {/if}
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value"
        >{#if data.stats.averageBagCost === null}—{:else}<Usd n={data.stats.averageBagCost} />{/if}</span
      >
      <div class="stat-caption">
        <span class="stat-label">Average bag cost</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{data.stats.freshness.readyCount}</span>
      <span class="stat-unit">of {data.stats.totalBacklogCount} bags</span>
      <div class="stat-caption">
        <span class="stat-label">Rested &amp; ready</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{data.stats.freshness.drinkSoonCount}</span>
      <span class="stat-unit">urgency 40+</span>
      <div class="stat-caption">
        <span class="stat-label">Drink soon</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{data.stats.freshness.restingCount}</span>
      {#if data.stats.freshness.nextReadyInDays !== null}
        <span class="stat-unit">next ready in {data.stats.freshness.nextReadyInDays}d</span>
      {/if}
      <div class="stat-caption">
        <span class="stat-label">Still resting</span>
      </div>
    </div>
    <div class="stat-item stat-item-hero">
      <span class="stat-value">{data.stats.freshness.frozenCount}</span>
      {#if data.stats.freshness.frozenGrams > 0}
        <span class="stat-unit">{formatGrams(data.stats.freshness.frozenGrams)}</span>
      {/if}
      <div class="stat-caption">
        <span class="stat-label">In the freezer</span>
      </div>
    </div>
  </div>
</section>

<section class="chart-panel">
  <h2>Weight</h2>
  <div class="stat-row">
    <div class="stat-item">
      <span class="stat-value">{@render grams(data.stats.openedGrams)}</span>
      <div class="stat-caption">
        <span class="stat-label">Opened</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{@render grams(data.stats.unopenedBacklogGrams)}</span>
      <div class="stat-caption">
        <span class="stat-label">Unopened weight</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{@render grams(data.stats.totalBacklogGrams)}</span>
      <div class="stat-caption">
        <span class="stat-label">Total (opened + unopened)</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-value">{@render grams(data.stats.finishedGrams)}</span>
      <div class="stat-caption">
        <span class="stat-label">Finished</span>
      </div>
    </div>
  </div>
</section>

<section class="chart-panel">
  <h2>Bag Count</h2>
  <div class="stat-row">
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

<!-- Temporary (stats-per-person spec): measured rates with their own Period, until Ocean of
     statistics fills /insights out. /insights' Consumption panel is the lasting home. -->
<section class="chart-panel">
  <div class="chart-panel-header">
    <h2>Time to Clear</h2>
    <select class="period-select" aria-label="Period" value={range} onchange={(e) => (explicitRange = e.currentTarget.value)}>
      <optgroup label="Rolling">
        {#each ROLLING as r (r)}<option value={r}>{RANGE_LABELS[r]}</option>{/each}
      </optgroup>
      <optgroup label="Calendar">
        <option value="ytd">{RANGE_LABELS.ytd}</option>
        {#each [...data.years].reverse() as y (y)}<option value={String(y)}>{y}</option>{/each}
      </optgroup>
      <optgroup label="Everything">
        <option value="all">{RANGE_LABELS.all}</option>
      </optgroup>
    </select>
  </div>
  <div class="stat-row">
    <div class="stat-item">
      <span class="stat-value">{use.daysToClear === null ? '—' : `${use.daysToClear}d`}</span>
      {#if use.clearBy}<span class="stat-unit">by {formatClearBy(use.clearBy)}</span>{/if}
      <div class="stat-caption"><span class="stat-label">{@render pp('Time to clear', 'clear')}</span></div>
    </div>
    {#each [['Per day', use.perDay], ['Per week', use.perWeek], ['Per month', use.perMonth]] as const as [label, g] (label)}
      <div class="stat-item">
        <span class="stat-value">{g === null ? '—' : formatGrams(g)}</span>
        <div class="stat-caption"><span class="stat-label">{@render pp(label, label)}</span></div>
      </div>
    {/each}
  </div>
</section>

<section class="chart-panel">
  <h2>Coffee Age</h2>
    <div class="stat-row">
      <div class="stat-item">
        <span class="stat-value">
          {data.stats.oldestUnopenedBag ? `${data.stats.oldestUnopenedBag.daysOld}d` : '—'}
        </span>
        {#if data.stats.oldestUnopenedBag}
          <a class="stat-sublink" href={`/coffees/${data.stats.oldestUnopenedBag.slug}`}
            >{data.stats.oldestUnopenedBag.roaster} · <CoffeeName name={data.stats.oldestUnopenedBag.coffeeName} /></a
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
            >{data.stats.youngestUnopenedBag.roaster} · <CoffeeName name={data.stats.youngestUnopenedBag.coffeeName} /></a
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
  <div class="stat-row">
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
      <span class="stat-value">{#if data.stats.averageBagSizeGrams === null}—{:else}{@render grams(data.stats.averageBagSizeGrams)}{/if}</span>
      <div class="stat-caption">
        <span class="stat-label">Average bag size</span>
      </div>
    </div>
  </div>
</section>

<div class="chart-panel-row">
  <section class="chart-panel">
    <h2>Open vs. backlog</h2>
    {#if data.onHand === 0}
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
    {#if data.stats.finishedGrams === 0 && data.onHand === 0}
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
    <div class="form-field group-field">
      <span>Category</span>
      <div class="tab-group" role="group" aria-label="Category">
        {#each Object.entries(dimensionLabels) as [key, label] (key)}
          <button aria-pressed={dimension === key} onclick={() => (explicitDimension = key as Dimension)}>{label}</button>
        {/each}
      </div>
    </div>
    <div class="form-field group-field">
      <span>Measure</span>
      <div class="tab-group" role="group" aria-label="Measure">
        <button aria-pressed={metric === 'grams'} onclick={() => (explicitMetric = 'grams')}>Grams</button>
        <button aria-pressed={metric === 'count'} onclick={() => (explicitMetric = 'count')}>Count</button>
      </div>
    </div>
    <div class="form-field group-field">
      <span>Status</span>
      <div class="tab-group" role="group" aria-label="Status">
        {#each Object.entries(statusLabels) as [key, label] (key)}
          <button aria-pressed={selectedStatuses.includes(key as Status)} onclick={() => toggleStatus(key as Status)}
            >{label}</button
          >
        {/each}
      </div>
    </div>
  </div>
  {#if breakdownEntries.length === 0}
    <p class="text-muted">No coffees with the selected status.</p>
  {:else}
    {#if visibleBreakdownEntries.length < breakdownEntries.length}<p class="text-muted">Showing top {visibleBreakdownEntries.length} of {breakdownEntries.length}.</p>{/if}
    <Chart
      type="bar"
      labels={breakdownLabels}
      values={breakdownValues}
      datasetLabel={dimensionLabels[dimension]}
      height={compositionChartHeight}
      valueAxisMax={breakdownAxisMax}
    />
  {/if}
</section>

{:else}
<section class="chart-panel beanconqueror-panel">
  <h2>Bean Conqueror</h2>
  <p class="text-muted">
    Last updated:
    {data.beanConquerorLastImportedAt
      ? new Date(data.beanConquerorLastImportedAt).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'
      : 'never'}
  </p>
  {#if data.isAdmin}
    <form method="POST" action="?/importBeanConqueror&tab=bq" enctype="multipart/form-data" use:enhance>
      <label>
        Bean Conqueror export (.zip)
        <!-- The server drops bodies over 20 MB (BODY_SIZE_LIMIT) with a bare error: stop them here.
             Must match MAX_UPLOAD_BYTES in src/lib/server/beanConquerorJson.ts. -->
        <input
          type="file"
          name="file"
          accept=".zip"
          required
          onchange={(e) => {
            const input = e.currentTarget;
            input.setCustomValidity(
              (input.files?.[0]?.size ?? 0) > 20 * 1024 * 1024
                ? 'Over 20 MB: upload Beanconqueror.zip (the regular export, not the one with photos)'
                : ''
            );
          }}
        />
      </label>
      <button class="button" type="submit">Import</button>
    </form>
    {#if form?.error}
      <p class="badge badge-urgent"><CoffeeName text={form.error} /></p>

    {:else if form && 'imported' in form && form.imported}
      <p class="text-muted">
        Imported {form.imported.beans} beans, {form.imported.brews} brews, {form.imported.waters} waters.
      </p>
    {/if}
  {/if}

  {#snippet candidateActions(bean: UnmatchedBean)}
    {#if linkingBeanId === bean.id}
      {@const groups = linkPickerGroups(
        { roaster: bean.roaster, likelyMatchId: bean.likelyMatch?.id ?? null },
        data.linkableCoffees
      )}
      <form
        class="link-picker"
        method="POST"
        action="?/linkBeanConqueror&tab=bq"
        use:enhance={() => {
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success') linkingBeanId = null;
          };
        }}
      >
        <input type="hidden" name="beanId" value={bean.id} />
        <LinkPicker {groups} label={`Coffee to link ${bean.name} to`} bind:value={linkCoffeeId} />
        <div class="action-buttons candidate-actions link-picker-actions">
          <button class="button" type="submit" disabled={linkCoffeeId == null}>Link</button>
          <button class="button button-secondary" type="button" onclick={() => (linkingBeanId = null)}>Cancel</button>
        </div>
      </form>
    {:else}
      <div class="action-buttons candidate-actions">
        <button class="button button-secondary" type="button" onclick={() => openCreateModal(bean)}>Create</button>
        <button class="button button-secondary" type="button" onclick={() => {
          linkingBeanId = bean.id;
          linkCoffeeId = null;
        }}>Link</button>
        <form
          method="POST"
          action="?/dismissBeanConqueror&tab=bq"
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
    {/if}
  {/snippet}

  {#if data.unmatchedBeans.total > 0}
    <h3>Not yet tracked ({data.unmatchedBeans.total})</h3>
    {#if data.unmatchedBeans.beans.length < data.unmatchedBeans.total}<p class="text-muted">Showing top {data.unmatchedBeans.beans.length} of {data.unmatchedBeans.total}.</p>{/if}
    {#if candidateView === 'compact'}
      <div class="compact-list bean-cards">
        {#each data.unmatchedBeans.beans as bean (bean.id)}
          <div class="compact-row-wrap">
            <div class="compact-row">
              <div class="compact-row-main">
                <div class="compact-row-title">
                  <CoffeeName name={bean.name} />
                  {#if bean.decaffeinated}<span class="badge badge-decaf">Decaf</span>{/if}
                </div>
                <div class="compact-row-sub text-muted">{bean.roaster ?? 'Unknown roaster'}</div>
              </div>
            </div>
            <div class="compact-row-detail">
              <div class="compact-detail-grid">
                <div><span class="eyebrow">Origin</span>{bean.origin ?? '—'}</div>
                <div><span class="eyebrow">Processing</span>{bean.processing ?? '—'}</div>
                <div><span class="eyebrow">Roast date</span>{bean.roastDate ?? '—'}</div>
              </div>
              {#if bean.likelyMatch}
                <p class="text-muted">
                  Possibly already tracked as <a href={`/coffees/${bean.likelyMatch.slug}`}
                    ><CoffeeName name={bean.likelyMatch.coffeeName} /></a
                  >
                  ({bean.likelyMatch.roastDate ? `Roasted ${bean.likelyMatch.roastDate}` : 'No roast date'} · {cap(bean.likelyMatch.status)})
                </p>
              {/if}
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
              <th>Possible match</th>
              {#if data.isAdmin}<th>Actions</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each data.unmatchedBeans.beans as bean (bean.id)}
              <tr>
                <td><CoffeeName name={bean.name} /></td>
                <td>{bean.roaster ?? 'Unknown roaster'}</td>
                <td>{bean.origin ?? '—'}</td>
                <td>{bean.processing ?? '—'}</td>
                <td>{bean.roastDate ?? '—'}</td>
                <td>{bean.decaffeinated ? 'Yes' : 'No'}</td>
                <td>
                  {#if bean.likelyMatch}
                    <a href={`/coffees/${bean.likelyMatch.slug}`}><CoffeeName name={bean.likelyMatch.coffeeName} /></a><br />
                    <span class="text-muted">{bean.likelyMatch.roastDate ?? 'no date'} · {bean.likelyMatch.status}</span>
                  {:else}
                    —
                  {/if}
                </td>
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

  {#if bc.totalBrews > 0 || bc.totalBeans > 0}
    <h3>Stats &amp; breakdowns</h3>
    <div class="chart-panel-controls">
      <div class="form-field group-field">
        <span>Section</span>
        <div class="tab-group" role="group" aria-label="Section">
          <button aria-pressed={bcTab === 'overview'} onclick={() => (explicitBc = 'overview')}>Overview</button>
          <button aria-pressed={bcTab === 'favorites'} onclick={() => (explicitBc = 'favorites')}>Favorites</button>
          <button aria-pressed={bcTab === 'brewing'} onclick={() => (explicitBc = 'brewing')}>Brewing</button>
          <button aria-pressed={bcTab === 'economics'} onclick={() => (explicitBc = 'economics')}>Economics</button>
        </div>
      </div>
    </div>

    {#if bcTab === 'overview'}
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">{tenth(bc.totalBrews)}</span>
          <div class="stat-caption">
            <span class="stat-label">{@render pp('Total brews', 'brews')}</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value">{bc.totalBeans}</span>
          <div class="stat-caption">
            <span class="stat-label">Total beans</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value">{formatRating(bc.averageRating)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average rating</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value"
            >{bc.totalGramsBrewed === null
              ? '—'
              : formatGrams(bc.totalGramsBrewed)}</span
          >
          <div class="stat-caption">
            <span class="stat-label">{@render pp('Total brewed', 'brewed')}</span>
          </div>
        </div>
      </div>
      <section class="chart-panel">
        <div class="chart-panel-header">
          <h2>{@render pp('Brews per day', 'brews-day')}</h2>
          {@render bcAverageToggle()}
        </div>
        <div class="stat-row stat-row-compact">
          {#each bc.periodAverages as w (w.window)}
            {@const value = bcAverage === 'brew-day' ? w.brewsPerBrewDay : w.brewsPerDay}
            <div class="stat-item">
              <span class="stat-value">{value === null ? '—' : value.toFixed(1)}</span>
              <div class="stat-caption">
                <span class="stat-label">{bcWindowLabels[w.window]}</span>
              </div>
            </div>
          {/each}
        </div>
        {#if bcBrewsPerDay.length === 0}
          <p class="text-muted">No dated brews yet.</p>
        {:else}
          <Chart
            type="line"
            labels={bcBrewsPerDay.map((d) => d.date)}
            values={bcBrewsPerDay.map((d) => d.brews)}
            datasetLabel="Brews"
            trendValues={bcBrewsPerDay.map((d) => d.rollingAverage)}
            trendLabel="7-day average"
          />
        {/if}
      </section>
      <section class="chart-panel">
        <div class="chart-panel-header">
          <h2>{@render pp('Grams per day', 'grams-day')}</h2>
          {@render bcAverageToggle()}
        </div>
        <div class="stat-row stat-row-compact">
          {#each bc.periodAverages as w (w.window)}
            {@const value = bcAverage === 'brew-day' ? w.gramsPerBrewDay : w.gramsPerDay}
            <div class="stat-item">
              <span class="stat-value">{value === null ? '—' : formatGrams(value)}</span>
              <div class="stat-caption">
                <span class="stat-label">{bcWindowLabels[w.window]}</span>
              </div>
            </div>
          {/each}
        </div>
        {#if bcBrewsPerDay.length === 0}
          <p class="text-muted">No dated brews yet.</p>
        {:else}
          <Chart
            type="line"
            labels={bcBrewsPerDay.map((d) => d.date)}
            values={bcBrewsPerDay.map((d) => d.grams)}
            datasetLabel="Grams"
            trendValues={bcBrewsPerDay.map((d) => d.gramsRollingAverage)}
            trendLabel="7-day average"
            unit="g"
          />
        {/if}
      </section>
      <section class="chart-panel">
        <h2>Average rating over time</h2>
        <div class="stat-row stat-row-compact">
          {#each bc.periodAverages as w (w.window)}
            {@const value = w.rating}
            <div class="stat-item">
              <span class="stat-value">{formatRating(value)}</span>
              <div class="stat-caption">
                <span class="stat-label">{bcWindowLabels[w.window]}</span>
              </div>
            </div>
          {/each}
        </div>
        {#if bcRatingsDates.length === 0}
          <p class="text-muted">No rated brews yet.</p>
        {:else}
          <Chart type="line" labels={bcRatingsDates} values={bcRatingsValues} datasetLabel="Rating" />
        {/if}
      </section>
    {:else if bcTab === 'favorites'}
      <div class="chart-panel-controls">
        <div class="form-field group-field">
          <span>Group by</span>
          <div class="tab-group" role="group" aria-label="Group by">
            {#each Object.entries(bcFavoriteDimensionLabels) as [key, label] (key)}
              <button
                aria-pressed={bcFavoriteDimension === key}
                onclick={() => (explicitBcFav = key as BcFavoriteDimension)}>{label}</button
              >
            {/each}
          </div>
        </div>
      </div>
      {#if bcFavoriteGroups.length === 0}
        <p class="text-muted">No groups with 3+ rated brews yet.</p>
      {:else}
        {#if bcVisibleFavoriteGroups.length < bcFavoriteGroups.length}<p class="text-muted">Showing top {bcVisibleFavoriteGroups.length} of {bcFavoriteGroups.length}.</p>{/if}
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
          <span class="stat-value">{formatTemperature(bc.averageBrewTemperatureC)}</span>
          <div class="stat-caption">
            <span class="stat-label">Average brew temperature</span>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-value"
            >{bc.averageBeanAgeAtBrewDays === null
              ? '—'
              : formatDays(bc.averageBeanAgeAtBrewDays)}</span
          >
          <div class="stat-caption">
            <span class="stat-label">Average bean age at brew</span>
          </div>
        </div>
      </div>
      <div class="chart-panel-controls">
        <div class="form-field group-field">
          <span>Measure</span>
          <div class="tab-group" role="group" aria-label="Measure">
            <button aria-pressed={bcBrewingMetric === 'rating'} onclick={() => (explicitBcMetric = 'rating')}
              >Rating</button
            >
            <button aria-pressed={bcBrewingMetric === 'count'} onclick={() => (explicitBcMetric = 'count')}
              >Count</button
            >
          </div>
        </div>
      </div>
      <div class="chart-panel-row">
        <div>
          <h3>By Method</h3>
          {#if bcVisibleMethodGroups.length === 0}
            <p class="text-muted">No groups with 3+ rated brews yet.</p>
          {:else}
            {#if bcVisibleMethodGroups.length < bc.byMethod.length}<p class="text-muted">Showing top {bcVisibleMethodGroups.length} of {bc.byMethod.length}.</p>{/if}
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
            <p class="text-muted">No groups with 3+ rated brews yet.</p>
          {:else}
            {#if bcVisibleGrinderGroups.length < bc.byGrinder.length}<p class="text-muted">Showing top {bcVisibleGrinderGroups.length} of {bc.byGrinder.length}.</p>{/if}
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
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-value">{#if bc.averageCostPerGram !== null}<Usd n={bc.averageCostPerGram} />{:else}—{/if}</span>
          <div class="stat-caption">
            <span class="stat-label">Average cost per gram</span>
          </div>
        </div>
      </div>
      {#if bcVisibleCostByRoaster.length === 0}
        <p class="text-muted">No cost data yet.</p>
      {:else}
        {#if bcVisibleCostByRoaster.length < bc.costPerGramByRoaster.length}<p class="text-muted">
          Showing top {bcVisibleCostByRoaster.length} of {bc.costPerGramByRoaster.length}.
        </p>{/if}
        <Chart
          type="bar"
          labels={bcVisibleCostByRoaster.map((g) => g.label)}
          values={bcVisibleCostByRoaster.map((g) => g.averageCostPerGram)}
          format={(v) => `${usd(v, costWhole)}/g`}
          tipFormat={(v) => `${usdPrecise(v, costWhole) ?? usd(v, costWhole)}/g`}
          datasetLabel="Cost per gram"
          height={bcCostChartHeight}
        />
      {/if}
    {/if}
  {/if}

  {#if createModalBean}
    <div class="modal-backdrop">
      <div class="modal">
        <h2>Create coffee from <CoffeeName name={createModalBean.name} /></h2>
        <CoffeeForm
          prefill={prefillFor(createModalBean)}
          roastLevels={data.roastLevels}
          roasters={data.roasters}
          roasterImages={data.roasterImages}
          origins={data.origins}
          processingMethods={data.processingMethods}
          restHistory={data.restHistory}
          formError={form?.error ?? null}
          beanConquerorId={createModalBean.id}
          oncancel={() => (createModalBean = null)}
          onsuccess={closeCreateModal}
        />
      </div>
    </div>
  {/if}
</section>
{/if}

<style>
  /* A caption with a per-person help button lets the button's 44px tap area overflow (as on /insights). */
  .stat-caption:has(:global(.mode-tip-button)),
  .stat-label:has(:global(.mode-tip-button)) {
    overflow: visible;
  }
  .period-select {
    min-height: 2.25rem;
    padding: 0 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
  }
  @media (max-width: 640px) {
    .period-select {
      min-height: 44px;
      font-size: 16px;
    }
  }
</style>
