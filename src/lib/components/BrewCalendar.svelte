<script lang="ts">
  import { latestMonths, MAX_MONTHS } from '$lib/calendarMonths';
  import { MON, WEEKDAYS, weekday } from '$lib/insightsUrl';
  import FloatTip from './FloatTip.svelte';
  import TipBody from './TipBody.svelte';
  import { rove, shader, takeFocus } from './Heatmap.svelte';

  let {
    days,
    text,
    row
  }: {
    days: { date: string; value: number | null }[];
    text: (v: number | null) => string; // the cell's aria-label value
    row: (v: number | null) => [string, string]; // its tip row (ui-rules 36): label, value
  } = $props();
  let valueOf = $derived(new Map(days.map((d) => [d.date, d.value])));

  const dayLabel = (d: string) => `${WEEKDAYS[weekday(d)]}, ${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}`;

  let short = $derived(days.length <= 31);
  let w = $state(0);
  let latest = $derived(latestMonths(days));
  let monthRows = $derived.by(() => {
    if (short) return [];
    const m = new Map<string, typeof days>();
    for (const d of latest.days) {
      const k = d.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    }
    const all = [...m].map(([k, ds]) => ({ title: `${MON[+k.slice(5) - 1]} ${k.slice(0, 4)}`, days: ds }));
    // Prefer a month count per row that divides the months (full rows), else balance the rows.
    const fit = w ? Math.max(1, Math.floor(w / 128)) : 4;
    const per = [fit, fit - 1].find((p) => p > 0 && all.length % p === 0) ?? Math.ceil(all.length / Math.ceil(all.length / fit));
    return Array.from({ length: Math.ceil(all.length / per) }, (_, i) => all.slice(i * per, (i + 1) * per));
  });
  let tone = $derived(shader(latest.days.map((d) => d.value)));

  let tip = $state<Element | null>(null); // the open tip's cell
  const show = (e: Event) => (tip = (e.target as Element).closest('.cal-cell'));
</script>

{#snippet cell(d: { date: string; value: number | null }, first: boolean)}
  <div
    class="cal-cell"
    class:none={d.value === null}
    role="button"
    tabindex={first ? 0 : -1}
    aria-label="{dayLabel(d.date)} · {text(d.value)}"
    data-date={d.date}
    style="background: {tone(d.value)}"
    onfocus={(e) => (takeFocus(e), show(e))}
    onblur={() => (tip = null)}
  ></div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="brew-calendar"
  role="group"
  aria-label="Brew calendar"
  style:--cell-h={short ? '2.5rem' : '1.1rem'}
  bind:clientWidth={w}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.cal-cell'))}
>
  {#if short}
    <div class="month">
      {#each WEEKDAYS as d (d)}<span class="wd">{d}</span>{/each}
      {#if days.length && weekday(days[0].date)}<span style:grid-column="span {weekday(days[0].date)}"></span>{/if}
      {#each days as d, i (d.date)}{@render cell(d, i === 0)}{/each}
    </div>
  {:else}
    {#each monthRows as row, ri (ri)}
      <div class="month-row">
        {#each row as b (b.title)}
          <div class="mini">
            <h3>{b.title}</h3>
            <div class="month">
              {#each WEEKDAYS as d (d)}<span class="wd">{d[0]}</span>{/each}
              {#if weekday(b.days[0].date)}<span style:grid-column="span {weekday(b.days[0].date)}"></span>{/if}
              {#each b.days as d (d.date)}{@render cell(d, d === latest.days[0])}{/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
  {#if !short && latest.cut}<p class="note">Latest {MAX_MONTHS} months — pick a custom range for earlier.</p>{/if}
  {#if tip}
    {@const date = (tip as HTMLElement).dataset.date!}
    <FloatTip anchor={tip} onclose={() => (tip = null)}><TipBody tip={{ title: dayLabel(date), rows: [row(valueOf.get(date) ?? null)] }} /></FloatTip>
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
  .month-row {
    display: flex;
    gap: var(--space-3);
  }
  .mini {
    flex: 1 1 0;
    min-width: 0;
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .wd {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-align: center;
  }
  .cal-cell {
    height: var(--cell-h);
    border-radius: 2px;
  }
  .cal-cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
