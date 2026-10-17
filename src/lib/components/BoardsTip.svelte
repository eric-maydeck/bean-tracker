<script lang="ts">
  import FloatTip from './FloatTip.svelte';
  import TipBody, { tipText, type Tip } from './TipBody.svelte';

  // "8 boards" in the See all note: hover, tap and keyboard focus list each board's hidden rows (the shared tip,
  // ui-rules 36, 39). Open state is transient UI, not URL state.
  let { label, rows }: { label: string; rows: [string, string][] } = $props();
  let anchor: HTMLButtonElement | undefined = $state();
  let open = $state(false);
  let tip = $derived<Tip>({ title: 'Hidden rows', rows });
</script>

<button bind:this={anchor} type="button" class="boards-tip" aria-expanded={open}
  aria-label="{label}: {tipText(tip)}"
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = true)}
  onblur={() => (open = false)}
  onclick={() => (open = true)}>{label}</button>
{#if open && anchor}<FloatTip {anchor} onclose={() => (open = false)}><TipBody {tip} /></FloatTip>{/if}

<style>
  .boards-tip {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: help;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
  .boards-tip:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  /* A 44 px hit area that doesn't open a gap in the line (as .see-all's links): padding out, margin back in. */
  .boards-tip {
    min-height: 44px;
    box-sizing: border-box;
    padding: 0.75rem 0;
    margin: -0.75rem 0;
  }
</style>
