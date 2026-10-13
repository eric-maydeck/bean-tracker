<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';

  // A lab section's heading (an anchor link) and its `?` explanation popover (ui-rules 27): the section's
  // title in bold, then `help`, one short idea per line (ui-rules 36).
  let { id, title, help, placeTip, level = 2 }: { id: string; title: string; help: string[]; placeTip: (e: ToggleEvent) => void; level?: 2 | 3 } = $props();
</script>

<div class="lab-head">
  <HeadingAnchor {id} {level}>{title}</HeadingAnchor>
  <button class="mode-tip-button" popovertarget="{id}-help" aria-label="About {title}" aria-describedby="{id}-help"><Icon name="question" /></button>
  <div class="mode-tip" id="{id}-help" popover onbeforetoggle={placeTip}><TipBody tip={{ title, lines: help }} /></div>
</div>

<style>
  .lab-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .lab-head :global(:is(h2, h3)) {
    margin: 0;
  }
  .lab-head .mode-tip {
    --w: min(20rem, 100vw - 2rem);
  }
</style>
