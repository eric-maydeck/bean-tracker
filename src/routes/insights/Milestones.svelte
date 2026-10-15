<script lang="ts">
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { KINDS, MON, type InsightsUrlState, type Kind } from '$lib/insightsUrl';
  import type { MilestonesTab } from '$lib/server/insights/milestones';
  import { rowVars } from './rows';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import TileCaption from './TileCaption.svelte';
  import { rulerTicks, tickAt, rulerToFeed, feedToRuler, type Section } from './ruler';

  let { m, kinds, choose }: { m: MilestonesTab; kinds: Kind[] | undefined; choose: (c: InsightsUrlState) => void } = $props();

  const LABEL: Record<Kind, string> = { counts: 'Counts', firsts: 'Firsts', bests: 'Bests', streaks: 'Streaks', gear: 'Gear', anniversaries: 'Anniversaries' };
  const ICON: Record<Kind, IconName> = { counts: 'hash', firsts: 'sparkle', bests: 'trophy', streaks: 'fire', gear: 'gear', anniversaries: 'cake' };
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = (ym: string) => `${FULL[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
  const day = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}`;
  const n = (v: number) => v.toLocaleString('en-US');
  // A tile's own anchor, its caption links to it (as Records' #record-…): kgBrewed → milestones-total-kg-brewed.
  const tileId = (group: string, key: string) => `milestones-${group}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

  // Chips: none pressed = every kind (no param).
  function toggle(k: Kind) {
    const on = kinds ?? [];
    const next = KINDS.filter((x) => (x === k ? !on.includes(x) : on.includes(x)));
    choose({ kinds: next.length ? next : undefined });
  }

  let summary = $derived(
    (['total', 'firsts', 'bests'] as const).map((k) => ({
      key: k, label: k === 'total' ? 'Milestones' : k === 'firsts' ? 'Firsts' : 'New bests',
      // Like the overview's tileDelta: a compare window with none (or no data) shows no line, not "from 0".
      value: m.summary[k], prev: m.summaryPrev?.[k] || null
    }))
  );
  let nextVars = $derived(rowVars(m.nextUp.length));
  let totalVars = $derived(rowVars(m.totals.length));
  // The timeline ruler (feedback M1): vertical beside the feed from 700px (the CSS breakpoint),
  // a horizontal strip on phones. Labels fit the track's length.
  let track: HTMLElement | undefined = $state();
  let tw = $state(0), th = $state(0);
  let innerW = $state(0);
  let vertical = $derived(innerW >= 700);
  let barH = $state(0);
  // The side bar's full height: the viewport under the filter bar, less its 0.75rem margins.
  let innerH = $state(0);
  let fullH = $derived(innerH - barH - 24);
  // Labels are thinned for the full length (a short feed's capped ruler keeps them).
  let ticks = $derived(rulerTicks(m.months.map((g) => g.month), vertical ? fullH : tw, vertical ? 22 : 72));
  let feed: HTMLElement | undefined = $state();
  let nav: HTMLElement | undefined = $state();
  // Sub-ticks between the month ticks, as dense as the length allows (4 a month, about weekly, or 2).
  let subs = $derived.by(() => {
    const band = Math.max(tw, th) / Math.max(1, ticks.length);
    return band >= 32 ? 4 : band >= 14 ? 2 : 0;
  });
  // Where the feed's visible top is along the ruler (0..1): a small fixed-size thumb (feedback M8).
  let pos: number | null = $state(null);
  let current = $derived(pos === null ? null : tickAt(ticks, pos).ym);
  // The side bar keeps one height while scrolling and slides off with the feed's end (native sticky);
  // only a feed shorter than the full height caps it, so it never sticks out below the feed (M10).
  let rulerH: number | null = $state(null);
  // A screen too short for a usable side ruler (under 200px under the bars) drops it, and the feed
  // takes its column (M11). Viewport only, so it changes on resize, never mid-scroll.
  const MIN_RULER = 200;
  let hideRuler = $derived(vertical && fullH < MIN_RULER);

  // The month sections' current extents (viewport coordinates).
  function sections(): Section[] {
    const hs = [...feed!.querySelectorAll<HTMLElement>('.month')], end = feed!.getBoundingClientRect().bottom;
    return hs.map((h, j) => ({ ym: h.id.slice(2), top: h.getBoundingClientRect().top, bottom: hs[j + 1]?.getBoundingClientRect().top ?? end }));
  }
  let dragging = false;
  function update() {
    if (!feed || !nav || !ticks.length) return;
    const secs = sections(), top = vertical ? barH : Math.max(barH, nav.getBoundingClientRect().bottom);
    const k = scale(secs, top), y = top + 8; // a few px in: a header just under the bars counts as in view
    pos = feedToRuler(ticks, secs, k ? secs[0].top + (y - secs[0].top) / k : y);
  }
  // The ruler spans the scroll from the first month's header under the bars to the panel's bottom at
  // the screen's bottom, so the feed's distance below that header is scaled by k (0: the panel fits).
  function scale(secs: Section[], top: number) {
    const full = secs[secs.length - 1].bottom - secs[0].top;
    const span = feed!.closest('section')!.getBoundingClientRect().bottom - innerH - (secs[0].top - top);
    return full > 0 ? Math.max(0, span) / full : 0;
  }
  // The ruler's height, never on scroll: the full height, capped to where the feed's content ends below
  // the ruler's own top in the (unstuck) timeline. The content's end, not the feed box: the grid stretches
  // that to the ruler. Rects relative to the timeline don't move with the scroll.
  function size() {
    const end = feed?.lastElementChild;
    if (!end || !nav || !vertical || hideRuler) return void (rulerH = null);
    const tl = nav.parentElement!.getBoundingClientRect().top;
    rulerH = Math.min(fullH, end.getBoundingClientRect().bottom - tl - parseFloat(getComputedStyle(nav).marginTop));
  }
  // On load, resize and a new feed (period, kinds): the feed's box can't tell, as the grid may stretch it.
  $effect(() => {
    void m.months;
    if (!feed) return;
    size();
    const ro = new ResizeObserver(size);
    ro.observe(feed);
    return () => ro.disconnect();
  });
  $effect(() => {
    void ticks;
    void barH;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    on();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
    };
  });

  // Press, or drag, on the ruler: scroll so that point of the feed (as far through its month's
  // section as the pointer is through the month's band, feedback M3) sits at the top of the feed's
  // visible part, under the sticky bars (and the phone strip, once stuck). Pointer capture keeps a
  // drag going off the ruler (M5); the tick buttons' clicks are the keyboard path.
  // Scaled (see scale) so the ruler's ends are the scroll's: the first header at the top, the panel's
  // bottom at the screen's bottom.
  function scrub(e: PointerEvent) {
    const r = track!.getBoundingClientRect(), secs = sections(), top = vertical ? barH : barH + nav!.offsetHeight;
    const y = rulerToFeed(ticks, secs, vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width);
    if (y !== null) scrollBy(0, secs[0].top - top + (y - secs[0].top) * scale(secs, top));
  }
  function grab(e: PointerEvent) {
    nav!.setPointerCapture(e.pointerId);
    dragging = true;
    scrub(e);
  }
  // A touch on the phone strip waits to see the gesture: a tap jumps and a sideways drag scrubs,
  // but a vertical swipe that starts on the strip just scrolls the page (pan-y), never jumping the feed.
  let touch: { x: number; y: number } | null = null;
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    if (!vertical && e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY };
    else grab(e);
  }
  function move(e: PointerEvent) {
    if (touch) {
      const dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
      if (Math.max(dx, dy) < 8) return; // still a tap
      touch = null;
      if (dx > dy) grab(e);
    } else if (dragging) scrub(e);
  }
  const cancel = () => {
    touch = null;
    dragging = false;
    update();
  };
  function up(e: PointerEvent) {
    if (touch) scrub(e); // a tap
    cancel();
  }
  // Capture lost without a pointerup (a re-render, an OS gesture) ends the drag. Only the nav's own:
  // a tick's implicit touch capture passing to the nav bubbles a lostpointercapture up from the tick.
  const lost = (e: PointerEvent) => e.target === nav && cancel();
  const jump = (ym: string) => document.getElementById(`m-${ym}`)?.scrollIntoView();

  // The navigator sticks just under the page's sticky filter bar (barH, declared above).
  $effect(() => {
    const bar = document.querySelector<HTMLElement>('.filter-bar');
    if (!bar) return;
    const ro = new ResizeObserver(() => (barH = bar.offsetHeight));
    ro.observe(bar);
    return () => ro.disconnect();
  });
</script>

{#snippet caption(id: string, label: string)}
  <TileCaption href="#{id}" {label} />
{/snippet}

<svelte:window bind:innerHeight={innerH} bind:innerWidth={innerW} />

<div class="kinds-bar">
  <div class="tab-group kind-chips" role="group" aria-label="Kinds" data-button-row>
    {#each KINDS as k (k)}
      <button aria-pressed={!!kinds?.includes(k)} onclick={() => toggle(k)} style:--kind="var(--kind-{k})"
        ><Icon name={ICON[k]} />{LABEL[k]}</button
      >
    {/each}
  </div>
</div>

<section class="chart-panel">
  <HeadingAnchor id="milestones-totals">All-time totals</HeadingAnchor>
  <div class="hl-grid milestone-totals">
    {#each m.totals as t, i (t.key)}
      <div class="hl-card" id={tileId('total', t.key)} style={totalVars[i]}>
        <span class="hl-value">{n(t.value)}{#if t.unit}<small>{`\u00a0${t.unit}`}</small>{/if}</span>
        {@render caption(tileId('total', t.key), t.label)}
      </div>
    {/each}
  </div>
</section>

<section class="chart-panel">
  <HeadingAnchor id="milestones-timeline">Milestones</HeadingAnchor>
  <!-- A stat strip (ui-rules 33): three single-figure totals keep one row on phones. -->
  <div class="hl-grid milestone-summary stat-strip">
    {#each summary as s (s.key)}
      {@const d = s.prev === null ? null : s.value - s.prev}
      <div class="hl-card" id={tileId('summary', s.key)} style="--q4:3;--q3:3;--q2:3">
        <span class="hl-value">{n(s.value)}</span>
        {#if d !== null}
          <span class="hl-line hl-delta" class:trend-good={d > 0} class:trend-bad={d < 0}
            >{d === 0 ? 'No change' : `${d > 0 ? '▲' : '▼'} ${n(Math.abs(d))} from ${n(s.prev!)}`}</span
          >
        {/if}
        {@render caption(tileId('summary', s.key), s.label)}
      </div>
    {/each}
  </div>

  {#if m.onThisDay}
    {@const o = m.onThisDay}
    <div class="on-this-day">
      <Icon name="cake" />
      <div class="who">
        <HeadingAnchor id="milestones-on-this-day" level={3} class="otd-title">On this day a year ago</HeadingAnchor>
        <span>
          {#if o.holder.href}<a href={o.holder.href}>{o.holder.label}</a>{:else}{o.holder.label}{/if}
        </span>
        <small>{[o.brewer, o.holder.sub].filter(Boolean).join(' · ')}</small>
      </div>
      {#if o.rating !== null}<span class="otd-rating">{o.rating.toFixed(1)}</span>{/if}
    </div>
  {/if}

  {#if !m.months.length}
    <p class="hl-empty">No milestones in this period.</p>
  {/if}
  {#if m.months.length}
    <div class="timeline" class:no-ruler={hideRuler} style:--bar-h="{barH}px">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <nav
        class="ruler"
        aria-label="Timeline"
        style:height={rulerH === null ? null : `${rulerH}px`}
        bind:this={nav}
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={cancel}
        onlostpointercapture={lost}
      >
        <div class="track" class:subs={subs > 0} style:--subs={ticks.length * subs} bind:this={track} bind:clientWidth={tw} bind:clientHeight={th}>
          {#if pos !== null}<span class="band" style:--a={pos}></span>{/if}
          {#each ticks as t (t.ym)}
            <button
              class="tick"
              class:major={t.major}
              style:--p={t.p}
              aria-label="Jump to {month(t.target)}"
              aria-current={t.ym === current ? 'true' : undefined}
              tabindex={t.major || t.ym === t.target ? 0 : -1}
              onclick={(e) => e.detail === 0 && jump(t.target)}>{#if t.major}<span>{t.label}</span>{/if}</button
            >
          {/each}
        </div>
      </nav>
      <div class="feed" bind:this={feed}>
        {#each m.months as g (g.month)}
          <HeadingAnchor id="m-{g.month}" level={3} class="month">{month(g.month)}</HeadingAnchor>
          <ol class="milestone-feed">
            {#each g.events as e (e.key)}
              <li>
                <span class="kind-icon" style:--kind="var(--kind-{e.kind})" title={LABEL[e.kind]}><Icon name={ICON[e.kind]} /></span>
                <time datetime={e.date}>{day(e.date)}</time>
                <span class="who">
                  <span class="ev-title">{e.title}</span>
                  {#if e.detail}
                    <small>{#if e.href}<a href={e.href}>{e.detail}</a>{:else}{e.detail}{/if}</small>
                  {/if}
                </span>
              </li>
            {/each}
          </ol>
        {/each}
      </div>
    </div>
  {/if}
</section>

{#if m.nextUp.length}
  <section class="chart-panel">
    <HeadingAnchor id="milestones-next-up">Next up</HeadingAnchor>
    <div class="hl-grid next-up">
      {#each m.nextUp as u, i (u.key)}
        <div class="hl-card" id={tileId('next', u.key)} style={nextVars[i]}>
          <span class="hl-value">{n(u.value)}<small>{` / ${n(u.target)}${u.key === 'kgBrewed' ? '\u00a0kg' : ''}`}</small></span>
          <div
            class="bar"
            role="progressbar"
            aria-label="{u.label}: {n(u.value)} of {n(u.target)}"
            aria-valuemin="0"
            aria-valuemax={u.target}
            aria-valuenow={u.value}
          >
            <span style:width="{Math.min(100, (u.value / u.target) * 100)}%"></span>
          </div>
          {@render caption(tileId('next', u.key), u.label)}
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  /* Tile names (TileCaption) link to the tile's own anchor, which lands under the sticky bar
     (scroll-padding) with a little room. */
  .hl-card {
    scroll-margin-top: var(--space-2);
  }
  .kinds-bar {
    margin-bottom: var(--space-3);
  }
  .kind-chips button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    padding: 0.3rem 0.75rem;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .kind-chips :global(.icon) {
    width: 1rem;
    height: 1rem;
  }
  .kind-chips button:not([aria-pressed='true']) :global(.icon) {
    color: var(--kind);
  }
  /* Phones: the six chips as a 2×3 grid of equal buttons (feedback M6). */
  @media (max-width: 640px) {
    .kind-chips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .kind-chips button {
      justify-content: center;
      padding-inline: var(--space-1);
    }
  }
  .hl-delta.trend-good {
    color: var(--color-fresh);
  }
  .hl-delta.trend-bad {
    color: var(--color-urgent);
  }
  .on-this-day {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
  }
  .on-this-day > :global(.icon) {
    width: 1.75rem;
    height: 1.75rem;
    color: var(--color-accent);
  }
  .on-this-day :global(.otd-title) {
    margin: 0;
    font-family: inherit;
    font-weight: 400;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
  .otd-rating {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-accent);
  }
  .feed :global(h3.month) {
    margin: var(--space-4) 0 var(--space-1);
    font-size: 1rem;
  }
  /* Timeline ruler (feedback M1): the feed's months scaled onto a fixed length, newest first.
     Phones: a sticky strip across the panel; from 700px a sticky bar beside the feed, the
     viewport's height under the filter bar. Ticks sit at --p (0..1) along the track. */
  .ruler {
    position: sticky;
    top: var(--bar-h);
    z-index: 2;
    margin: var(--space-3) calc(-1 * var(--space-4)) 0;
    padding: var(--space-1) 2.5rem 0;
    overflow: hidden;
    cursor: pointer;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }
  .track {
    position: relative;
    height: 46px;
    border-top: 2px solid var(--color-border);
  }
  .tick {
    position: absolute;
    top: -2px;
    left: calc(var(--p) * 100%);
    translate: -50% 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* A 44px phone tap target, wide enough for its label. */
    min-width: 44px;
    width: max-content;
    height: 44px;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
  }
  .tick::before {
    content: '';
    flex-shrink: 0;
    width: 1px;
    height: 0.4rem;
    background: currentColor;
  }
  .tick.major::before {
    width: 2px;
    height: 0.7rem;
  }
  .tick span {
    font-size: 0.75rem;
    line-height: 1.3;
    white-space: nowrap;
  }
  .tick:hover,
  .tick[aria-current] {
    color: var(--color-accent);
  }
  .tick[aria-current] span {
    font-weight: 700;
  }
  /* Sub-ticks: a repeating hairline every 1/--subs of the track, so they fall between (and on)
     the month ticks at the band centers (2 or 4 a month: even, so they line up). */
  .track.subs {
    --sub: color-mix(in srgb, var(--color-text-muted) 55%, transparent);
    background: linear-gradient(to right, var(--sub) 1px, transparent 1px) 0 0 / calc(100% / var(--subs)) 0.3rem repeat-x;
  }
  /* Where the view is: a slim fixed-size thumb centered on the feed's visible top, in a wider grab
     area (44px on phones; 28px tall beside the feed). A press anywhere on the ruler scrubs, so
     grabbing the thumb's center doesn't move it. */
  .band {
    position: absolute;
    top: calc(-1 * var(--space-1));
    bottom: 0;
    left: calc(var(--a) * 100%);
    translate: -50% 0;
    width: 44px;
    cursor: grab;
  }
  .band::before {
    content: '';
    position: absolute;
    inset: 0 calc(50% - 5px);
    box-sizing: border-box;
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
    border: 2px solid color-mix(in srgb, var(--color-accent) 75%, transparent);
    border-radius: 3px;
  }
  .ruler {
    user-select: none;
    touch-action: pan-y; /* the strip scrubs sideways; vertical swipes still scroll the page */
  }
  @media (max-width: 699px) {
    .feed :global(h3.month) {
      scroll-margin-top: 3.5rem; /* clear the sticky strip on a jump */
    }
  }
  @media (min-width: 700px) {
    .timeline {
      display: grid;
      grid-template-columns: 6.5rem minmax(0, 1fr);
      gap: var(--space-4);
    }
    .timeline.no-ruler {
      grid-template-columns: minmax(0, 1fr);
    }
    .no-ruler .ruler {
      display: none;
    }
    .ruler {
      top: calc(var(--bar-h) + var(--space-3));
      align-self: start;
      box-sizing: border-box;
      height: calc(100vh - var(--bar-h) - 2 * var(--space-3));
      margin: var(--space-4) 0 0;
      padding: var(--space-3) 0;
      overflow: visible;
      background: none;
      border: 0;
    }
    .track {
      height: 100%;
      border-top: 0;
      border-left: 2px solid var(--color-border);
    }
    .tick {
      top: calc(var(--p) * 100%);
      left: -2px;
      translate: 0 -50%;
      flex-direction: row;
      min-width: 0;
      height: 1.25rem;
    }
    .tick::before {
      width: 0.4rem;
      height: 1px;
    }
    .tick.major::before {
      width: 0.7rem;
      height: 2px;
    }
    .tick span {
      margin-left: 0.35rem;
    }
    .ruler {
      touch-action: none;
    }
    .track.subs {
      background: linear-gradient(to bottom, var(--sub) 1px, transparent 1px) 0 0 / 0.3rem calc(100% / var(--subs)) repeat-y;
    }
    .band {
      top: calc(var(--a) * 100%);
      bottom: auto;
      left: -0.6rem;
      right: 0;
      translate: 0 -50%;
      width: auto;
      height: 28px;
    }
    .band::before {
      inset: calc(50% - 5px) 0;
    }
  }
  .milestone-feed {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .milestone-feed li {
    display: grid;
    /* The date sits beside the title (not across the panel from it on wide screens). */
    grid-template-columns: 2rem 3.25rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3);
    min-height: 3rem;
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
  }
  .kind-icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: var(--kind);
    background: color-mix(in srgb, var(--kind) 14%, var(--color-surface));
  }
  .kind-icon :global(.icon) {
    width: 1.1rem;
    height: 1.1rem;
  }
  .who {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }
  .who > *,
  .who small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ev-title {
    font-weight: 600;
  }
  .who small {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
  time {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    width: 100%;
    height: 0.5rem;
    margin-top: var(--space-2);
    border-radius: 999px;
    background: var(--color-border);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--color-accent);
  }
</style>
