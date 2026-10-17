<script lang="ts">
  import FloatTip from './FloatTip.svelte';
  import TipBody, { tipText, type Tip } from './TipBody.svelte';

  // A tip on a run of text (the See all note's "hidden by your settings", the coffee page's no-comparison line):
  // the text itself opens it on hover, tap and keyboard focus (ui-rules 36, 39, 41). Open state is transient UI, not URL state.
  let { label, tip }: { label: string; tip: Tip } = $props();
  let anchor: HTMLButtonElement | undefined = $state();
  let open = $state(false);
</script>

<button bind:this={anchor} type="button" class="text-tip" aria-expanded={open}
  aria-label="{label}: {tipText(tip)}"
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = true)}
  onblur={() => (open = false)}
  onclick={() => (open = true)}>{label}</button>{#if open && anchor}<FloatTip {anchor} onclose={() => (open = false)}><TipBody {tip} /></FloatTip>{/if}

<style>
  .text-tip {
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: help;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    /* A 44 px hit area that doesn't open a gap in the line (as .see-all's links): padding out, margin back in. */
    min-height: 44px;
    box-sizing: border-box;
    padding: 0.75rem 0;
    margin: -0.75rem 0;
  }
  .text-tip:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
