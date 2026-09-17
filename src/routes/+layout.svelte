<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<nav class="site-nav">
  <a href="/">Coffee Collection</a>
</nav>

<main class="container">
  {@render children()}
</main>
