<script lang="ts">
  import { shader, tipAt } from './Heatmap.svelte';

  let {
    days,
    text
  }: {
    days: { date: string; value: number | null }[];
    text: (v: number | null) => string;
  } = $props();

  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekday = (d: string) => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const dayLabel = (d: string) => `${WD[weekday(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`;

  // Up to a month: one grid. Longer: one mini grid per month.
  let blocks = $derived.by(() => {
    if (days.length <= 31) return [{ title: null, days }];
    const m = new Map<string, typeof days>();
    for (const d of days) m.set(d.date.slice(0, 7), [...(m.get(d.date.slice(0, 7)) ?? []), d]);
    return [...m].map(([k, ds]) => ({ title: `${MON[+k.slice(5) - 1]} ${k.slice(0, 4)}`, days: ds }));
  });
  let tone = $derived(shader(days.map((d) => d.value)));
  const shade = (v: number | null) => (v === 0 ? 'var(--map-low)' : tone(v));

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  const show = (e: Event) => {
    const el = (e.target as Element).closest('.cal-cell');
    tip = el ? tipAt(wrap!, el, el.getAttribute('aria-label')!) : null;
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
  class="brew-calendar"
  class:short={blocks[0].title === null}
  bind:this={wrap}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => e.key === 'Escape' && (tip = null)}
>
  {#each blocks as b (b.title)}
    <div class="month">
      {#if b.title}<h3>{b.title}</h3>{/if}
      <div class="grid">
        {#each WD as w (w)}<span class="wd">{b.title ? w[0] : w}</span>{/each}
        {#if b.days.length && weekday(b.days[0].date)}<span style:grid-column="span {weekday(b.days[0].date)}"></span>{/if}
        {#each b.days as d (d.date)}
          <div
            class="cal-cell"
            role="button"
            tabindex="0"
            aria-label="{dayLabel(d.date)} · {text(d.value)}"
            style:background={shade(d.value)}
            onfocus={show}
            onblur={() => (tip = null)}
          ></div>
        {/each}
      </div>
    </div>
  {/each}
  {#if tip}
    <div class="cell-tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>{tip.text}</div>
  {/if}
</div>

<style>
  .brew-calendar {
    position: relative;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: var(--space-3);
  }
  .brew-calendar.short {
    grid-template-columns: 1fr;
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }
  .wd {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-align: center;
  }
  .cal-cell {
    aspect-ratio: 1;
    border-radius: 2px;
    cursor: pointer;
  }
  /* A single month at full panel width: square cells would be huge, so a fixed row height. */
  .short .cal-cell {
    aspect-ratio: auto;
    height: 2.5rem;
  }
  .cal-cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .cell-tip {
    position: absolute;
    translate: -50% calc(-100% - 0.4rem);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }
  .cell-tip.below {
    translate: -50% 2.5rem;
  }
</style>
