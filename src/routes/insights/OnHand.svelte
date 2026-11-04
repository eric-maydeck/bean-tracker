<script lang="ts" module>
  import type { OnHandTab } from '$lib/server/insights/onHand';
  import type { JumpLink } from './JumpNav.svelte';
  const AGE_KEYS = ['before', 'inside', 'past', 'noWindow'] as const;
  const hasAge = (t: OnHandTab) => AGE_KEYS.some((k) => t.age.bags[k].some((n) => n > 0));
  const shelf = (t: OnHandTab) => t.tiles.bagsWaiting + t.tiles.frozenBags > 0 || Object.values(t.freshness).some((g) => typeof g === 'object' && g && g.count > 0);
  export function jumpLinks(t: OnHandTab): JumpLink[] {
    return [['onhand-runway-at-your-pace', 'Runway at your pace'], shelf(t) && ['onhand-freshness', 'Freshness now'], shelf(t) && ['onhand-bag-states', 'Bag states'], hasAge(t) && ['onhand-age', 'Age profile'], t.tiles.bagsWaiting > 0 && ['onhand-waiting', "What's waiting"]];
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useEmptyLine } from './coffeeNote';
  import { formatGrams } from '$lib/grams';
  import LabHead from './LabHead.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import type { FreshGroup } from '$lib/server/insights/onHand';
  import Chart from '$lib/components/Chart.svelte';
  import ChartToggle from './ChartToggle.svelte';
  import { holdHeight } from '$lib/holdHeight';
  import { WAIT_BYS, type InsightsUrlState, type Unit, type WaitBy } from '$lib/insightsUrl';
  import type { Tip } from '$lib/components/TipBody.svelte';

  let { t, tiles, runway, link, placeTip, unit, waitBy, choose }: {
    unit: Unit; waitBy?: WaitBy; choose: (c: InsightsUrlState) => void;
    t: OnHandTab; tiles: Snippet; runway: Snippet; link: (href: string) => string; placeTip: (e: ToggleEvent) => void;
  } = $props();
  const emptyLine = useEmptyLine();

  const CAP = 5;
  const GROUPS = $derived<[string, FreshGroup][]>([
    ['Ready', t.freshness.ready], ['Drink soon', t.freshness.drinkSoon], ['Still resting', t.freshness.resting], ['In the freezer', t.freshness.frozen]
  ]);
  // Age profile: waiting bags by days since roast, split by where that age sits in the roaster's rest window.
  const AGE_SERIES = [['before', 'Before rest window'], ['inside', 'In rest window'], ['past', 'Past rest window'], ['noWindow', 'No rest window']] as const;
  // The series' palette slots: Past rest window takes a red slot, clearly apart from the purple of In rest window.
  const AGE_TOKENS = ['--series-1', '--series-2', '--series-10', '--series-4'] as const;
  const ageLink = (s: number, i: number) => {
    return { href: link(t.age.links[AGE_SERIES[s][0]][i]), label: 'See coffees' };
  };
  const waitLink = (_s: number, i: number) => (rows[i].href ? { href: link(rows[i].href!), label: 'See coffees' } : null);
  const grams = $derived(unit === 'grams');
  const split = $derived(grams ? t.age.grams : t.age.bags);
  const ageFmt = $derived((v: number) => (grams ? formatGrams(v) : `${+v.toFixed(1)} bag${v === 1 ? '' : 's'}`));
  const ageTip = $derived((i: number): Tip => {
    const rows = AGE_SERIES.map(([k, name]): [string, string] => [name, ageFmt(split[k][i])]);
    const total = AGE_SERIES.reduce((a, [k]) => a + split[k][i], 0);
    return { title: `${t.age.labels[i]} days since roast`, rows: [...rows, ['Total', ageFmt(total)]], marks: [...AGE_SERIES.map((_, j) => ({ color: `var(${AGE_TOKENS[j]}-ink)` })), null] };
  });
  // Bag states: every open and backlog bag in one state (a freeze beats open/waiting), counted in bags or grams.
  const STATES = [['open', 'Open'], ['waiting', 'Unopened'], ['frozen', 'Frozen']] as const;
  const stateVals = $derived(STATES.map(([k]) => (grams ? t.states[k].grams : t.states[k].bags)));
  // What's waiting: backlog grams grouped by roaster, origin, process or roast level.
  const by = $derived(waitBy ?? 'roaster');
  const rows = $derived(t.waiting.by[by]);
  const BY_LABEL: Record<WaitBy, string> = { roaster: 'Roaster', origin: 'Origin', process: 'Process', roast: 'Roast', caffeine: 'Caffeine' };
  let waitPanel = $state<HTMLElement>();
  const empty = $derived(!shelf(t) && t.freshness.unknown === 0);
</script>

{@render tiles()}

{@render runway()}

<section class="chart-panel" data-section="onhand-freshness">
  <LabHead id="onhand-freshness" title="Freshness now" {placeTip}
    help={['Open and backlog bags by where they sit in the roaster\'s rest window today.', 'Ready: past the minimum rest.', 'Drink soon: ready, and nearing the end of the window (urgency 40+).', 'Still resting: not yet at the minimum rest.', 'In the freezer: frozen with no thaw date, so paused.']} />
  {#if empty}
    <p class="hl-empty">{emptyLine('Nothing on the shelf.')}</p>
  {:else}
    <div class="cards fresh">
      {#each GROUPS as [name, g] (name)}
        <div class="oh-card">
          <span class="k">{name}</span>
          <strong class="big">{g.count}<small>{` bag${g.count === 1 ? '' : 's'}`}</small></strong>
          <span class="sub">{g.count ? formatGrams(g.grams) : 'None right now'}</span>
          {#if g.bags.length}
            <ul>
              {#each g.bags.slice(0, CAP) as b (b.slug ?? b.name)}
                <li>{#if b.slug}<a href={link(`/coffees/${b.slug}`)}><CoffeeName text={b.name} /></a>{:else}<CoffeeName text={b.name} />{/if}<small>{b.roaster}</small></li>
              {/each}
            </ul>
            {#if g.bags.length > CAP && g.href}
              <a class="more" href={link(g.href)}>and {g.bags.length - CAP} more</a>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
    {#if t.freshness.nextReadyInDays !== null}
      <p class="chart-note">Next bag ready in {t.freshness.nextReadyInDays} day{t.freshness.nextReadyInDays === 1 ? '' : 's'}</p>
    {/if}
    {#if t.freshness.unknown}
      <p class="chart-note">{t.freshness.unknown} bag{t.freshness.unknown === 1 ? '' : 's'} without a roast date or rest window not counted</p>
    {/if}
  {/if}
</section>

{#if shelf(t)}
  <section class="chart-panel" data-section="onhand-bag-states">
    <LabHead id="onhand-bag-states" title="Bag states" {placeTip}
      help={['Open and backlog bags by state.', 'Open: opened, not frozen.', 'Unopened: waiting in the backlog, not frozen.', 'Frozen: frozen with no thaw date, whether opened or not.', 'Per person divides grams, not bags.']}>
      <ChartToggle label="Unit" options={[['grams', 'Grams'], ['bags', 'Bags']]} value={unit} pick={(v) => choose({ unit: v })} />
    </LabHead>
    <Chart type="bar" labels={STATES.map(([, n]) => n)} values={stateVals} datasetLabel={grams ? 'Grams' : 'Bags'} format={ageFmt}
      tipFormat={(v, i) => `${ageFmt(v)} · ${grams ? `${t.states[STATES[i][0]].bags} bag${t.states[STATES[i][0]].bags === 1 ? '' : 's'}` : formatGrams(t.states[STATES[i][0]].grams)}`}
      label="Bag states" height={STATES.length * 40 + 24} />
    <p class="chart-note">Open, unopened and frozen bags on the shelf</p>
  </section>
{/if}

{#if hasAge(t)}
  <section class="chart-panel" data-section="onhand-age">
    <LabHead id="onhand-age" title="Age profile" {placeTip}
      help={['Waiting bags by days since roast, minus freezer days.', 'Each bar splits by where that age sits in the roaster\'s rest window.', 'Bags with no roast date are left out.', 'Per person divides grams, not bags.']}>
      <ChartToggle label="Unit" options={[['grams', 'Grams'], ['bags', 'Bags']]} value={unit} pick={(v) => choose({ unit: v })} />
    </LabHead>
    <Chart type="bar" vertical stacked labels={t.age.labels} values={split.before} datasetLabel={AGE_SERIES[0][1]} legend format={ageFmt} tickFormat={ageFmt} tipOf={ageTip}
      series={AGE_SERIES.slice(1).map(([k, name]) => ({ label: name, values: split[k] }))} colors={AGE_TOKENS.map((k) => `var(${k})`)} tipLink={ageLink} label="Age profile" height={260} />
    <p class="chart-note">Waiting bags by days since roast, minus freezer days</p>
    <p class="chart-note">On hand over time: <a href={link('/insights?tab=consumption&chart=consumption-chart-on-hand#consumption-chart-on-hand')}>Consumption</a></p>
  </section>
{/if}

{#if t.tiles.bagsWaiting > 0}
  <section class="chart-panel" data-section="onhand-waiting" bind:this={waitPanel}>
    <LabHead id="onhand-waiting" title="What's waiting" {placeTip}
      help={['Grams in unopened (backlog) bags, grouped.', 'The number in brackets is the bags.', 'Biggest first: the top 10, then Other.', 'Per person divides grams, not bags.']}>
      <ChartToggle label="Group by" options={WAIT_BYS.map((k) => [k, BY_LABEL[k]] as const)} value={by} pick={(v) => (holdHeight(waitPanel), choose({ waitBy: v === 'roaster' ? undefined : v }))} />
    </LabHead>
    <Chart type="bar" labels={rows.map((r) => `${r.label} (${r.bags})`)} values={rows.map((r) => r.grams)} datasetLabel="Grams waiting" format={formatGrams}
      tipFormat={(v, i) => `${formatGrams(v)} · ${rows[i].bags} bag${rows[i].bags === 1 ? '' : 's'}`} tipLink={waitLink} label="What's waiting" height={rows.length * 32 + 24} />
    <p class="chart-note">Subscription {formatGrams(t.waiting.sub)} · One-off {formatGrams(t.waiting.oneOff)}</p>
  </section>
{/if}

<style>
  /* Card grids fill their rows (ui-rules 33): 2 across, 4 on a wide panel; the runway is tiles. */
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    container-type: inline-size;
  }
  @container (min-width: 56rem) {
    .fresh {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .oh-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    min-width: 0;
  }
  .k, .sub {
    flex: none;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .big {
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
  }
  .big small {
    font-size: 0.9rem;
    font-weight: normal;
    color: var(--color-text-muted);
  }
  ul {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
  }
  li {
    display: flex;
    flex-direction: column;
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
    overflow-wrap: anywhere;
  }
  li small {
    color: var(--color-text-muted);
  }
  .more {
    font-size: 0.9rem;
  }

</style>
