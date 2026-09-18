<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  let { children } = $props();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/manage', label: 'Dashboard' },
    { href: '/manage/archive', label: 'Archive' },
    { href: '/manage/subscriptions', label: 'Subscriptions' },
    { href: '/manage/coffees/new', label: 'Add coffee' }
  ];

  let theme = $state<'light' | 'dark'>('light');

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

<nav class="site-nav">
  <div class="nav-links">
    {#each links as link (link.href)}
      <a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
        {link.label}
      </a>
    {/each}
  </div>
  <button
    class="icon-button"
    onclick={toggleTheme}
    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    {theme === 'light' ? '🌙' : '☀️'}
  </button>
</nav>

<main class="container">
  {@render children()}
</main>
