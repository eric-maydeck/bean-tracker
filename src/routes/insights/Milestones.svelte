<script lang="ts">
  import Icon, { type IconName } from '$lib/components/Icon.svelte';
  import { KINDS, MON, type InsightsUrlState, type Kind } from '$lib/insightsUrl';
  import type { MilestonesTab } from '$lib/server/insights/milestones';
  import { rowVars } from './rows';

  let { m, kinds, choose }: { m: MilestonesTab; kinds: Kind[] | undefined; choose: (c: InsightsUrlState) => void } = $props();

  const LABEL: Record<Kind, string> = { counts: 'Counts', firsts: 'Firsts', bests: 'Bests', streaks: 'Streaks', gear: 'Gear', anniversaries: 'Anniversaries' };
  const ICON: Record<Kind, IconName> = { counts: 'hash', firsts: 'sparkle', bests: 'trophy', streaks: 'fire', gear: 'gear', anniversaries: 'cake' };
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = (ym: string) => `${FULL[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
  const day = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}`;
  const n = (v: number) => v.toLocaleString('en-US');

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
  // The navigator: years (newest first), each with its months that have milestones.
  let years = $derived(
    [...Map.groupBy(m.months.map((g) => g.month), (ym) => ym.slice(0, 4))]
  );

  // The navigator sticks just under the page's sticky filter bar.
  let barH = $state(0);
  $effect(() => {
    const bar = document.querySelector<HTMLElement>('.filter-bar');
    if (!bar) return;
    const ro = new ResizeObserver(() => (barH = bar.offsetHeight));
    ro.observe(bar);
    return () => ro.disconnect();
  });
</script>

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
  <h2>All-time totals</h2>
  <div class="hl-grid milestone-totals">
    {#each m.totals as t, i (t.key)}
      <div class="hl-card" style={totalVars[i]}>
        <span class="hl-value">{n(t.value)}{#if t.unit}<small>{`\u00a0${t.unit}`}</small>{/if}</span>
        <div class="hl-caption"><span class="stat-label">{t.label}</span></div>
      </div>
    {/each}
  </div>
</section>

<section class="chart-panel">
  <h2>Milestones</h2>
  <div class="hl-grid milestone-summary">
    {#each summary as s (s.key)}
      {@const d = s.prev === null ? null : s.value - s.prev}
      <div class="hl-card" style="--q4:3;--q3:3;--q2:3">
        <span class="hl-value">{n(s.value)}</span>
        {#if d !== null}
          <span class="hl-line hl-delta" class:trend-good={d > 0} class:trend-bad={d < 0}
            >{d === 0 ? 'No change' : `${d > 0 ? '▲' : '▼'} ${n(Math.abs(d))} from ${n(s.prev!)}`}</span
          >
        {/if}
        <div class="hl-caption"><span class="stat-label">{s.label}</span></div>
      </div>
    {/each}
  </div>

  {#if m.onThisDay}
    {@const o = m.onThisDay}
    <div class="on-this-day">
      <Icon name="cake" />
      <div class="who">
        <span class="otd-title">On this day a year ago</span>
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
    <div class="timeline" style:--bar-h="{barH}px">
      <nav class="timeline-nav" aria-label="Jump to month">
        {#each years as [y, yms] (y)}
          <div class="nav-year">
            <a class="year" href="#m-{yms[0]}">{y}</a>
            {#each yms as ym (ym)}<a href="#m-{ym}">{MON[+ym.slice(5, 7) - 1]}</a>{/each}
          </div>
        {/each}
      </nav>
      <div class="feed">
        {#each m.months as g (g.month)}
          <h3 class="month" id="m-{g.month}">{month(g.month)}</h3>
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
    <h2>Next up</h2>
    <div class="hl-grid next-up">
      {#each m.nextUp as u, i (u.key)}
        <div class="hl-card" style={nextVars[i]}>
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
          <div class="hl-caption"><span class="stat-label">{u.label}</span></div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
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
  /* ui-rules 17: on phones the chips share each line evenly. */
  @media (max-width: 640px) {
    .kind-chips button {
      flex: 1 1 auto;
      justify-content: center;
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
  .otd-title {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
  .otd-rating {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-accent);
  }
  .month {
    margin: var(--space-4) 0 var(--space-1);
    font-size: 1rem;
  }
  /* Timeline navigator (feedback B4): a sticky side bar beside the feed; on phones a sticky
     strip above it that scrolls sideways inside itself. Both stick just under the filter bar. */
  .timeline-nav {
    position: sticky;
    top: var(--bar-h);
    z-index: 2;
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    scrollbar-width: thin;
    margin: var(--space-3) calc(-1 * var(--space-4)) 0;
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }
  .nav-year {
    display: flex;
    gap: var(--space-1);
    white-space: nowrap;
  }
  .timeline-nav a {
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius);
    font-size: 0.85rem;
    text-decoration: none;
  }
  .timeline-nav a:hover {
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
  }
  .timeline-nav .year {
    font-weight: 700;
    color: var(--color-text);
  }
  @media (max-width: 699px) {
    .month {
      scroll-margin-top: 3.5rem; /* clear the sticky strip on a jump */
    }
  }
  @media (min-width: 700px) {
    .timeline {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-5);
    }
    .timeline-nav {
      top: calc(var(--bar-h) + var(--space-3));
      align-self: start;
      flex-direction: column;
      max-height: calc(100vh - var(--bar-h) - 2 * var(--space-3));
      overflow: auto;
      margin: var(--space-4) 0 0;
      padding: 0 var(--space-3) 0 0;
      border-bottom: 0;
      border-right: 1px solid var(--color-border);
    }
    .nav-year {
      flex-direction: column;
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
