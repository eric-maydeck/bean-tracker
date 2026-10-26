<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { SAMPLE_HELP } from '$lib/sample';
  import { useEmptyLine } from './coffeeNote';
  import LabHead from './LabHead.svelte';
  import type { Fresh, Wait } from '$lib/server/insights/spend';

  let { f, link, placeTip }: { f: Fresh; link: (href: string) => string; placeTip: (e: ToggleEvent) => void } = $props();
  const emptyLine = useEmptyLine();

  const days = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} days`;
  const bags = (n: number) => `${n} bag${n === 1 ? '' : 's'}`;
  const rated = $derived(f.byWait.filter((w) => w.rating !== null));
  // Rating axis floor, as Consumption's rating line.
  const floor = $derived(rated.length ? Math.max(0, Math.floor(Math.min(...rated.map((w) => w.rating!))) - 1) : undefined);
  const windowBrews = $derived(f.window.reduce((s, w) => s + w.brews, 0));
</script>

{#snippet figure(title: string, w: Wait, sub: string)}
  <div class="fig">
    <span class="fig-title">{title}</span>
    <strong class="fig-val" class:small-sample={w.sample.small}>{w.median === null ? '—' : days(w.median)}</strong>
    <span class="fig-sub">{sub} · {bags(w.n)}{#if w.sample.small}&nbsp;<SampleNote s={w.sample} />{/if}</span>
  </div>
{/snippet}
{#snippet list(title: string, rows: Fresh['byRoaster'])}
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

<section class="chart-panel" data-section="spend-time-to-open">
  <LabHead id="spend-time-to-open" title="Time to open" {placeTip}
    help={['Median days from roast to opening the bag (freezer days not counted), for bags opened this period.', 'Days open: from opening to the last brew, for bags finished this period.', 'Only bags with an opened date. The open day is the first brew when it came earlier.', '', SAMPLE_HELP]} />
  {#if f.toOpen.n === 0 && f.daysOpen.n === 0}
    <p class="hl-empty">{emptyLine('No bags with an opened date in this period.')}</p>
  {:else}
    <div class="figs">
      {@render figure('Roast to open', f.toOpen, 'median')}
      {@render figure('Open to finished', f.daysOpen, 'median')}
    </div>
    {#if f.byRoaster.length}
      <div class="lists">{@render list('By roaster', f.byRoaster)}{@render list('By process', f.byProcess)}</div>
    {/if}
  {/if}
</section>

<section class="chart-panel" data-section="spend-rating-by-wait">
  <LabHead id="spend-rating-by-wait" title="Rating by wait" {placeTip}
    help={['Adjusted rating of this period\'s brews, by the days a bag had rested at its first brew.', 'Freezer days are not counted.', 'It compares bags, not brews of one bag.', '', SAMPLE_HELP]} />
  {#if rated.length}
    <Chart type="bar" vertical labels={f.byWait.map((w) => w.label)} values={f.byWait.map((w) => w.rating)} datasetLabel="Rating" samples={f.byWait.map((w) => w.sample)}
      yMin={floor} format={(v) => v.toFixed(1)} tipFormat={(v, i) => `${v.toFixed(1)} · ${bags(f.byWait[i].bags)}`} height={220} />
    <p class="chart-note">Days off roast at the bag's first brew</p>
  {:else}
    <p class="hl-empty">{emptyLine('No rated brews with a roast date in this period.')}</p>
  {/if}
</section>

<section class="chart-panel" data-section="spend-rest-window">
  <LabHead id="spend-rest-window" title="Rest window" {placeTip}
    help={['The share of this period\'s brews made before, inside and after the roaster\'s rest window.', 'Each with its adjusted rating.', 'Brews of bags with no window are left out.', '', SAMPLE_HELP]} />
  {#if windowBrews === 0}
    <p class="hl-empty">{emptyLine('No brews with a rest window in this period.')}</p>
  {:else}
    <ul class="win">
      {#each f.window as w (w.label)}
        <li>
          <span class="k">{w.label}</span>
          <span class="track" role="img" aria-label="{Math.round(100 * w.share)}% of brews"><span class="bar" class:small-sample-mark={w.sample.small} style:width="{100 * w.share}%"></span></span>
          <span class="pct">{Math.round(100 * w.share)}%</span>
          <span class="rate" class:small-sample={w.sample.small}>{w.rating === null ? '—' : w.rating.toFixed(1)}</span>
          {#if w.sample.small}<SampleNote s={w.sample} />{/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="chart-note">{f.noWindow} brew{f.noWindow === 1 ? '' : 's'} without a rest window</p>
  <p class="chart-note">By rest day: <a href={link('/insights?tab=brewing&chart=brewing-rest#brewing-rest')}>Brewing lab</a></p>
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
  .list li, .win li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
    font-variant-numeric: tabular-nums;
  }
  .list li:first-child, .win li:first-child {
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
  .win .k {
    flex: none;
    width: 4rem;
  }
  .track {
    flex: 1;
    min-width: 3rem;
    height: 0.75rem;
    background: var(--color-surface-2, var(--color-border));
    border-radius: 4px;
    overflow: hidden;
  }
  .bar {
    display: block;
    height: 100%;
    background: var(--chart-color-1);
    border-radius: 0 4px 4px 0;
    position: relative;
  }
  .pct {
    min-width: 2.75rem;
    text-align: right;
  }
  .rate {
    min-width: 2rem;
    text-align: right;
  }
</style>
