<script lang="ts">
  import { signed } from './DeltaBars.svelte';
  import { deltaInk } from '$lib/components/deltaColor';
  let { like }: { like: { gap: number; label: string } } = $props();
</script>

<small class="like-line" title="{signed(like.gap)} vs {like.label}"><span class={deltaInk(like.gap)}>{signed(like.gap)}</span> vs {like.label}</small>

<style>
  .like-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
</style>
