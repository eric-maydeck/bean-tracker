<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate, replaceState } from '$app/navigation';
  import { POSTER_ID, recapHref } from '$lib/recapsUrl';
  import type { Slide as SlideT } from '$lib/server/recaps/types';
  import PreviewMeta from '$lib/components/PreviewMeta.svelte';
  import { recapPreview } from '$lib/linkPreview';
  import Slide from './Slide.svelte';
  import Poster from './Poster.svelte';

  let { data } = $props();
  const r = $derived(data.recap);
  // data.recap.preview, not data.state.preview: the route echoes ?preview=1 even when it resolved false.
  const people = $derived(data.state.people);
  const ids = $derived(['cover', ...r.slides.map((s) => s.id), POSTER_ID]);
  // The title slide is not a fact: no score, never selected, no poster tile.
  const cover = $derived<SlideT>({ id: 'cover', category: 'amounts', lead: '', big: r.cover.title, context: r.cover.sub, tone: r.cover.tone,
    link: { tab: '', section: '', href: '' }, card: { big: '', label: '' } });

  let reel: HTMLElement;
  let cur = $state(0);
  let pfg = $state('');

  // Back is the browser's back whenever an in-app page came before (as the coffee page's Back); otherwise a plain link to the Recaps tab.
  let cameFromApp = $state(false);
  // The reel's own replaceState (people toggle, slide hash) is not an earlier page.
  afterNavigate(({ from }) => { if (from && from.route.id !== '/recaps/[year]') cameFromApp = true; });
  function back(e: MouseEvent) {
    if (!cameFromApp || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.back();
  }

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
<PreviewMeta preview={recapPreview(r, data.state.slide, people)} />
<svelte:window onkeydown={key} />

<nav class="recap-progress" data-layout-ignore="story progress segments: ui-rules rule 4 exemption (user, 2026-11-02)" class:solid={onPoster()} style:--pfg={pfg || undefined} aria-label="Slides">
  {#each ids as id, i (id)}
    <button type="button" class:done={i <= cur} aria-current={i === cur ? 'true' : undefined} aria-label="Go to slide {i + 1}" onclick={() => go(i)}><span></span></button>
  {/each}
</nav>

<nav class="recap-nav" class:solid={onPoster()} style:--pfg={pfg || undefined} aria-label="Recaps">
  <a href="/insights?tab=recaps" onclick={back}>Back</a>
  <a href="/insights?tab=recaps">All recaps</a>
</nav>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="recap-reel" bind:this={reel} onclick={tap} role="presentation">
  <Slide cover slide={cover} shareHref={recapHref(r.year, { people, ...(r.preview && { preview: true as const }) })} year={r.year} {people} preview={r.preview} index={0} total={ids.length} />
  {#each r.slides as s, i (s.id)}
    <Slide slide={s} householdSize={r.householdSize} year={r.year} {people} preview={r.preview} index={i + 1} total={ids.length} />
  {/each}
  <Poster slides={r.slides} poster={r.poster} year={r.year} {people} preview={r.preview} total={ids.length} />
</div>

<style>
  .recap-reel { position: fixed; inset: 0; height: 100dvh; overflow-y: auto; scroll-snap-type: y mandatory; scroll-behavior: smooth; overscroll-behavior: contain; scrollbar-width: none; background: var(--color-bg); color: var(--color-text); }
  .recap-reel::-webkit-scrollbar { display: none; }
  @media (prefers-reduced-motion: reduce) { .recap-reel { scroll-behavior: auto; } }

  /* Progress: one button per slide, a 4px bar inside a taller hit area. */
  .recap-progress { position: fixed; z-index: 3; top: 0; left: 0; right: 0; display: flex; gap: 4px; padding: 0 16px; color: var(--pfg, #faf7f2); }
  /* Top left, under the progress segments, in the Share button's row. On the poster it is a solid bar over the scrolling tiles. */
  .recap-nav { position: fixed; z-index: 3; top: 24px; left: 12px; display: flex; gap: 8px; color: var(--pfg, #faf7f2); }
  .recap-nav.solid { top: 24px; left: 0; right: 0; padding: 4px 12px; background: var(--color-bg); }
  .recap-nav a { min-height: 44px; display: inline-flex; align-items: center; padding: 0 14px; border: 1.5px solid currentColor; border-radius: 22px; color: inherit; font: 600 0.9rem var(--font-sans); text-decoration: none; }
  .recap-nav a:focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }
  .recap-progress.solid { background: var(--color-bg); }
  .recap-progress button { flex: 1; min-width: 0; height: 24px; padding: 10px 0; border: 0; background: none; cursor: pointer; color: inherit; }
  .recap-progress button span { display: block; height: 4px; border-radius: 2px; background: currentColor; opacity: 0.3; transition: opacity 0.2s; }
  .recap-progress button.done span { opacity: 1; }
  .recap-progress button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
