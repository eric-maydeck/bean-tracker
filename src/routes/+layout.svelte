<script lang="ts">
  import '../app.css';
  import { page, updated } from '$app/state';
  import { browser } from '$app/env';
  import { refreshTracked } from '#lib/urlState.ts';
  import type { AlertRow } from '#lib/types.ts';
  import AiNote from '#lib/components/AiNote.svelte';
  import RecapBanner from '#lib/components/RecapBanner.svelte';
  import NavProgress from '#lib/components/NavProgress.svelte';
  import Toast from '#lib/components/Toast.svelte';
  import { showToast } from '#lib/toast.svelte.ts';
  import Icon from '#lib/components/Icon.svelte';
  import SiteNav from '#lib/components/SiteNav.svelte';
  import Stamp from '#lib/components/Stamp.svelte';
  import { setBrewingZone } from '#lib/localDate.ts';
  import { onMount, untrack } from 'svelte';
  import { captionItems } from '#lib/capItems.ts';
  import { tipOver, tipOut, tipClick } from '#lib/components/modeTip.ts';
  import { scrollBehavior } from '#lib/scrollToBottom.ts';
  let { children, data } = $props();
  // The brewing zone, applied before anything renders so the client's local dates match the server's.
  setBrewingZone(data.brewingZone);
  $effect.pre(() => setBrewingZone(data.brewingZone));
  // Root layout mounts last, so this marks the whole page as hydrated (tests/ui/ready.ts).
  onMount(() => {
    // Remember the browser's zone so the next server render already shows it (no flash from UTC); also for a fixed
    // display zone, so signing out later starts from the right zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!document.cookie.split('; ').includes(`tz=${tz}`)) document.cookie = `tz=${tz}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.dataset.hydrated = ''; return captionItems(); });

  // A deploy while this tab is open (Kit polls _app/version.json, see version.pollInterval): offer a reload.
  $effect(() => {
    if (updated.current) untrack(() => showToast('A new version is available.', { reload: true })); // push reads toasts
  });

  let theme = $state<'light' | 'dark'>('light');

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
  // The recap story is full-screen: no site header, tab bar or footer.
  const recapPage = $derived(page.route.id === '/recaps/[year]' && !page.error); // a 404 keeps the site chrome

  async function markAlertReadClick(id: number) {
    await fetch('/api/alerts/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await refreshTracked();
  }

  async function dismissAlertClick(id: number) {
    await fetch('/api/alerts/dismiss', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await refreshTracked();
  }

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

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('bean-tracker-theme', theme);
    } catch {
      // ignore — per-viewer convenience only
    }
  }
</script>

<NavProgress />
<div class="site-shell">
{#if !recapPage}
  <SiteNav isAdmin={data.isAdmin} unread={unreadAlertCount} {theme} navPref={data.nav} recapsTab={data.recapsTab} onTheme={toggleTheme} onAlerts={() => (showAlerts = true)} />
{/if}
<div class="site-content">
{#if data.recapReady && !recapPage}<RecapBanner year={data.recapReady} tone={data.recapTone!} />{/if}
<main class={recapPage ? undefined : 'container'}>
  {@render children()}
  <Toast />
  {#if !recapPage}
  <footer class="site-footer">
    <div><span class="fi">Coffee data from <a href="https://www.loffeelabs.com" target="_blank" rel="noopener noreferrer">Loffee Labs Bean Base</a><span class="d" aria-hidden="true">&nbsp;·</span></span> <span class="fi">Brews logged with <a href="https://beanconqueror.com" target="_blank" rel="noopener noreferrer">Beanconqueror</a></span></div>
    <AiNote email={data.site.contactEmail} />
    <div>
      <span class="fi">v{data.version}<span class="d" aria-hidden="true">&nbsp;·</span></span>
      <span class="fi">Last updated: <Stamp iso={data.lastUpdated} empty="no data yet" minute /><span class="d" aria-hidden="true">&nbsp;·</span></span>
      <span class="fi">Last deployed: <Stamp iso={data.lastDeployed} empty="no data yet" minute /></span>
    </div>
  </footer>
  {/if}
</main>
</div>
</div>

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
              <p class="alert-message">{#if alert.href}<a href={alert.href} onclick={() => (showAlerts = false)}>{alert.message}</a>{:else}{alert.message}{/if}</p>
              <p class="alert-meta">{#if alert.source !== 'recap'}{alert.source} · {/if}<Stamp iso={alert.created_at} minute /></p>
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
