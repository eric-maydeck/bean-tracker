<script lang="ts">
  import { formatDate } from '#lib/formatDate.ts';
  import { showToast } from '#lib/toast.svelte.ts';
  import Icon from '#lib/components/Icon.svelte';
  import { bqImportHref, cloneHref, editHref } from '#lib/bqImportUrl.ts';
  import { labelTip } from '#lib/components/labelTip.ts';
  import { coffeeToast, commitChanges, restoreStates } from '#lib/coffeeToast.ts';
  import type { CoffeeRow } from '#lib/types.ts';
  import type { Game } from '#lib/pick/types.ts';
  import type { SharedLink } from '#lib/pick/shared.ts';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { urgencyColorStyle } from '#lib/urgencyColor.ts';
  import { coffeeImage } from '#lib/coffeeImage.ts';
  import CoffeeName from '#lib/components/CoffeeName.svelte';
  import { currentParams, pickOne } from '#lib/pageUrlState.ts';
  import { loadChoice, serializeChoice } from '#lib/rememberedChoice.ts';
  import { writeUrlParams, refreshTracked } from '#lib/urlState.ts';
  import { formatBag } from '#lib/grams.ts';
  import ShareButton from '#lib/components/ShareButton.svelte';
  import PreviewMeta from '#lib/components/PreviewMeta.svelte';
  import { onDeckPreview, pickPreview } from '#lib/linkPreview.ts';
  import PickForMe from './pick/PickForMe.svelte';
  import { onDeckParams, parseCoffees, parseDefaultRules, parseGame, parseOnDeckView, parseProfile, parseRoll, parseCoffeeParam, parseCrit, parseName, parseRulesCode, VIEWS, VIEW_LABEL, type OnDeckView } from './onDeckUrl';

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
  let explicitView = $state<'next' | 'pick' | undefined>(parseOnDeckView(currentParams(page.url)));
  // The Pick for me game: `wheel` or `d20` once chosen; none = today's last game, else the wheel.
  let explicitGame = $state<Game | undefined>(parseGame(currentParams(page.url)));
  // A shared link's rules: `profile=<name>` or `rules=default` (only while that is what is being played; Use my rules drops it).
  let explicitProfile = $state<string | undefined>(parseProfile(currentParams(page.url)));
  let explicitDefaults = $state(parseDefaultRules(currentParams(page.url)));
  let explicitCode = $state<string | undefined>(parseRulesCode(currentParams(page.url)));
  // Pick for me with the visitor's own list: `coffees=custom` in the URL, else the choice remembered 12h ('site' remembers an explicit switch back). A share link with rules shows the site's coffees.
  const COFFEES_KEY = 'bean-tracker-on-deck-coffees';
  const COFFEES_VALUES = ['custom', 'site'] as const;
  let coffeesChoice = $state<'custom' | 'site' | undefined>(parseCoffees(currentParams(page.url)));
  // A shared result to replay (view only, see PickForMe): `roll=<n>` and a crit's `c=<coffee id>`; dropped when the visitor leaves it.
  const parseLink = (p: URLSearchParams): SharedLink | undefined => { const l = { roll: parseRoll(p), c: parseCoffeeParam(p), name: parseName(p), crit: parseCrit(p) }; return l.roll || l.c || l.name ? l : undefined; };
  let explicitLink = $state<SharedLink | undefined>(parseLink(currentParams(page.url)));
  const leaveRoll = () => { explicitLink = undefined; };
  let enterList = $state(false); // the switch was just turned on: PickForMe opens the Enter coffees pop-up when no list is saved
  const custom = $derived(coffeesChoice === 'custom');
  function setCustom(on: boolean) {
    coffeesChoice = on ? 'custom' : 'site';
    enterList = on;
    leaveRoll();
    if (on) { explicitProfile = undefined; explicitCode = undefined; explicitDefaults = false; }
  }
  // What the Share button adds on the Pick view: the loaded profile, or the default rules (set by PickForMe once it is ready).
  let shareRules = $state<{ profile?: string; rulesCode?: string; defaultRules?: boolean }>();
  let view = $derived<OnDeckView>(explicitView ?? 'open');
  const sharePath = $derived(view === 'pick' && (shareRules || custom) ? `/on-deck?${onDeckParams({ show: explicit, view: 'pick', game: explicitGame, ...(custom ? {} : shareRules) })}` : undefined);
  // The link that replays a result: the page's share link plus the result (a custom list shares `coffees=custom`, its own list deciding the coffee).
  const resultPath = (game: Game, link: SharedLink) =>
    shareRules || custom ? `/on-deck?${onDeckParams({ show: explicit, view: 'pick', game, ...(custom ? { coffees: 'custom' } : shareRules), ...link })}` : undefined;
  let loaded = $state(false);
  let filter = $derived(explicit ?? 'all');
  let current = $derived(data[filter]);

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;
    const fromUrl = pickOne(currentParams(page.url), 'show', SHOW_VALUES);
    try {
      explicit = fromUrl ?? loadChoice(localStorage.getItem(STORAGE_KEY), SHOW_VALUES, Date.now());
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
      explicit = fromUrl;
    }
    // a shared result's coffee (`c`) is a site coffee: the visitor's remembered custom list never takes over that link
    const sharedLink = parseProfile(currentParams(page.url)) || parseRulesCode(currentParams(page.url)) || parseDefaultRules(currentParams(page.url)) || parseCoffeeParam(currentParams(page.url)) !== undefined;
    try {
      coffeesChoice = sharedLink ? undefined : (parseCoffees(currentParams(page.url)) ?? loadChoice(localStorage.getItem(COFFEES_KEY), COFFEES_VALUES, Date.now()));
    } catch {
      coffeesChoice = sharedLink ? undefined : parseCoffees(currentParams(page.url));
    }
    explicitView = parseOnDeckView(currentParams(page.url));
    explicitGame = parseGame(currentParams(page.url));
    explicitProfile = parseProfile(currentParams(page.url));
    explicitDefaults = parseDefaultRules(currentParams(page.url));
    explicitCode = parseRulesCode(currentParams(page.url));
    if (type !== 'enter') explicitLink = parseLink(currentParams(page.url)); // not on the first load: the view may already have dropped an unusable link
    loaded = true;
  });

  function setFilter(next: Show) {
    explicit = next;
  }

  $effect(() => {
    if (!loaded) return;
    writeUrlParams(onDeckParams({ show: explicit, view: explicitView, game: explicitGame, profile: explicitProfile, rulesCode: explicitCode, defaultRules: explicitDefaults, coffees: custom ? 'custom' : undefined, ...explicitLink }));
    try {
      if (explicit) localStorage.setItem(STORAGE_KEY, serializeChoice(explicit, Date.now()));
      if (coffeesChoice) localStorage.setItem(COFFEES_KEY, serializeChoice(coffeesChoice, Date.now()));
    } catch {
      // ignore — the choice still works for this visit, it just isn't remembered
    }
  });

  async function refresh() {
    await refreshTracked();
  }

  // A tile's Open: toasts with Undo and the tile moves to Currently open.
  async function tileAction(coffee: CoffeeRow, statusAction: string) {
    const changes = [{ id: coffee.id, statusAction }];
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
</script>

<svelte:head>
  <title>Bean Tracker - On Deck</title>
</svelte:head>
<PreviewMeta preview={view === 'pick' ? pickPreview() : onDeckPreview(view === 'next' ? 'next' : 'open', filter, view === 'next' ? current.nextUp : current.open)} />

<div class="toolbar">
  <h1>On Deck</h1>
  <ShareButton path={sharePath} />
</div>

<div class="search-row controls">
  <div class="form-field group-field">
    <span>View</span>
    <div class="tab-group" role="group" aria-label="View">
      {#each VIEWS as v (v)}<button type="button" aria-pressed={view === v} onclick={() => (explicitView = v === 'open' ? undefined : v)}>{VIEW_LABEL[v]}</button>{/each}
    </div>
  </div>
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

{#snippet tileActions(coffee: CoffeeRow)}
  <!-- The same icon buttons, order and 2×2 places as /coffees' non-edit rows (Brew now / Open, Import, Edit, Clone). -->
  <div class="card-actions icons">
    {#if coffee.status === 'open'}
      <a class="button button-secondary button-icon" href={`/coffees/${coffee.slug}/brew`} use:labelTip={'Brew now'} aria-label="Brew now"><Icon name="coffee" /></a>
    {:else if page.data.isAdmin}
      <button class="button button-icon" type="button" onclick={() => tileAction(coffee, 'open')} use:labelTip={'Open'} aria-label="Open"><Icon name="open" /></button>
    {/if}
    <a class="button button-secondary button-icon" href={bqImportHref(coffee.slug)} use:labelTip={'Import into Bean Conqueror'} aria-label="Import into Bean Conqueror"><Icon name="share-network" /></a>
    {#if page.data.isAdmin}
      <a class="button button-secondary button-icon" href={editHref(coffee.slug)} use:labelTip={'Edit'} aria-label="Edit"><Icon name="edit" /></a>
      <a class="button button-secondary button-icon" href={cloneHref(coffee.slug)} use:labelTip={'Clone'} aria-label="Clone"><Icon name="clone" /></a>
    {/if}
  </div>
{/snippet}

{#if view === 'open'}
  <section class="detail-section">
    <h2>Currently open</h2>
    {#if current.open.length === 0}
      <p class="text-muted">Nothing open right now.</p>
    {:else}
      <section class="grid">
        {#each current.open as coffee (coffee.id)}
          {@const img = coffeeImage(coffee, '')}
          <div class="card-wrap">
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
                Roasted {formatDate(coffee.roast_date)}
                {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
              </p>
            {/if}
            {#if coffee.drink_before}
              <p class="text-muted">Drink before {formatDate(coffee.drink_before)}</p>
            {/if}
          </a>
          {@render tileActions(coffee)}
          </div>
        {/each}
      </section>
    {/if}
  </section>
{:else if view === 'next'}
  <section class="detail-section">
    <h2>Next up</h2>
    {#if current.nextUp.length === 0}
      <p class="text-muted">Backlog is empty.</p>
    {:else}
      <section class="grid">
        {#each current.nextUp as coffee (coffee.id)}
          {@const img = coffeeImage(coffee, '')}
          <div class="card-wrap">
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
                Roasted {formatDate(coffee.roast_date)}
                {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
              </p>
            {/if}
          </a>
          {@render tileActions(coffee)}
          </div>
        {/each}
      </section>
    {/if}
  </section>
{:else}
  <section class="detail-section">
    <h2>Pick for me</h2>
    {#key custom}
    <PickForMe pick={data.pick} admin={page.data.isAdmin} {custom} oncustom={setCustom} enter={enterList} shared={!custom && (explicitProfile || explicitCode || explicitDefaults) ? data.pick.shared : null} onunshare={() => { explicitProfile = undefined; explicitCode = undefined; explicitDefaults = false; }} bind:shareRules link={explicitLink} onleaveroll={leaveRoll} pathFor={resultPath} game={explicitGame} ongame={(g) => (explicitGame = g)} />
    {/key}
  </section>
{/if}

<style>
  /* room between the View and Show groups */
  .controls { column-gap: var(--space-5); }
</style>
