<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { AlertRow } from '$lib/types';
  let { children, data } = $props();

  function formatUpdated(iso: string | null): string {
    if (!iso) return 'no data yet';
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  }

  const links = [
    { href: '/', label: 'Coffees' },
    { href: '/on-deck', label: 'On Deck' },
    { href: '/subscriptions', label: 'Subscriptions' },
    { href: '/stats', label: 'Stats' }
  ];

  let theme = $state<'light' | 'dark'>('light');

  let showMore = $state(false);

  let showAlerts = $state(false);

  const unreadAlertCount = $derived(data.alerts.filter((a: AlertRow) => a.read_at === null).length);

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

  const tabIcons: Record<string, string> = {
    '/': '☕',
    '/on-deck': '📋',
    '/subscriptions': '🔁',
    '/stats': '📊'
  };

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
      <a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
        {link.label}
      </a>
    {/each}
    {#if data.isAdmin}
      <form method="POST" action="/login?/logout" use:enhance>
        <button class="nav-link-button" type="submit">Log out</button>
      </form>
    {:else}
      <a href="/login" aria-current={page.url.pathname === '/login' ? 'page' : undefined}>Sign in</a>
    {/if}
  </div>
  <button
    class="icon-button"
    onclick={toggleTheme}
    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    {theme === 'light' ? '🌙' : '☀️'}
  </button>
  {#if data.isAdmin}
    <button
      class="icon-button"
      type="button"
      onclick={() => (showAlerts = true)}
      aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ''}`}
    >
      🔔{#if unreadAlertCount > 0}<span class="alert-badge">{unreadAlertCount}</span>{/if}
    </button>
  {/if}
</nav>

<nav class="bottom-tabs">
  {#each links as link (link.href)}
    <a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
      <span class="bottom-tabs-icon" aria-hidden="true">{tabIcons[link.href]}</span>
      {link.label}
    </a>
  {/each}
  <button
    class="bottom-tabs-more"
    type="button"
    aria-expanded={showMore}
    onclick={() => (showMore = !showMore)}
  >
    <span class="bottom-tabs-icon" aria-hidden="true">⋯</span>
    More
  </button>
</nav>

{#if showMore}
  <div class="bottom-tabs-more-panel">
    {#if data.isAdmin}
      <form method="POST" action="/login?/logout" use:enhance>
        <button class="nav-link-button" type="submit">Log out</button>
      </form>
    {:else}
      <a href="/login">Sign in</a>
    {/if}
    {#if data.isAdmin}
      <button class="nav-link-button" type="button" onclick={() => (showAlerts = true)}>
        🔔 Alerts{#if unreadAlertCount > 0} ({unreadAlertCount}){/if}
      </button>
    {/if}
    <button class="nav-link-button" type="button" onclick={toggleTheme}>
      {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
    </button>
  </div>
{/if}

<main class="container">
  {@render children()}
  <footer class="site-footer">
    v{data.version} · Last updated: {formatUpdated(data.lastUpdated)} · Last deployed: {formatUpdated(
      data.lastDeployed
    )}
  </footer>
</main>

<svelte:window
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
