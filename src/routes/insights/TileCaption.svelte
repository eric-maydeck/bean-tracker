<script lang="ts">
  import type { Snippet } from 'svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';

  // A Records / Milestones tile's name at its foot: bold in the label color, linking to the tile's
  // own #anchor. `children` follows the name on the same line (Records' "· Current" mode words).
  // .hl-caption / .stat-label / .caption-link are global (+page.svelte, app.css); the overview's
  // stat tiles use .caption-link in their own caption markup.
  // `head`: a findings headline's tip points as JSON (Insights.svelte's headline tip reads data-head).
  let { href, label, head, children }: { href: string; label: string; head?: string; children?: Snippet } = $props();
</script>

<div class="hl-caption">
  <span class="stat-label" data-head={head}><a class="caption-link" {href}><CoffeeName text={label} /></a>
{@render children?.()}</span>
</div>
