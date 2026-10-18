<script lang="ts">
  import { invalidateAll, afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { urgencyColorStyle } from '$lib/urgencyColor';
  import { coffeeImage } from '$lib/coffeeImage';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { currentParams, pickOne } from '$lib/pageUrlState';
  import { loadChoice, serializeChoice } from '$lib/rememberedChoice';
  import { writeUrlParams } from '$lib/urlState';
  import { formatBag } from '$lib/grams';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { onDeckParams, parseOnDeckView, VIEWS, VIEW_LABEL, type OnDeckView } from './onDeckUrl';

  let { data } = $props();

  type Show = 'all' | 'caffeinated' | 'decaf';
  // 'all' is allowed here (unlike a plain default) because clicking "All"
  // after another choice is itself an explicit choice -- it must write
  // `show=all`, not just leave the param off.
  const SHOW_VALUES = ['all', 'caffeinated', 'decaf'] as const satisfies readonly Show[];
  const STORAGE_KEY = 'bean-tracker-on-deck-show';

  // Untouched = undefined -> effective 'all'. Writing/remembering waits for
  // `loaded` so a bare URL can't stomp the remembered choice with 'all'
  // before afterNavigate has had a chance to restore it.
  let explicit = $state<Show | undefined>(pickOne(currentParams(page.url), 'show', SHOW_VALUES));
  // The Currently open / Next up view: URL only (never remembered), and only `next` is explicit.
  let explicitView = $state<'next' | undefined>(parseOnDeckView(currentParams(page.url)));
  let view = $derived<OnDeckView>(explicitView ?? 'open');
  let loaded = $state(false);
  let filter = $derived(explicit ?? 'all');
  let current = $derived(data[filter]);

  afterNavigate(() => {
    const fromUrl = pickOne(currentParams(page.url), 'show', SHOW_VALUES);
    try {
      explicit = fromUrl ?? loadChoice(localStorage.getItem(STORAGE_KEY), SHOW_VALUES, Date.now());
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
      explicit = fromUrl;
    }
    explicitView = parseOnDeckView(currentParams(page.url));
    loaded = true;
  });

  function setFilter(next: Show) {
    explicit = next;
  }

  $effect(() => {
    if (!loaded) return;
    writeUrlParams(onDeckParams({ show: explicit, view: explicitView }));
    try {
      if (explicit) localStorage.setItem(STORAGE_KEY, serializeChoice(explicit, Date.now()));
    } catch {
      // ignore — the choice still works for this visit, it just isn't remembered
    }
  });

  async function refresh() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Bean Tracker - On Deck</title>
</svelte:head>

<div class="toolbar">
  <h1>On Deck</h1>
  <ShareButton />
</div>

<div class="search-row">
  <label class="form-field group-field">
    <span>View</span>
    <select class="ctl-select" aria-label="View" value={view} onchange={(e) => (explicitView = e.currentTarget.value === 'next' ? 'next' : undefined)}>
      {#each VIEWS as v (v)}<option value={v}>{VIEW_LABEL[v]}</option>{/each}
    </select>
  </label>
  <div class="form-field group-field">
    <span>Show</span>
    <div class="tab-group" role="group" aria-label="Show">
      <button aria-pressed={filter === 'all'} onclick={() => setFilter('all')}>All</button>
      <button aria-pressed={filter === 'caffeinated'} onclick={() => setFilter('caffeinated')}>
        Caffeinated
      </button>
      <button aria-pressed={filter === 'decaf'} onclick={() => setFilter('decaf')}>Decaf</button>
    </div>
  </div>
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
</div>

{#if view === 'open'}
  <section>
    <h2>Currently open</h2>
    {#if current.open.length === 0}
      <p class="text-muted">Nothing open right now.</p>
    {:else}
      <section class="grid">
        {#each current.open as coffee (coffee.id)}
          {@const img = coffeeImage(coffee, '')}
          <a class="card" href={`/coffees/${coffee.slug}`}>
            {#if img}
              <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
            {/if}
            <h2><CoffeeName name={coffee.coffee_name} /></h2>

            <p class="text-muted">{coffee.roaster}</p>
            {#if coffee.amount_g != null && coffee.grams_left != null}
              <p class="text-muted">{formatBag(coffee.amount_g, coffee.grams_left)}</p>
            {/if}
            <p class="text-muted">
              Urgency: <span style={urgencyColorStyle(coffee.urgency_rating)}
                >{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</span
              >
            </p>
            {#if coffee.processing}
              <p class="text-muted">{coffee.processing}</p>
            {/if}
            {#if coffee.roast_date}
              <p class="text-muted">
                Roasted {coffee.roast_date}
                {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
              </p>
            {/if}
            {#if coffee.drink_before}
              <p class="text-muted">Drink before {coffee.drink_before}</p>
            {/if}
          </a>
        {/each}
      </section>
    {/if}
  </section>
{:else}
  <section class="detail-section">
    <h2>Next up</h2>
    {#if current.nextUp.length === 0}
      <p class="text-muted">Backlog is empty.</p>
    {:else}
      <section class="grid">
        {#each current.nextUp as coffee (coffee.id)}
          {@const img = coffeeImage(coffee, '')}
          <a class="card" href={`/coffees/${coffee.slug}`}>
            {#if img}
              <img src={img.src} alt={img.alt} class="card-thumb" style:background-color={img.fill} />
            {/if}
            <h2><CoffeeName name={coffee.coffee_name} /></h2>

            <p class="text-muted">{coffee.roaster}</p>
            <p class="text-muted">
              Urgency: <span style={urgencyColorStyle(coffee.urgency_rating)}
                >{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</span
              >
            </p>
            {#if coffee.processing}
              <p class="text-muted">{coffee.processing}</p>
            {/if}
            {#if coffee.roast_date}
              <p class="text-muted">
                Roasted {coffee.roast_date}
                {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
              </p>
            {/if}
          </a>
        {/each}
      </section>
    {/if}
  </section>
{/if}
