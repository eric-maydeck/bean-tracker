<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { AlertRow } from '$lib/types';
  import AiNote from '$lib/components/AiNote.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { formatUpdated } from '$lib/formatDate';
  import { onMount } from 'svelte';
  import { captionItems } from '$lib/capItems';
  import { tipOver, tipOut, tipClick } from '$lib/components/modeTip';
  import { scrollBehavior } from '$lib/scrollToBottom';
  let { children, data } = $props();
  // Root layout mounts last, so this marks the whole page as hydrated (tests/ui/ready.ts).
  onMount(() => { document.documentElement.dataset.hydrated = ''; return captionItems(); });

  const links = [
    { href: '/coffees', label: 'Coffees' },
    { href: '/on-deck', label: 'On Deck' },
    { href: '/subscriptions', label: 'Subscriptions' },
    { href: '/stats', label: 'Stats' },
    { href: '/insights', label: 'Insights' },
    { href: '/recipes', label: 'Recipes' },
    { href: '/water', label: 'Water' }
  ];
  // The bottom bar is full at phone width; Insights (alpha), Recipes and Water live in More there.
  const tabLinks = links.filter((l) => l.href !== '/insights' && l.href !== '/recipes' && l.href !== '/water');

  let theme = $state<'light' | 'dark'>('light');

  let showMore = $state(false);

  // Back to top: after one screenful of scrolling, on every page that scrolls that far.
  let scrollY = $state(0);
  let innerHeight = $state(0);
  // Back to top steps aside while it would cover a map's zoom buttons.
  let topBtn: HTMLButtonElement | undefined = $state();
  let covers = $state(false);
  $effect(() => {
    void [scrollY, innerHeight]; // re-measure on scroll and resize
    const b = topBtn?.getBoundingClientRect();
    covers = !!b && [...document.querySelectorAll('.map-zoom')].some((z) => {
      const r = z.getBoundingClientRect();
      return b.left < r.right && r.left < b.right && b.top < r.bottom && r.top < b.bottom;
    });
  });

  let showAlerts = $state(false);

  const unreadAlertCount = $derived(data.alerts.filter((a: AlertRow) => a.read_at === null).length);
  // /recipes/<slug> is the Recipes page too.
  const current = (href: string) => page.url.pathname === href || (href === '/recipes' && page.url.pathname.startsWith('/recipes/'));
  const onAccount = $derived(page.url.pathname === '/account' || page.url.pathname.startsWith('/account/'));

  async function markAlertReadClick(id: number) {
    await fetch('/api/alerts/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await invalidateAll();
  }

  async function dismissAlertClick(id: number) {
    await fetch('/api/alerts/dismiss', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await invalidateAll();
  }

  // Regular outline icons; the current tab shows the `-fill` variant.
  const tabIcons: Record<string, 'coffee' | 'list-checks' | 'arrows-clockwise' | 'chart-bar'> = {
    '/coffees': 'coffee',
    '/on-deck': 'list-checks',
    '/subscriptions': 'arrows-clockwise',
    '/stats': 'chart-bar'
  };
  const tabIcon = (href: string, current: boolean): IconName =>
    current ? `${tabIcons[href]}-fill` : tabIcons[href];

  $effect(() => {
    if (!browser) return;
    try {
      const saved = localStorage.getItem('bean-tracker-theme');
      if (saved === 'light' || saved === 'dark') {
        theme = saved;
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
      }
    } catch {
      // ignore — localStorage may be unavailable (private browsing, etc.)
    }
  });

  $effect(() => {
    if (!browser) return;
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    page.url.pathname;
    showMore = false;
  });

  // Sign in comes back to this page. Read from location at click time, since
  // page.url goes stale after replaceState (HANDOFF gotcha).
  function signInHere(event: MouseEvent & { currentTarget: HTMLAnchorElement }) {
    if (location.pathname === '/login') return;
    event.currentTarget.href = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('bean-tracker-theme', theme);
    } catch {
      // ignore — per-viewer convenience only
    }
  }
</script>

<nav class="site-nav">
  <div class="nav-links">
    {#each links as link (link.href)}
      <a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>
        {link.label}
      </a>
    {/each}
    {#if data.isAdmin}
      <a href="/account" aria-current={onAccount ? 'page' : undefined}>Account</a>
      <form method="POST" action="/login?/logout" use:enhance>
        <button class="nav-link-button" type="submit">Sign out</button>
      </form>
    {:else}
      <a href="/login" onclick={signInHere} aria-current={page.url.pathname === '/login' ? 'page' : undefined}>Sign in</a>
    {/if}
  </div>
  <button
    class="icon-button"
    onclick={toggleTheme}
    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    <Icon name={theme === 'light' ? 'moon' : 'sun'} />
  </button>
  {#if data.isAdmin}
    <button
      class="icon-button"
      type="button"
      onclick={() => (showAlerts = true)}
      aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ''}`}
    >
      <Icon name="bell" />{#if unreadAlertCount > 0}<span class="alert-badge">{unreadAlertCount}</span>{/if}
    </button>
  {/if}
</nav>

<nav class="bottom-tabs">
  {#each tabLinks as link (link.href)}
    <a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
      <span class="bottom-tabs-icon" aria-hidden="true"><Icon name={tabIcon(link.href, page.url.pathname === link.href)} /></span>
      {link.label}
    </a>
  {/each}
  <button
    class="bottom-tabs-more"
    type="button"
    aria-expanded={showMore}
    onclick={() => (showMore = !showMore)}
  >
    <span class="bottom-tabs-icon" aria-hidden="true"><Icon name={showMore ? 'dots-three-fill' : 'dots-three'} /></span>
    More
  </button>
</nav>

{#if showMore}
  <div class="bottom-tabs-more-panel">
    <a class="nav-link-button" href="/insights" aria-current={page.url.pathname === '/insights' ? 'page' : undefined}
      ><Icon name="chart-line" /> Insights</a
    >
    <a class="nav-link-button" href="/recipes" aria-current={current('/recipes') ? 'page' : undefined}
      ><Icon name="list-checks" /> Recipes</a
    >
    <a class="nav-link-button" href="/water" aria-current={page.url.pathname === '/water' ? 'page' : undefined}
      ><Icon name="drop" /> Water</a
    >
    {#if data.isAdmin}
      <a class="nav-link-button" href="/account" aria-current={onAccount ? 'page' : undefined}
        ><Icon name={onAccount ? 'user-circle-fill' : 'user-circle'} /> Account</a
      >
      <form method="POST" action="/login?/logout" use:enhance>
        <button class="nav-link-button" type="submit"><Icon name="sign-out" /> Sign out</button>
      </form>
    {:else}
      <a class="nav-link-button" href="/login" onclick={signInHere}><Icon name="sign-in" /> Sign in</a>
    {/if}
    {#if data.isAdmin}
      <button class="nav-link-button" type="button" onclick={() => (showAlerts = true)}>
        <Icon name="bell" /> Alerts{#if unreadAlertCount > 0} ({unreadAlertCount}){/if}
      </button>
    {/if}
    <button class="nav-link-button" type="button" onclick={toggleTheme}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} /> {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  </div>
{/if}

<main class="container">
  {@render children()}
  <Toast />
  <footer class="site-footer">
    <AiNote email={data.contactEmail} />
    <div>
      <span class="fi">v{data.version}<span class="d">&nbsp;·</span></span>
      <span class="fi">Last updated: {formatUpdated(data.lastUpdated)}<span class="d">&nbsp;·</span></span>
      <span class="fi">Last deployed: {formatUpdated(data.lastDeployed)}</span>
    </div>
  </footer>
</main>

{#if scrollY > innerHeight}
  <button class="back-to-top" style:visibility={covers ? 'hidden' : null} bind:this={topBtn} data-layout-ignore="fixed overlay that floats over page content on purpose (peer review B, M4)" type="button" aria-label="Back to top" onclick={() => scrollTo({ top: 0, behavior: scrollBehavior() })}>
    <Icon name="arrow-up" />
  </button>
{/if}

<!-- Help popovers open on mouse hover too, on every page (modeTip.ts). -->
<svelte:document onpointerover={tipOver} onpointerout={tipOut} onclickcapture={tipClick} />

<svelte:window
  bind:scrollY
  bind:innerHeight
  onkeydown={(e) => {
    if (showAlerts && e.key === 'Escape') showAlerts = false;
  }}
/>

{#if showAlerts}
  <div class="modal-backdrop" onclick={() => (showAlerts = false)} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2>Alerts</h2>
      {#if data.alerts.length === 0}
        <p class="text-muted">No active alerts.</p>
      {:else}
        <ul class="alert-list">
          {#each data.alerts as alert (alert.id)}
            <li class="alert-list-item" class:alert-unread={alert.read_at === null}>
              <p class="alert-message">{alert.message}</p>
              <p class="alert-meta">{alert.source} · {formatUpdated(alert.created_at)}</p>
              <div class="alert-actions">
                {#if alert.read_at === null}
                  <button class="button button-secondary" type="button" onclick={() => markAlertReadClick(alert.id)}
                    >Mark as read</button
                  >
                {/if}
                <button class="button button-secondary" type="button" onclick={() => dismissAlertClick(alert.id)}
                  >Dismiss</button
                >
              </div>
            </li>
          {/each}
        </ul>
      {/if}
      <button class="button" type="button" onclick={() => (showAlerts = false)}>Close</button>
    </div>
  </div>
{/if}
