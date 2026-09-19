<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  let { children, data } = $props();

  function formatUpdated(iso: string | null): string {
    if (!iso) return 'no data yet';
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  }

  const links = [
    { href: '/', label: 'Coffees' },
    { href: '/on-deck', label: 'On Deck' },
    { href: '/subscriptions', label: 'Subscriptions' }
  ];

  let theme = $state<'light' | 'dark'>('light');

  let showMore = $state(false);

  const tabIcons: Record<string, string> = {
    '/': '☕',
    '/on-deck': '📋',
    '/subscriptions': '🔁'
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
