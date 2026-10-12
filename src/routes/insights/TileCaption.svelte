<script lang="ts">
  import type { Snippet } from 'svelte';

  // A Records / Milestones tile's name at its foot: bold in the label colour, linking to the tile's
  // own #anchor. `children` follows the name on the same line (Records' "· Current" mode words).
  // .hl-caption / .stat-label / .caption-link are global (+page.svelte, app.css); the overview's
  // stat tiles use .caption-link in their own caption markup.
  let { href, label, children }: { href: string; label: string; children?: Snippet } = $props();
</script>

<div class="hl-caption">
  <span class="stat-label"><a class="caption-link" {href}>{label}</a>{@render children?.()}</span>
</div>
