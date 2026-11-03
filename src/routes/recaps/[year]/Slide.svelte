<script lang="ts">
  import type { Slide, Tone } from '$lib/server/recaps/types';
  import type { People } from '$lib/insightsUrl';
  import { recapHref } from '$lib/recapsUrl';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import RecapViz from './RecapViz.svelte';

  // One fact: a full-screen story slide (`section`), or a tile on the poster (`tile`).
  let { slide, year, people, preview, index, total, tile = false }: {
    slide: Slide; year: number; people?: People; preview: boolean; index: number; total: number; tile?: boolean;
  } = $props();

  // Dark ink on the light tones, the site's text color on cream; cream text everywhere else.
  const INK: Partial<Record<Tone, string>> = { sun: '#2b211b', amber: '#2b211b', cream: 'var(--color-text)' };
  const tone = $derived(slide.tone ?? 'ink');
</script>

{#snippet body()}
  <p class="lead"><CoffeeName text={slide.lead} /></p>
  <p class="big" class:long={slide.big.length > 7}><CoffeeName text={slide.big} />{#if slide.unit} <span class="unit">{slide.unit}</span>{/if}</p>
  <p class="context"><CoffeeName text={slide.context} /></p>
  {#if slide.viz}<div class="vizwrap"><RecapViz viz={slide.viz} /></div>{/if}
  {#if slide.traits}
    <ul class="traits">{#each slide.traits as t (t.label)}<li><b>{t.value}</b> {t.label}</li>{/each}</ul>
  {/if}
  <a class="more" href={slide.link.href} aria-label="See more in {slide.link.section}">{slide.link.section} <span aria-hidden="true">→</span></a>
{/snippet}

{#if tile}
  <article class="tone tile" class:wide={slide.wide} data-id={slide.id} data-tone={tone} style:--bg="var(--t-{tone})" style:--fg={INK[tone]}>{@render body()}</article>
{:else}
  <section class="tone slide" id={slide.id} data-id={slide.id} data-tone={tone} aria-label="{index + 1} of {total}" style:--bg="var(--t-{tone})" style:--fg={INK[tone]}>
    {#if index === 0}<a class="home" href="/">Bean Tracker</a>{/if}
    <div class="share"><ShareButton path={recapHref(year, { slide: slide.id, people, ...(preview && { preview: true as const }) })} /></div>
    <div class="inner">{@render body()}</div>
    {#if index === 0}<p class="hint">Swipe or tap to continue</p>{/if}
  </section>
{/if}

<style>
  .tone { --fg: #faf7f2; background: var(--bg); color: var(--fg); position: relative; overflow: hidden; }
  /* Coffee-name keyword colors and signed deltas are unreadable on a tone: the slide's own text color. */
  .tone :global(.coffee-name), .tone :global(.ink-better), .tone :global(.ink-worse) { color: inherit !important; }
  .lead { font-size: 1.15rem; font-weight: 600; margin: 0; opacity: 0.9; }
  .big { font-family: var(--font-display); font-weight: 700; line-height: 0.92; letter-spacing: -0.035em; margin: 0.1em 0 0.2em -0.04em;
    font-variant-numeric: lining-nums; overflow-wrap: anywhere; }
  .big .unit { font-family: var(--font-sans); font-size: 0.28em; letter-spacing: 0; font-weight: 600; }
  .context { margin: 0; line-height: 1.45; max-width: 34ch; }
  .more { color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 0.2em; text-decoration-thickness: 1px; }
  .more:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
  .vizwrap { container-type: inline-size; }
  .traits { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  .traits li { border-top: 2px solid currentColor; padding-top: 6px; line-height: 1.3; }
  .traits b { display: block; font-family: var(--font-display); font-size: 1.7rem; }

  /* Story slides: one fact per screen. */
  .slide { height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; display: grid; place-items: center; padding: 56px 20px 28px; cursor: pointer; }
  .inner { width: 100%; max-width: 34rem; display: flex; flex-direction: column; gap: clamp(14px, 2.6vh, 32px); }
  .slide .big { font-size: clamp(4.5rem, min(24vw, 12vh), 8.5rem); }
  .slide .big.long { font-size: clamp(3rem, min(15vw, 8vh), 5.6rem); }
  .slide[data-id='you'] .big { font-size: clamp(2.6rem, 11vw, 4.2rem); line-height: 1; }
  .slide .lead { font-size: clamp(1.15rem, 2.1vh, 1.4rem); }
  .slide .context { font-size: clamp(1.15rem, 2.1vh, 1.4rem); }
  .slide .vizwrap { margin-top: clamp(6px, 2vh, 24px); font-size: clamp(0.9rem, 1.7vh, 1.1rem); }
  .slide .more { align-self: flex-start; font-size: 0.95rem; padding: 10px 0; }
  .share { position: absolute; top: 30px; right: 12px; z-index: 1; }
  .share :global(.share-button) { min-height: 44px; padding: 0 14px; border: 1.5px solid currentColor; border-radius: 22px; background: transparent; color: inherit; font: 600 0.9rem var(--font-sans); }
  .hint { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 0.85rem; opacity: 0.7; margin: 0; }
  .home { position: absolute; top: 30px; left: 12px; min-height: 44px; display: inline-flex; align-items: center; padding: 0 4px; color: inherit; font-weight: 600; font-size: 0.9rem; }
  /* Desktop: text left, the chart or traits right, the whole block centered and filling the slide. */
  @media (min-width: 900px) {
    .inner { max-width: min(76rem, 100%); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); column-gap: clamp(32px, 5vw, 96px); row-gap: clamp(12px, 2vh, 24px); align-items: center; align-content: center; }
    .inner:not(:has(.vizwrap, .traits)) { max-width: 46rem; grid-template-columns: minmax(0, 1fr); }
    .inner > .lead, .inner > .big, .inner > .context, .inner > .more { grid-column: 1; }
    .inner > .vizwrap, .inner > .traits { grid-column: 2; grid-row: 1 / span 4; align-self: center; }
    .slide .big { font-size: clamp(5rem, min(11vw, 22vh), 11rem); }
    .slide .big.long { font-size: clamp(3.5rem, min(7vw, 14vh), 7rem); }
    .slide[data-id='you'] .big { font-size: clamp(2.6rem, min(5vw, 10vh), 5rem); }
    .slide .lead { font-size: clamp(1.15rem, 1.6vw, 1.6rem); }
    .slide .context { font-size: clamp(1.15rem, 1.6vw, 1.6rem); max-width: 38ch; }
    .slide .vizwrap { font-size: clamp(1rem, 1.4vw, 1.4rem); margin-top: 0; }
    .slide .traits { gap: 28px 32px; }
    .slide .traits b { font-size: clamp(1.7rem, 3vw, 3rem); }
  }
  @media (max-height: 640px) {
    .slide { padding: 60px 20px 34px; }
    .inner { gap: 8px; }
    .slide .big { font-size: clamp(3rem, 18vh, 6rem); }
    .slide .big.long { font-size: clamp(2.4rem, 13vh, 4rem); }
    .slide .context { font-size: 1rem; }
  }
  @media (max-height: 640px) and (min-width: 700px) {
    .inner { max-width: 56rem; display: grid; grid-template-columns: 1fr 1fr; column-gap: 32px; row-gap: 8px; align-items: center; }
    .inner > .lead, .inner > .big, .inner > .context { grid-column: 1; }
    .inner > .vizwrap, .inner > .traits { grid-column: 2; grid-row: 1 / span 4; align-self: center; }
    .slide .vizwrap :global(svg) { max-height: 58vh; }
    .slide[data-id='you'] .big { font-size: clamp(2rem, 13vh, 3rem); }
    .slide .traits { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 14px; }
    .slide .traits b { font-size: 1.4rem; }
  }

  /* Poster tiles. */
  .tile { border-radius: 14px; padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 10px; }
  .tile .big { font-size: clamp(2.8rem, 5vw, 4.2rem); }
  .tile .big.long { font-size: clamp(2.2rem, 4vw, 3.2rem); }
  .tile[data-id='you'] .big { font-size: clamp(2rem, 4vw, 3rem); line-height: 1; }
  .tile .lead { font-size: 1rem; }
  .tile .context { font-size: 0.95rem; max-width: 46ch; }
  .tile .vizwrap { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; padding-top: 4px; }
  .tile .vizwrap :global(.hlist) { flex: 1; align-content: space-evenly; }
  .tile .more { font-size: 0.85rem; padding: 6px 0 2px; align-self: flex-start; }
  .tile[data-id='you'] .traits { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
  /* Wide tiles span 2 only in the 3-column grid; with 1 or 2 columns they would sit alone on a row. */
  @media (min-width: 900px) {
    .tile.wide { grid-column: span 2; }
    .tile.wide:has(.vizwrap) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); grid-template-rows: auto auto 1fr auto; column-gap: 24px; }
    .tile.wide:has(.vizwrap) > * { grid-column: 1; }
    .tile.wide:has(.vizwrap) > .vizwrap { grid-column: 2; grid-row: 1 / -1; align-self: center; padding: 0; }
  }
</style>
