<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import HeadingAnchor from './HeadingAnchor.svelte';

  // A lab section's heading (an anchor link) and its `?` explanation popover (ui-rules 27).
  let { id, title, help, placeTip }: { id: string; title: string; help: string; placeTip: (e: ToggleEvent) => void } = $props();
</script>

<div class="lab-head">
  <HeadingAnchor {id}>{title}</HeadingAnchor>
  <button class="mode-tip-button" popovertarget="{id}-help" aria-label="About {title}" aria-describedby="{id}-help"><Icon name="question" /></button>
  <div class="mode-tip" id="{id}-help" popover onbeforetoggle={placeTip}>{help}</div>
</div>

<style>
  .lab-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .lab-head :global(h2) {
    margin: 0;
  }
</style>
