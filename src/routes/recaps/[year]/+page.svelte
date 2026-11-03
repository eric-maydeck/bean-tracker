<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { POSTER_ID } from '$lib/recapsUrl';
  import Slide from './Slide.svelte';
  import Poster from './Poster.svelte';

  let { data } = $props();
  const r = $derived(data.recap);
  // data.recap.preview, not data.state.preview: the route echoes ?preview=1 even when it resolved false.
  const people = $derived(data.state.people);
  const ids = $derived([...r.slides.map((s) => s.id), POSTER_ID]);

  let reel: HTMLElement;
  let cur = $state(0);
  let pfg = $state('');

  const go = (i: number) => reel.children[Math.max(0, Math.min(ids.length - 1, i))].scrollIntoView();
  const onPoster = () => cur === ids.length - 1;

  // The current slide = the one crossing the middle of the screen (works for the tall poster too).
  // It lives in the URL hash so each slide is linkable; every query param but `slide` stays.
  onMount(() => {
    const start = ids.indexOf(location.hash.slice(1) || data.state.slide || '');
    if (start > 0) reel.children[start].scrollIntoView({ behavior: 'instant' });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      cur = [...reel.children].indexOf(e.target);
      pfg = getComputedStyle(e.target).color;
      const q = new URLSearchParams(location.search);
      q.delete('slide');
      const qs = q.size ? `?${q}` : '';
      replaceState(`${location.pathname}${qs}${cur ? '#' + e.target.id : ''}`, {});
    }), { root: reel, rootMargin: '-50% 0px -50% 0px' });
    for (const s of reel.children) io.observe(s);
    return () => io.disconnect();
  });

  function tap(e: MouseEvent) {
    if ((e.target as Element).closest('a, button, .viz, #poster')) return;
    go(cur + (e.clientX < innerWidth * 0.3 ? -1 : 1));
  }
  function key(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ';
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    // The poster scrolls natively: down always, up until it is back at its top.
    if (onPoster() && (e.key === 'ArrowDown' || e.key === ' ' || (back && reel.scrollTop > (reel.lastElementChild as HTMLElement).offsetTop + 4))) return;
    if (e.key === ' ' && (e.target as Element).closest('a, button')) return;
    if (fwd) { e.preventDefault(); go(cur + 1); }
    else if (back) { e.preventDefault(); go(cur - 1); }
  }
</script>

<svelte:head><title>{r.poster.title}</title></svelte:head>
<svelte:window onkeydown={key} />

<nav class="recap-progress" data-layout-ignore="story progress segments; ui-rules rule 4 exemption pending user ruling (recaps gate 1)" class:solid={onPoster()} style:--pfg={pfg || undefined} aria-label="Slides">
  {#each ids as id, i (id)}
    <button type="button" class:done={i <= cur} aria-current={i === cur ? 'true' : undefined} aria-label="Go to slide {i + 1}" onclick={() => go(i)}><span></span></button>
  {/each}
</nav>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="recap-reel" bind:this={reel} onclick={tap} role="presentation">
  {#each r.slides as s, i (s.id)}
    <Slide slide={s} year={r.year} {people} preview={r.preview} index={i} total={ids.length} />
  {/each}
  <Poster slides={r.slides} poster={r.poster} year={r.year} {people} preview={r.preview} total={ids.length} />
</div>

<style>
  .recap-reel { position: fixed; inset: 0; height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; overscroll-behavior: contain; scrollbar-width: none; background: var(--color-bg); color: var(--color-text); }
  .recap-reel::-webkit-scrollbar { display: none; }
  @media (prefers-reduced-motion: reduce) { .recap-reel { scroll-behavior: auto; } }

  /* Progress: one button per slide, a 4px bar inside a taller hit area. */
  .recap-progress { position: fixed; z-index: 3; top: 0; left: 0; right: 0; display: flex; gap: 4px; padding: 0 16px; color: var(--pfg, #faf7f2); }
  .recap-progress.solid { background: var(--color-bg); }
  .recap-progress button { flex: 1; min-width: 0; height: 24px; padding: 10px 0; border: 0; background: none; cursor: pointer; color: inherit; }
  .recap-progress button span { display: block; height: 4px; border-radius: 2px; background: currentColor; opacity: 0.3; transition: opacity 0.2s; }
  .recap-progress button.done span { opacity: 1; }
  .recap-progress button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
