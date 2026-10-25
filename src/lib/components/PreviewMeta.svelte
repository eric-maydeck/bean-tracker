<script lang="ts">
  import { page } from '$app/state';
  import { absoluteImage, type Preview } from '$lib/linkPreview';

  let { preview }: { preview: Preview } = $props();
  let image = $derived(preview.image ? absoluteImage(preview.image.src, page.url.origin) : null);
</script>

<svelte:head>
  <meta name="description" content={preview.description} />
  <meta property="og:title" content={preview.title} />
  <meta property="og:description" content={preview.description} />
  <meta property="og:url" content={page.url.origin + page.url.pathname + page.url.search} />
  {#if image}
    <meta property="og:image" content={image} />
    <meta property="og:image:alt" content={preview.image?.alt ?? ''} />
  {/if}
  <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
</svelte:head>
