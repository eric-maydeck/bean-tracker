<script lang="ts">
  import { page } from '$app/state';
  import { absoluteImage, encodeCard, previewCard, type Preview } from '#lib/linkPreview.ts';

  let { preview }: { preview: Preview } = $props();
  // A page without a usable image (none, or a data: URI) gets a card with its own text (src/routes/preview.png;
  // hooks.server.ts signs the URL in the SSR HTML).
  let own = $derived(preview.image && absoluteImage(preview.image.src, page.url.origin));
  let image = $derived(own ? { src: own, alt: preview.image?.alt ?? '' }
    : { src: `${page.url.origin}/preview.png?c=${encodeCard(previewCard(preview))}`, alt: preview.title });
</script>

<svelte:head>
  <meta name="description" content={preview.description} />
  <meta property="og:title" content={preview.title} />
  <meta property="og:description" content={preview.description} />
  <meta property="og:url" content={page.url.origin + page.url.pathname + page.url.search} />
  {#if image}
    <meta property="og:image" content={image.src} />
    <meta property="og:image:alt" content={image.alt} />
  {/if}
  <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
</svelte:head>
