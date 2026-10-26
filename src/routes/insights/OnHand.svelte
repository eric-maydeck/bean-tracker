<script lang="ts" module>
  import type { OnHandTab } from '$lib/server/insights/onHand';
  import type { JumpLink } from './JumpNav.svelte';
  const shelf = (t: OnHandTab) => t.tiles.bagsWaiting + t.tiles.frozenBags > 0 || Object.values(t.freshness).some((g) => typeof g === 'object' && g && g.count > 0);
  // Each panel task adds its section here.
  export function jumpLinks(t: OnHandTab): JumpLink[] {
    return [['onhand-runway', 'Runway at your pace'], shelf(t) && ['onhand-freshness', 'Freshness now']];
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useEmptyLine } from './coffeeNote';
  import { formatGrams } from '$lib/grams';
  import LabHead from './LabHead.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import type { FreshGroup, Runway } from '$lib/server/insights/onHand';

  let { t, tiles, link, periodLabel, allTime, placeTip }: {
    t: OnHandTab; tiles: Snippet; link: (href: string) => string; periodLabel: string; allTime: boolean; placeTip: (e: ToggleEvent) => void;
  } = $props();
  const emptyLine = useEmptyLine();

  const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  // "last 12 months pace"; a custom window's dates stay as they are.
  const pace = $derived(allTime || /^[A-Z][a-z]{2} \d/.test(periodLabel) ? periodLabel : periodLabel.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()));
  const runs = $derived<[string, Runway][]>(allTime ? [['all-time', t.runwayAll]] : [[pace, t.runway], ['all-time', t.runwayAll]]);

  const CAP = 5;
  const GROUPS = $derived<[string, FreshGroup][]>([
    ['Ready', t.freshness.ready], ['Drink soon', t.freshness.drinkSoon], ['Still resting', t.freshness.resting], ['In the freezer', t.freshness.frozen]
  ]);
  const empty = $derived(!shelf(t) && t.freshness.unknown === 0);
</script>

{@render tiles()}

<section class="chart-panel" data-section="onhand-runway">
  <LabHead id="onhand-runway" title="Runway at your pace" {placeTip}
    help={['How long the backlog and open bags last at the grams a day you brew.', 'Once at the pace of the Period, once at your all-time pace.', 'Per person divides the daily grams.']} />
  <div class="cards runs" class:one={runs.length === 1}>
    {#each runs as [name, r] (name)}
      <div class="oh-card">
        <span class="k">At your {name} pace</span>
        <strong class="big">{r.days === null ? '—' : r.days.toLocaleString('en-US')}{#if r.days !== null}<small>{` day${r.days === 1 ? '' : 's'}`}</small>{/if}</strong>
        <span class="sub">{r.clearBy ? `runs out ${day(r.clearBy)}` : 'No brews to pace it'}{r.perDay === null ? '' : ` · ${formatGrams(r.perDay)} a day`}</span>
      </div>
    {/each}
  </div>
  <p class="chart-note">Everything on the shelf, backlog and open bags, against how fast you brew.
    <a href={link('/insights?tab=insights&chart=insights-what-if#insights-what-if')}>Plan it: What if</a></p>
</section>

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
            {#if g.bags.length > CAP}
              <span class="more">and <TextTip label="{g.bags.length - CAP} more" value tip={{ title: name, rows: g.bags.slice(CAP).map((b): [string, string] => [b.name, b.roaster]) }}>{g.bags.length - CAP} more</TextTip></span>
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

<style>
  /* Card grids fill their rows (ui-rules 33): 2 across, 4 on a wide panel; the runway's one card spans the row. */
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    container-type: inline-size;
  }
  .cards.one {
    grid-template-columns: minmax(0, 1fr);
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
    color: var(--color-text-muted);
  }
  /* Phones: side padding (pulled back by the margin) grows the "N more" target to 44 (rule 4). */
  @media (max-width: 640px) {
    .more :global(.text-tip) {
      padding-inline: 6px;
      margin-inline: -6px;
    }
  }
</style>
