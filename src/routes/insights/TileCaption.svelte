<script lang="ts">
  import type { Snippet } from 'svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { useChartLink } from './chartLink';
  import { truncTip } from '$lib/components/labelTip';
  import CapItem from '$lib/components/CapItem.svelte';

  // A Records / Milestones tile's name at its foot: bold in the label color, linking to the tile's
  // own #anchor. `children` follows the name on the same line (Records' "· Current" mode words).
  // .hl-caption / .stat-label / .caption-link are global (+page.svelte, app.css); the overview's
  // stat tiles use .caption-link in their own caption markup.
  // `head`: a findings headline's tip points as JSON (Insights.svelte's headline tip reads data-head).
  // `chart`: the tile's id, linked like a heading (?…&chart=<id>#<id>, a plain click only updates the address bar).
  let { href, chart, label, head, children }: { href?: string; chart?: string; label: string; head?: string; children?: Snippet } = $props();
  const link = useChartLink();
  // A name made of parts ("Coarsest grind · A4Z"): its parts are caption items, so the dot hangs and no line starts or ends with it.
  const parts = $derived(label.split(' · '));
  function onclick(e: MouseEvent) {
    if (!chart || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    link.go(chart);
  }
</script>

<div class="hl-caption">
  <span class="stat-label" class:has-cap={!!children} data-head={head}><a class="caption-link" href={chart ? link.href(chart) : href} onclickcapture={onclick} data-sveltekit-preload-data={chart ? 'off' : undefined} use:truncTip={label}>{#if parts.length > 1}<span class="cap-block"><span class="cap-list">{#each parts as part, i (i)}<CapItem><CoffeeName text={part} /></CapItem>{/each}</span></span>{:else}<CoffeeName text={label} />{/if}</a>
{#if children}{' '}<span class="cap-block"><span class="cap-list">{@render children()}</span></span>{/if}</span>
</div>
