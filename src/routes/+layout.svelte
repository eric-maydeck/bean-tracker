<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  let { children } = $props();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/manage', label: 'Dashboard' },
    { href: '/manage/archive', label: 'Archive' },
    { href: '/manage/subscriptions', label: 'Subscriptions' },
    { href: '/manage/coffees/new', label: 'Add coffee' }
  ];
</script>

<nav class="site-nav">
  {#each links as link (link.href)}
    <a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
  {/each}
</nav>

<main class="container">
  {@render children()}
</main>
