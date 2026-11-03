<script lang="ts">
  import type { Slide as SlideT } from '$lib/server/recaps/types';
  import type { People } from '$lib/insightsUrl';
  import { POSTER_ID, recapHref } from '$lib/recapsUrl';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import Slide from './Slide.svelte';

  // Last reel slide: every fact as a tile. Scrolls natively inside the reel.
  let { slides, poster, year, people, preview, total }: {
    slides: SlideT[]; poster: { title: string; sub: string; footer: string }; year: number; people?: People; preview: boolean; total: number;
  } = $props();
</script>

<section class="poster" id={POSTER_ID} aria-label="{total} of {total}">
  <div class="page">
    <header>
      <h2>{poster.title}</h2>
      <p>{poster.sub}</p>
      <ShareButton path={recapHref(year, { slide: POSTER_ID, people, ...(preview && { preview: true as const }) })} />
    </header>
    <div class="recap-grid">
      {#each slides as s, i (s.id)}
        <Slide tile slide={s} {year} {people} {preview} index={i} {total} />
      {/each}
    </div>
    <footer>{poster.footer}</footer>
  </div>
</section>

<style>
  .poster { min-height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; container-type: inline-size; }
  .page { max-width: 1240px; margin: 0 auto; padding: 84px 16px 48px; }
  header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px 24px; margin-bottom: 20px; }
  h2 { font-family: var(--font-display); font-size: clamp(2.6rem, min(9vw, 16vh), 5.5rem); line-height: 0.9; letter-spacing: -0.035em; margin: 0; }
  header p { margin: 0; color: var(--color-text-muted); max-width: 36ch; }
  header :global(.share-button) { min-height: 44px; padding: 0 14px; border: 1.5px solid currentColor; border-radius: 22px; background: transparent; color: inherit; font: 600 0.9rem var(--font-sans); }
  footer { margin-top: 20px; color: var(--color-text-muted); font-size: 0.9rem; }
  /* Container queries on the poster: 1 column, 2 from 620px, 3 from 900px. The last tile closes its row. */
  .recap-grid { display: grid; gap: 10px; grid-template-columns: 1fr; grid-auto-flow: dense; }
  .recap-grid > :global(:last-child) { grid-column-end: -1; }
  @container (min-width: 620px) { header { flex-wrap: nowrap; } header p { flex: 1; } }
  @container (min-width: 620px) { .recap-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container (min-width: 900px) { .recap-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
