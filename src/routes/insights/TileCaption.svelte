<script lang="ts">
  import type { Snippet } from 'svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { useChartLink } from './chartLink';
  import CapItem from '$lib/components/CapItem.svelte';

  // A Records / Milestones tile's name at its foot: bold in the label color, linking to the tile's
  // own #anchor. `children` follows the name on the same line (Records' "· Current" mode words).
  // .hl-caption / .stat-label / .caption-link are global (+page.svelte, app.css); the overview's
  // stat tiles use .caption-link in their own caption markup.
  // `head`: a findings headline's tip points as JSON (Insights.svelte's headline tip reads data-head).
  // `chart`: the tile's id, linked like a heading (?…&chart=<id>#<id>, a plain click only updates the address bar).
  let { href, chart, label, head, children }: { href?: string; chart?: string; label: string; head?: string; children?: Snippet } = $props();
  const link = useChartLink();
  // A name made of parts ("Coarsest grind · A4Z") shows them as caption items (ui-rules 55): the dot hides when a part starts a line.
  const parts = $derived(label.split(' · '));
  function onclick(e: MouseEvent) {
    if (!chart || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    link.go(chart);
  }
</script>

<div class="hl-caption">
  <span class="stat-label" data-head={head}><a class="caption-link" href={chart ? link.href(chart) : href} onclickcapture={onclick} data-sveltekit-preload-data={chart ? 'off' : undefined}><CoffeeName text={parts[0]} />{#each parts.slice(1) as part (part)}<CapItem><CoffeeName text={part} /></CapItem>{/each}</a>
{@render children?.()}</span>
</div>
