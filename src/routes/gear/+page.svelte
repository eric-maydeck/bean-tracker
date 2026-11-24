<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import PreviewMeta from '#lib/components/PreviewMeta.svelte';
  import { gearPreview, gearsPreview } from '#lib/linkPreview.ts';
  import { parseGear, serializeGear, type GearUrlState } from '#lib/gearUrl.ts';
  import { currentParams } from '#lib/pageUrlState.ts';
  import { writeUrlParams } from '#lib/urlState.ts';
  import TrophyCase from './TrophyCase.svelte';

  let { data } = $props();

  // The URL is the state: read on entry and on every navigation (the nav's bare "Gear" resets), mirrored back on a choice.
  let s = $state<GearUrlState>(parseGear(currentParams(page.url)));
  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;
    s = parseGear(currentParams(page.url));
  });
  function choose(c: Partial<GearUrlState>) {
    s = { ...s, ...c };
    writeUrlParams(serializeGear(s));
  }

  let current = $derived(data.trophies.find((t) => t.key === s.card));
</script>

<svelte:head>
  <title>Bean Tracker - Gear</title>
</svelte:head>
<PreviewMeta preview={current ? gearPreview(current) : gearsPreview(data.trophies)} />

<h1>Gear</h1>
<p><a href="/stats?tab=gear">Charts and ratings for your gear on Stats →</a></p>

{#if data.doubleFilter}
  <p class="text-muted">{data.doubleFilter.brews} {data.doubleFilter.brews === 1 ? 'brew has' : 'brews have'} two filters ticked{#if data.doubleFilter.firstKey}: <a href="/gear?card={data.doubleFilter.firstKey}">check each tool's kind</a>{/if}</p>
{/if}

{#if data.trophies.length}
  <TrophyCase list={data.trophies} links={data.statsLinks} {s} {choose} />
{:else}
  <section class="chart-panel"><p class="hl-empty">No gear yet: gear shows up here once brews record it.</p></section>
{/if}
