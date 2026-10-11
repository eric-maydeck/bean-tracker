<script lang="ts">
  import { rove, shader, takeFocus, tipAt } from './Heatmap.svelte';

  let {
    days,
    text,
    cellHeight = '1.1rem',
    minCell = 16
  }: {
    days: { date: string; value: number | null }[];
    text: (v: number | null) => string;
    // Long ranges: a row of 7 cells per week column; lines wrap below `minCell` px per week.
    cellHeight?: string;
    minCell?: number;
  } = $props();

  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const t = (d: string) => Date.parse(d + 'T00:00:00Z') / 864e5;
  const weekday = (d: string) => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const dayLabel = (d: string) => `${WD[weekday(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`;

  let short = $derived(days.length <= 31);
  let w = $state(0);
  // Long ranges: week columns (Mon at top) that wrap into lines of equal length, so every
  // line fills the panel width (the last line is short by fewer weeks than there are lines).
  let lines = $derived.by(() => {
    if (short || !days.length) return [];
    const start = t(days[0].date) - weekday(days[0].date);
    const sparse: { date: string; value: number | null }[][] = [];
    for (const d of days) (sparse[Math.floor((t(d.date) - start) / 7)] ??= []).push(d);
    const weeks = Array.from(sparse, (wk) => wk ?? []);
    const fit = w ? Math.max(1, Math.floor((w - 32) / (minCell + 2))) : 27;
    const per = Math.ceil(weeks.length / Math.ceil(weeks.length / fit));
    return Array.from({ length: Math.ceil(weeks.length / per) }, (_, i) => weeks.slice(i * per, (i + 1) * per)).map((ws) => ({
      per,
      weeks: ws,
      // A month name over the week holding its 1st, and over the line's first week unless a
      // month starts within the next two (the names would collide).
      months: ws.map((wk, i) => {
        const first = wk.find((d) => d.date.endsWith('-01'));
        const lead = i === 0 && !ws.slice(1, 3).some((x) => x.some((d) => d.date.endsWith('-01')));
        const d = first ?? (lead ? wk[0] : undefined);
        return d ? MON[+d.date.slice(5, 7) - 1] : '';
      })
    }));
  });
  let tone = $derived(shader(days.map((d) => d.value)));

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  const show = (e: Event) => {
    const el = (e.target as Element).closest('.cal-cell');
    tip = el ? tipAt(wrap!, el, el.getAttribute('aria-label')!) : null;
  };
</script>

{#snippet cell(d: { date: string; value: number | null }, first: boolean, style = '')}
  <div
    class="cal-cell"
    class:none={d.value === null}
    role="button"
    tabindex={first ? 0 : -1}
    aria-label="{dayLabel(d.date)} · {text(d.value)}"
    style="background: {tone(d.value)}; {style}"
    onfocus={(e) => (takeFocus(e), show(e))}
    onblur={() => (tip = null)}
  ></div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="brew-calendar"
  class:short
  role="group"
  aria-label="Brew calendar"
  style:--cell-h={short ? '2.5rem' : cellHeight}
  bind:this={wrap}
  bind:clientWidth={w}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.cal-cell'))}
>
  {#if short}
    <div class="month">
      {#each WD as d (d)}<span class="wd">{d}</span>{/each}
      {#if days.length && weekday(days[0].date)}<span style:grid-column="span {weekday(days[0].date)}"></span>{/if}
      {#each days as d, i (d.date)}{@render cell(d, i === 0)}{/each}
    </div>
  {:else}
    {#each lines as l, li (li)}
      <div class="strip" style:--per={l.per}>
        {#each l.months as m, i (i)}{#if m}<span class="mon" style:grid-column={i + 2}>{m}</span>{/if}{/each}
        {#each ['Mon', 'Wed', 'Fri'] as d, i (d)}<span class="wd" style:grid-row={2 * i + 2}>{d}</span>{/each}
        {#each l.weeks as wk, i (i)}
          {#each wk as d (d.date)}
            {@render cell(d, li === 0 && d === days[0], `grid-column: ${i + 2}; grid-row: ${weekday(d.date) + 2}`)}
          {/each}
        {/each}
      </div>
    {/each}
  {/if}
  {#if tip}
    <div class="cell-tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>{tip.text}</div>
  {/if}
</div>

<style>
  .brew-calendar {
    position: relative;
    display: grid;
    gap: var(--space-3);
  }
  .month {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }
  .strip {
    display: grid;
    grid-template-columns: 2rem repeat(var(--per), minmax(0, 1fr));
    grid-template-rows: auto repeat(7, var(--cell-h));
    gap: 2px;
  }
  .wd,
  .mon {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-align: center;
  }
  .strip .wd {
    grid-column: 1;
    text-align: start;
    align-self: center;
  }
  .mon {
    grid-row: 1;
    text-align: start;
    white-space: nowrap;
    overflow: visible;
    width: 0;
  }
  .cal-cell {
    height: var(--cell-h);
    border-radius: 2px;
    cursor: pointer;
  }
  .cal-cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
