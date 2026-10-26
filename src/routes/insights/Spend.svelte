<script lang="ts" module>
  import type { SpendTab } from '$lib/server/insights/spend';
  import type { JumpLink } from './JumpNav.svelte';
  // Each panel task adds its section here.
  export function jumpLinks(t: SpendTab): JumpLink[] {
    return [t.tiles.bags > 0 && ['spend-chart', 'Spend over time'], t.valueMap.points.length > 0 && ['spend-value-map', 'Value map'], t.valueMap.points.length > 0 && ['spend-best-value', 'Best value'], t.reportCard.length > 0 && ['spend-report-card', 'Roaster report card'], t.discovery.cumulative.length > 1 && ['spend-discovery', 'Roaster discovery'], t.discovery.share !== null && ['spend-share', 'Share of spend'], t.tiles.bags > 0 && ['spend-subscriptions', 'Subscriptions']];
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState, RcCol, SpendSeries, Top } from '$lib/insightsUrl';
  import Chart from '$lib/components/Chart.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import { SAMPLE_HELP } from '$lib/sample';
  import { usd, usdPrecise, wholeUsd } from '$lib/money';
  import LabHead from './LabHead.svelte';
  import ValueMap from './ValueMap.svelte';
  import ReportCard from './ReportCard.svelte';
  import PlanPanel from './PlanPanel.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import StackedBars from './StackedBars.svelte';
  import { fitPairs } from './fitPairs';

  let { t, choose, tiles, spendView, spendSeries, rcSort, rcDir, rcTop, compareLabel, compareDates, link, placeTip }: {
    t: SpendTab; choose: (c: InsightsUrlState) => void; tiles: Snippet; spendView?: 'ppg'; spendSeries?: SpendSeries; rcSort?: RcCol; rcDir?: 'asc' | 'desc'; rcTop?: Top;
    placeTip: (e: ToggleEvent) => void;
    compareLabel: string; compareDates: string; link: (href: string) => string;
  } = $props();

  const empty = $derived(t.tiles.bags === 0);
  const emptyLine = useEmptyLine();

  const sr = $derived(t.series);
  const ppg = $derived(spendView === 'ppg');
  // The series selector: Overall, the split (default), One-off, Subscription, or All (overall beside the split).
  type Kind = 'oneOff' | 'sub' | 'overall';
  const SERIES_OPTIONS: readonly (readonly [SpendSeries | 'split', string])[] = [['overall', 'Overall'], ['split', 'One-off vs sub'], ['oneoff', 'One-off'], ['sub', 'Subscription'], ['all', 'All']];
  const NAME: Record<Kind, string> = { oneOff: 'One-off', sub: 'Subscription', overall: 'Overall' };
  // One color per entity in every view (ui-rules 42: color follows the entity): light, medium and dark brown.
  const TONE: Record<Kind, string> = { oneOff: 'var(--series-brown-1)', sub: 'var(--series-brown-2)', overall: 'var(--series-brown-3)' };
  const kinds = $derived<Kind[]>(spendSeries === 'overall' ? ['overall'] : spendSeries === 'oneoff' ? ['oneOff'] : spendSeries === 'sub' ? ['sub'] : spendSeries === 'all' ? ['oneOff', 'sub', 'overall'] : ['oneOff', 'sub']);
  const sum = (a: (number | null)[], b: (number | null)[]) => a.map((v, i) => (v ?? 0) + (b[i] ?? 0));
  type Series = { label: string; values: (number | null)[]; faded?: boolean; dashed?: boolean; names?: (string | null)[]; hue?: string; stack?: string };
  // The chart's datasets for the selection: the current window's series, then the compare window's, each in its own entity's hue.
  function plan(cur: Record<Kind, (number | null)[]>, cmp: Record<Kind, (number | null)[]> | null, avg: Record<Kind, number | null> | null, dashed: boolean) {
    const one = kinds.length === 1;
    const own = kinds.map((k): Series => ({ label: NAME[k], values: cur[k], ...(k === 'overall' && !one ? { stack: 'overall' } : {}) }));
    const past: Series[] = cmp
      ? kinds.flatMap((k) => (cmp[k].some((v) => v) ? [{ label: one ? compareLabel : `${compareLabel} · ${NAME[k]}`, values: cmp[k], hue: TONE[k], names: sr.compareTitles ?? undefined,
        ...(dashed ? { dashed: true } : { faded: true, ...(k === 'overall' && !one ? { stack: 'compare-overall' } : {}) }) }] : []))
      : avg ? [(() => { const k: Kind = spendSeries === 'oneoff' ? 'oneOff' : spendSeries === 'sub' ? 'sub' : 'overall';
          return { label: `${compareLabel} (avg)`, values: sr.labels.map(() => avg[k]), dashed: true, hue: TONE[k], names: sr.labels.map(() => compareDates) }; })()] : [];
    return { first: own[0], rest: [...own.slice(1), ...past], colors: [...kinds.map((k) => TONE[k]), ...past.filter((x) => !x.dashed).map((x) => x.hue!)] };
  }
  const total = $derived(sum(sr.sub, sr.oneOff));
  const bars = $derived(plan(
    { oneOff: sr.oneOff, sub: sr.sub, overall: total },
    sr.compareSplit ? { oneOff: sr.compareSplit.oneOff, sub: sr.compareSplit.sub, overall: sr.compare ?? [] } : null,
    sr.compareAverageSplit ? { oneOff: sr.compareAverageSplit.oneOff, sub: sr.compareAverageSplit.sub, overall: sr.compareAverage } : null, false));
  const lines = $derived(plan(
    { oneOff: sr.ppg.oneOff, sub: sr.ppg.sub, overall: sr.ppg.all },
    sr.comparePpgSplit ? { oneOff: sr.comparePpgSplit.oneOff, sub: sr.comparePpgSplit.sub, overall: sr.comparePpg ?? [] } : null, null, true));
  // Money axis: whole dollars when any amount shown (either window, any series) is $1,000 or more.
  const amounts = $derived([...total, ...(sr.compare ?? []), sr.compareAverage]);
  const whole = $derived(wholeUsd(amounts));
  const money = (v: number) => usd(v, whole);
  const perG = (v: number) => `${usd(v)}/g`;
  const perGTip = (v: number) => `${usdPrecise(v) ?? usd(v)}/g`;
  const noPrice = $derived(sr.ppg.all.every((v) => v === null));
  // Two lines, the second blank when there is no suffix, so switching the view never moves the page.
  const note = $derived(`${ppg ? `$ per g in each ${sr.by}` : `$ per ${sr.by}`} · counted by roast date`);
  const vm = $derived(t.valueMap);
  const cutTip = $derived({
    title: 'Not shown', rows: vm.cut.map((p): [string, string] => [p.name, `${usdPrecise(p.ppg) ? usdPrecise(p.ppg) : usd(p.ppg)}/g`])
  });
  const dc = $derived(t.discovery);
  const partial = $derived(sr.partial ? `* partial ${sr.by}` : '\u00a0');
</script>

{@render tiles()}

<!-- Nothing bought in the period: one short line, not blank panels (rule 28). Later panels sit in the else branch. -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No bags bought in this period.')}</p></section>
{:else}
  <section class="chart-panel">
    <div class="chart-panel-header">
      <HeadingAnchor id="spend-chart">Spend over time</HeadingAnchor>
      <div class="chart-ctls">
        <select class="ctl-select" aria-label="Series" value={spendSeries ?? 'split'} onchange={(e) => { const v = e.currentTarget.value; choose({ spendSeries: v === 'split' ? undefined : (v as SpendSeries) }); }}>
          {#each SERIES_OPTIONS as [v, name] (v)}<option value={v}>{name}</option>{/each}
        </select>
        <ChartToggle label="Show" options={[['spend', 'Spend'], ['ppg', '$ per g']]} value={ppg ? 'ppg' : 'spend'} pick={(v) => choose({ spendView: v === 'ppg' ? 'ppg' : undefined })} />
      </div>
    </div>
    {#if ppg && noPrice}
      <p class="hl-empty">{emptyLine('No priced bags in this period.')}</p>
    {:else if ppg}
      <Chart type="line" labels={sr.labels} values={lines.first.values} datasetLabel={lines.first.label} legend dashGaps format={perG} tickFormat={(v) => usd(v)} tipFormat={perGTip} titles={sr.titles}
        series={lines.rest} colors={lines.colors} height={260} />
    {:else}
      <Chart type="bar" vertical stacked labels={sr.labels} values={bars.first.values} datasetLabel={bars.first.label} legend format={money} tickFormat={money} tipFormat={(v) => usd(v, false)} titles={sr.titles}
        series={bars.rest} colors={bars.colors} height={260} />
    {/if}
    <p class="chart-note" data-switched-note>{note}<br>{partial}</p>
    <p class="chart-note">By roaster or coffee: <a href={link('/insights?tab=leaderboards&rank=spend&chart=leaderboard-roasters#leaderboard-roasters')}>Leaderboards</a></p>
  </section>

  {#if vm.points.length}
    <!-- The map beside the top 5 (one height, rule 37); stacked on a narrow page. -->
    <div class="insights-charts value-pair" use:fitPairs={vm}>
      <section class="chart-panel" data-section="spend-value-map">
        <LabHead id="spend-value-map" title="Value map" {placeTip}
          cut={vm.cut.length && vm.cap !== null ? { lead: `Only coffees up to ${usd(vm.cap)}/g are shown.`, tip: cutTip } : undefined}
          help={['One dot per coffee: its price per gram against its rating this period.', 'A diamond: a subscription coffee.', 'Dashed lines: the median price and rating.', 'Top left, the great-value corner: cheap and well rated.', '', SAMPLE_HELP]} />
        <div class="fit-body"><ValueMap m={vm} {link} /></div>
      </section>
      <section class="chart-panel" data-section="spend-best-value">
        <LabHead id="spend-best-value" title="Best value" {placeTip}
          help={['Rating divided by price per 100 g, the Records formula.', 'Coffees with 4+ rated brews this period, best first.']} />
        <div class="fit-body">
          {#if vm.best.length}
            <ol class="board-rows best-rows" style:--rows={vm.best.length} style:--row-h="3rem">
              {#each vm.best as p, i (p.key)}
                <li class="board-row">
                  <span class="rank">{i + 1}</span>
                  <span class="who">
                    {#if p.slug}<a href={link(`/coffees/${p.slug}`)}><CoffeeName text={p.name} /></a>{:else}<span class="name"><CoffeeName text={p.name} /></span>{/if}
                    <small>{p.roaster}</small>
                  </span>
                  <span class="val">{usd(p.ppg)}/g · {p.mean.toFixed(1)}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="hl-empty">{emptyLine('No rated coffees in this period.')}</p>
          {/if}
        </div>
      </section>
    </div>
  {/if}

  {#if t.reportCard.length}
    <section class="chart-panel" data-section="spend-report-card">
      <div class="chart-panel-header"><HeadingAnchor id="spend-report-card">Roaster report card</HeadingAnchor></div>
      <ReportCard rows={t.reportCard} sort={rcSort} dir={rcDir} top={rcTop} {choose} {link} />
    </section>
  {/if}

  {#if dc.cumulative.length > 1}
    <section class="chart-panel" data-section="spend-discovery">
      <LabHead id="spend-discovery" title="Roaster discovery" {placeTip}
        help={['Roasters you have bought from, added up over all your history.', 'The shaded stretch is this period.', 'Repeat-buy rate: the share of this period\'s roasters you have bought 2 or more bags from by its end.']}>
        {#if dc.repeatRate !== null}<span class="repeat">Repeat-buy rate <strong>{Math.round(100 * dc.repeatRate)}%</strong> · of {dc.roasters} roasters</span>{/if}
      </LabHead>
      <Chart type="line" labels={dc.labels} values={dc.cumulative} datasetLabel="Roasters" titles={dc.titles} integer yMin={0} nearestX band={dc.band ?? undefined}
        format={(v) => `${v}`} height={220} />
    </section>
  {/if}

  {#if dc.share}
    <section class="chart-panel" data-section="spend-share">
      <LabHead id="spend-share" title="Share of spend" {placeTip}
        help={['Each bar is 100% of what you spent in that ' + sr.by + ', split by roaster.', 'Roasters with bags in 2+ bars are named, up to 14, biggest spend this period first.', 'The rest are Other.', 'Counted by roast date.']} />
      <StackedBars m={dc.share} ariaLabel="Share of spend by roaster each {sr.by}" />
    </section>
  {/if}

  <section class="chart-panel" data-section="spend-subscriptions">
    <LabHead id="spend-subscriptions" title="Subscriptions" {placeTip}
      help={['Each plan\'s price per month, and what its bags bought this period cost per gram and scored, against your one-off bags.', 'The line on a bar is the one-off $/g. Lower $/g is better; a plan that has bought no bags shows its price only.', 'Paused plans are left out of the monthly total.', '', SAMPLE_HELP]} />
    {#if t.plans.rows.length}
      <PlanPanel p={t.plans} {link} />
    {:else}
      <p class="hl-empty">{emptyLine('No subscriptions yet.')} <a href={link('/subscriptions')}>Manage plans</a></p>
    {/if}
  </section>
{/if}

<style>
  .chart-ctls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .repeat {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .repeat strong {
    color: var(--color-text);
  }
  .value-pair > .chart-panel {
    display: flex;
    flex-direction: column;
  }
  /* Grow the rows to fill the card when the map beside it is taller. */
  .best-rows {
    display: grid;
    grid-auto-rows: minmax(var(--row-h), 1fr);
  }
  .best-rows .board-row {
    height: auto;
    grid-template-columns: 1.75rem minmax(0, 1fr) auto;
  }
  .best-rows .val {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
