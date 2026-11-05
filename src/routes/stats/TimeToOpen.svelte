<script lang="ts">
  import type { Snippet } from 'svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { SAMPLE_HELP } from '$lib/sample';
  import LabHead from './LabHead.svelte';
  import type { TimeToOpen, Wait } from '$lib/server/insights/freshness';

  let { t, placeTip, foot }: { t: TimeToOpen; placeTip: (e: ToggleEvent) => void; foot?: Snippet } = $props();

  const days = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} days`;
  const bags = (n: number) => `${n} bag${n === 1 ? '' : 's'}`;
</script>

{#snippet figure(title: string, w: Wait, sub: string)}
  <div class="fig">
    <span class="fig-title">{title}</span>
    <strong class="fig-val" class:small-sample={w.sample.small}>{w.median === null ? '—' : days(w.median)}</strong>
    <span class="fig-sub">{sub} · {bags(w.n)}{#if w.sample.small}&nbsp;<SampleNote s={w.sample} />{/if}</span>
  </div>
{/snippet}
{#snippet list(title: string, rows: TimeToOpen['byRoaster'])}
  <div class="list">
    <h3>{title}</h3>
    <ul>
      {#each rows as r (r.key)}
        <li class:small-sample={r.sample.small}><span class="k">{r.key}</span><span class="v">{r.median === null ? '—' : days(r.median)}</span><span class="n">{bags(r.n)}</span>
          {#if r.sample.small}<SampleNote s={r.sample} />{/if}</li>
      {/each}
    </ul>
  </div>
{/snippet}

<section class="chart-panel" data-section="consumption-time-to-open">
  <LabHead id="consumption-time-to-open" title="Time to open" {placeTip}
    help={['Median days from roast to the first brew (freezer days not counted), for bags first brewed this period.', 'Open to finished: the first to the last brew, for bags finished this period.', 'The first brew is the open day.', '', SAMPLE_HELP]} />
  <div class="figs">
    {@render figure('Roast to open', t.toOpen, 'median')}
    {@render figure('Open to finished', t.daysOpen, 'median')}
  </div>
  {#if t.byRoaster.length}
    <div class="lists">{@render list('By roaster', t.byRoaster)}{@render list('By process', t.byProcess)}</div>
  {/if}
  {@render foot?.()}
</section>

<style>
  .figs, .lists {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
  }
  .lists {
    margin-top: var(--space-4);
  }
  .fig {
    display: grid;
    gap: var(--space-1);
  }
  .fig-title, .fig-sub {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .fig-val {
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
  }
  h3 {
    margin: 0 0 var(--space-2);
    font-size: 0.95rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* One grid per list, rows on its columns (subgrid), so a row with no chip still lines up with one that has it. */
  .list ul {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
  }
  .list ul li {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
  }
  .list li {
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
    font-variant-numeric: tabular-nums;
  }
  .list li:first-child {
    border-top: 0;
  }
  .k {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .n {
    color: var(--color-text-muted);
    min-width: 4.5rem;
    text-align: right;
  }
</style>
