<script lang="ts">
  import type { Snippet } from 'svelte';
  import Headline from './Headline.svelte';

  // A Records / Milestones tile's name at its foot: bold in the label color, linking to the tile's
  // own #anchor. `children` follows the name on the same line (Records' "· Current" mode words).
  // .hl-caption / .stat-label / .caption-link are global (+page.svelte, app.css); the overview's
  // stat tiles use .caption-link in their own caption markup.
  // `tip`: a phrase in the label with its own tip (Headline.svelte).
  let { href, label, tip, children }: { href: string; label: string; tip?: { phrase: string; tip: string }; children?: Snippet } = $props();
</script>

<div class="hl-caption">
  <span class="stat-label"><a class="caption-link" {href}><Headline text={label} {tip} /></a>
{@render children?.()}</span>
</div>
