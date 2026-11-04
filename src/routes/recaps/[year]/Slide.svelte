<script lang="ts">
  import type { Slide, Tone } from '$lib/server/recaps/types';
  import { recapHref } from '$lib/recapsUrl';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import RecapViz from './RecapViz.svelte';
  import { unitGap, glue } from '$lib/unitGap';

  // One fact: a full-screen story slide (`section`), or a tile on the poster (`tile`).
  let { slide, year, preview, index, total, tile = false, spans = [1, 1, 1], cover = false, shareHref }: {
    slide: Slide; year: number; preview: boolean; index: number; total: number; tile?: boolean; spans?: number[]; cover?: boolean; shareHref?: string;
  } = $props();

  // Dark ink on the light tones, the site's text color on cream; cream text everywhere else.
  const INK: Partial<Record<Tone, string>> = { sun: '#2b211b', amber: '#2b211b', cream: 'var(--color-text)' };
  const tone = $derived(slide.tone ?? 'ink');
  // A word never breaks mid-word: the longest word (in chars) sizes .fit so it always fits the box (see .fit).
  // The last word and its unit are one unbreakable run, so they count together (the unit is set at 0.28em, a glue gap at ~0.3).
  const longest = $derived.by(() => {
    const words = slide.big.split(/\s+/).map((w) => w.length);
    if (slide.unit) words[words.length - 1] += slide.unit.length * 0.28 + (unitGap(slide.unit) ? 0.3 : 0);
    return Math.max(1, ...words);
  });
</script>

{#snippet body()}
  {#if slide.lead}<p class="lead"><CoffeeName text={slide.lead} /></p>{/if}
  {#if slide.roaster}
    <div class="big names" style:--rn={slide.roaster.length} style:--cn={slide.big.length}><span class="rn">{slide.roaster}</span><span class="cn"><CoffeeName text={slide.big} /></span></div>
  {:else}
  <p class="big" class:long={slide.big.length > 7} class:xlong={slide.big.length > 18}><span class="fit" style:--w={longest}><CoffeeName text={glue(slide.big)} />{#if slide.unit}{#if unitGap(slide.unit)}<span class="unit gap">{'\u00a0'}</span>{/if}<span class="unit">{slide.unit}</span>{/if}</span></p>
  {/if}
  {#if slide.each && !tile}<p class="each"><span style:--w={slide.each.length}>{slide.each}</span></p>{/if}
  {#if slide.sub}<p class="sub">{slide.sub}</p>{/if}
  {#if slide.context}<p class="context"><CoffeeName text={slide.context} /></p>{/if}
  {#if slide.viz}<div class="vizwrap"><RecapViz viz={slide.viz} /></div>{/if}
  {#if slide.traits}
    <ul class="traits">{#each slide.traits as t (t.label)}<li><b>{t.value}</b> {t.label}</li>{/each}</ul>
  {/if}
  {#if !cover}<a class="more" href={slide.link.href} aria-label="See more in {slide.link.section}">{slide.link.section} <span aria-hidden="true">→</span></a>{/if}
{/snippet}

{#if tile}
  <article class="tone tile" class:wide={spans[2] > 1} style:--s1={spans[0]} style:--s2={spans[1]} style:--s3={spans[2]} data-id={slide.id} data-tone={tone} style:--bg="var(--t-{tone})" style:--fg={INK[tone]}>{@render body()}</article>
{:else}
  <section class="tone slide" class:cover id={slide.id} data-id={slide.id} data-tone={tone} aria-label="{index + 1} of {total}" style:--bg="var(--t-{tone})" style:--fg={INK[tone]}>
    <div class="share"><ShareButton path={shareHref ?? recapHref(year, { slide: slide.id, ...(preview && { preview: true as const }) })} /></div>
    <div class="inner">{@render body()}</div>
    {#if cover}<footer class="cover-foot"><a class="home" href="/">Bean Tracker</a><p class="hint">Swipe or tap to continue</p></footer>{/if}
  </section>
{/if}

<style>
  .tone { --fg: #faf7f2; background: var(--bg); color: var(--fg); position: relative; overflow: hidden; }
  /* Coffee-name keyword colors and signed deltas are unreadable on a tone: the slide's own text color. */
  .tone :global(.coffee-name), .tone :global(.ink-better), .tone :global(.ink-worse) { color: inherit !important; }
  .lead { font-size: 1.15rem; font-weight: 600; margin: 0; opacity: 0.9; }
  .big { font-family: var(--font-display); font-weight: 700; line-height: 0.92; letter-spacing: -0.035em; margin: 0.1em 0 0.2em -0.04em;
    font-variant-numeric: lining-nums; container-type: inline-size; }
  /* Words wrap only at spaces; a word wider than the box shrinks to fit (never splits). 0.62em is a wide-glyph average for the display face. */
  .fit { display: block; font-size: min(1em, calc(100cqi / (var(--w) * 0.62))); }
  /* Roaster over coffee, two nowrap lines that shrink to the width of their box (cqi); ellipsis only past the floor. */
  .names { container-type: inline-size; --cap: 3.6rem; font-size: 1rem; line-height: 1.05; letter-spacing: -0.02em; white-space: nowrap; }
  .names span { display: block; overflow: hidden; text-overflow: ellipsis; padding-bottom: 0.08em; }
  .names .cn { font-size: clamp(0.8rem, calc(100cqi / (var(--cn) * 0.6)), var(--cap)); }
  .names .rn { font-size: clamp(0.9rem, calc(100cqi / (var(--rn) * 0.6)), calc(var(--cap) * 0.62)); font-weight: 600; opacity: 0.9; }
  .big .unit.gap { white-space: normal; }
  .big .unit { white-space: nowrap; font-family: var(--font-sans); font-size: 0.28em; letter-spacing: 0; font-weight: 600; }
  .sub { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 6.5vw, 2.4rem); line-height: 1.1; margin: -0.1em 0 0.1em; }
  .context { margin: 0; line-height: 1.45; max-width: 34ch; }
  .more { color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 0.2em; text-decoration-thickness: 1px; }
  .more:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
  /* The per-person companion under the big value: one nowrap line that shrinks to its box (cqi, ~0.56em per char), never wraps. */
  .each { container-type: inline-size; margin: 0; font-family: var(--font-display); font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }
  .each span { display: block; white-space: nowrap; font-size: min(1em, calc(100cqi / (var(--w) * 0.52))); }
  /* Subtext to the big value: pulled up tight under it (cancels the flex gap and the big's bottom margin), a step below .sub. */
  .slide .each { font-size: clamp(1.3rem, 5vw, 1.7rem); margin-top: calc(10px - clamp(12px, 1.6vh, 28px)); }
  .slide .big:has(+ .each) { margin-bottom: 0; }
  .vizwrap { container-type: inline-size; }
  .traits { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  .traits li { border-top: 2px solid currentColor; padding-top: 6px; line-height: 1.3; }
  .traits b { display: block; font-family: var(--font-display); font-size: 1.7rem; }

  /* Story slides: one fact per screen. */
  .slide { height: 100dvh; scroll-snap-align: start; scroll-snap-stop: always; display: grid; place-items: center; padding: 56px 20px 28px; cursor: pointer; }
  .inner { width: 100%; max-width: 34rem; display: flex; flex-direction: column; gap: clamp(12px, 1.6vh, 28px); }
  .slide .big { font-size: clamp(4.5rem, min(24vw, 12vh), 8.5rem); }
  .slide .big.long { font-size: clamp(3rem, min(15vw, 8vh), 5.6rem); }
  .slide .big.xlong { font-size: clamp(2rem, min(9vw, 6vh), 3.6rem); line-height: 1; }
  .slide .names { --cap: clamp(2.4rem, 12vw, 4.4rem); }
  .slide[data-id='you'] .big { font-size: clamp(2.6rem, 11vw, 4.2rem); line-height: 1; }
  .slide[data-id='cover'] .big { font-size: clamp(3.4rem, min(25vw, 14vh), 9rem); line-height: 1; }
  .slide .lead { font-size: clamp(1.15rem, 2.1vh, 1.4rem); }
  .slide .context { font-size: clamp(1.15rem, 2.1vh, 1.4rem); }
  .slide .vizwrap { margin-top: clamp(6px, 2vh, 24px); font-size: clamp(0.9rem, 1.7vh, 1.1rem); }
  .slide .more { align-self: flex-start; font-size: 0.95rem; padding: 10px 0; }
  .share { position: absolute; top: 30px; right: 12px; z-index: 1; }
  .share :global(.share-button) { min-height: 44px; padding: 0 14px; border: 1.5px solid currentColor; border-radius: 22px; background: transparent; color: inherit; font: 600 0.9rem var(--font-sans); }
  .cover-foot { position: absolute; bottom: 8px; left: 12px; right: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .hint { text-align: right; font-size: 0.85rem; opacity: 0.7; margin: 0; }
  .home { min-height: 44px; display: inline-flex; align-items: center; color: inherit; font-weight: 600; font-size: 0.9rem; }
  /* Phone portrait and tablet: one centered block; charts keep their natural size, rows and bars grow a little. */
  @media (max-width: 899px) and (min-height: 641px) {
    .slide { padding-top: 84px; }
    .slide .vizwrap :global(svg) { max-height: 34vh; }
    .slide .vizwrap :global(.sbar) { height: clamp(34px, 5vh, 52px); }
    .slide .vizwrap :global(.split) { gap: clamp(10px, 2vh, 22px); }
    .slide .vizwrap :global(.hlist) { row-gap: clamp(8px, 1.6vh, 16px); }
    .slide .vizwrap :global(.hlist .track) { height: clamp(10px, 1.5vh, 16px); }
  }
  /* Desktop: text left, the chart or traits right, the whole block centered and filling the slide. */
  @media (min-width: 900px) {
    .inner { max-width: min(84rem, 100%); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); column-gap: clamp(32px, 4vw, 80px); row-gap: clamp(12px, 2vh, 24px); align-items: center; align-content: center; }
    .inner:not(:has(.vizwrap, .traits)) { max-width: 46rem; grid-template-columns: minmax(0, 1fr); }
    .inner > .lead, .inner > .big, .inner > .each, .inner > .sub, .inner > .context, .inner > .more { grid-column: 1; }
    .slide .sub { font-size: clamp(1.8rem, 3vw, 3rem); }
    .slide .each { font-size: clamp(1.3rem, 2.1vw, 2.1rem); margin-top: calc(10px - clamp(12px, 2vh, 24px)); }
    .inner > .vizwrap, .inner > .traits { grid-column: 2; grid-row: 1 / span 5; align-self: center; }
    .slide .big { font-size: clamp(5rem, min(13vw, 26vh), 13rem); }
    .slide .big.long { font-size: clamp(3.5rem, min(8vw, 16vh), 8rem); }
    .slide .big.xlong { font-size: clamp(2.4rem, min(4.5vw, 9vh), 4.6rem); }
    .slide .names { --cap: clamp(3rem, min(6vw, 12vh), 6rem); }
    .slide[data-id='you'] .big { font-size: clamp(2.6rem, min(5vw, 10vh), 5rem); }
    .slide[data-id='cover'] .big { font-size: clamp(4rem, min(10vw, 20vh), 9rem); }
    .slide[data-id='cover'] .inner { max-width: 60rem; }
    .slide .lead { font-size: clamp(1.15rem, 2vw, 2rem); }
    .slide .context { font-size: clamp(1.15rem, 1.9vw, 1.9rem); max-width: 38ch; }
    .slide .vizwrap { font-size: clamp(1.05rem, 1.7vw, 1.7rem); margin-top: 0; }
    .slide .vizwrap :global(.hlist) { row-gap: clamp(10px, 2.4vh, 26px); }
    .slide .traits { gap: 28px 32px; }
    .slide .traits b { font-size: clamp(1.7rem, 3vw, 3rem); }
  }
  @media (max-height: 640px) {
    .slide { padding: 70px 20px 22px; }
    .inner { gap: 8px; }
    .slide .big { font-size: clamp(3rem, 18vh, 6rem); }
    .slide .big.long { font-size: clamp(2.4rem, 13vh, 4rem); }
    .slide .big.xlong { font-size: clamp(1.4rem, 7.5vh, 2rem); }
    .slide .names { --cap: clamp(1.6rem, 10vh, 2.4rem); }
    .slide .sub { font-size: 1.15rem; margin: 0; }
    .slide .context { font-size: 1rem; }
    .slide .each { font-size: 1.1rem; margin-top: 2px; }
  }
  @media (max-height: 640px) and (min-width: 700px) {
    .inner { max-width: 56rem; display: grid; grid-template-columns: 1fr 1fr; column-gap: 32px; row-gap: 8px; align-items: center; }
    .inner > .lead, .inner > .big, .inner > .each, .inner > .sub, .inner > .context { grid-column: 1; }
    .inner > .vizwrap, .inner > .traits { grid-column: 2; grid-row: 1 / span 5; align-self: center; }
    .slide .vizwrap :global(svg) { max-height: 54vh; }
    .slide .context { line-height: 1.3; }
    .slide[data-id='you'] .big { font-size: clamp(1.6rem, 10vh, 2.4rem); }
    .slide[data-id='cover'] .big { font-size: clamp(2.6rem, 17vh, 4.5rem); }
    .slide[data-id='cover'] .inner { max-width: 40rem; grid-template-columns: minmax(0, 1fr); }
    .slide .traits { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 14px; }
    .slide .traits b { font-size: 1.2rem; }
  }

  /* Poster tiles. */
  .tile { border-radius: 14px; padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 10px; }
  .tile .big { font-size: clamp(2.8rem, 5vw, 4.2rem); }
  .tile .big.long { font-size: clamp(2.2rem, 4vw, 3.2rem); }
  .tile .names { --cap: 2.4rem; }
  .tile .big.xlong { font-size: clamp(1.6rem, 2.6vw, 2.2rem); line-height: 1.05; }
  .tile[data-id='you'] .big { font-size: clamp(2rem, 4vw, 3rem); line-height: 1; }
  .tile .lead { font-size: 1rem; }
  .tile .sub { font-size: 1.4rem; }
  .tile .context { font-size: 0.95rem; max-width: 46ch; }
  .tile .vizwrap { padding-top: 4px; }
  .tile .vizwrap :global(.hlist) { row-gap: 10px; }
  .tile .vizwrap :global(.hlist .track) { height: 14px; }
  .tile .more { font-size: 0.85rem; padding: 6px 0 2px; align-self: flex-start; margin-top: auto; }
  .tile[data-id='you'] .traits { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
  /* The poster picks each tile's span (so every row closes); a tile spanning 2+ puts its chart beside its text. */
  @media (min-width: 900px) {
    .tile.wide:has(.vizwrap) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); grid-template-rows: auto auto 1fr auto; column-gap: 24px; }
    .tile.wide:has(.vizwrap) > * { grid-column: 1; }
    .tile.wide:has(.vizwrap) > .vizwrap { grid-column: 2; grid-row: 1 / -1; align-self: center; padding: 0; }
  }
  /* Last, so no size rule for .big (set in em, hence the margins) reaches the roaster/coffee box. */
  .slide .big.names, .tile .big.names { font-size: 1rem; margin: 0.15rem 0 0.25rem; }
</style>
