<script lang="ts">
  import type { Snippet } from 'svelte';
  import FloatTip from './FloatTip.svelte';
  import CoffeeName from './CoffeeName.svelte';
  import TipBody, { tipText, type Tip } from './TipBody.svelte';

  // A tip on a run of text (the See all note's "hidden by your settings", the coffee page's no-comparison line):
  // the text itself opens it on hover, tap and keyboard focus (ui-rules 36, 39, 41). Open state is transient UI, not URL state.
  // An inline span, not a <button>: a button is an inline-block box, so a wrapped label filled the line's width and its
  // empty side opened the tip (rule 41). The span's box is the text's own line boxes.
  // `children`: a trigger that isn't the label's text (RoastBeans' icons); `label` then only names it.
  let { label, tip, children }: { label: string; tip: Tip; children?: Snippet } = $props();
  let anchor: HTMLSpanElement | undefined = $state();
  // 'hover' or 'tap' (a click, tap or keyboard focus): only a non-hover tip may scroll itself into view (FloatTip `reveal`).
  let open = $state<false | 'hover' | 'tap'>(false);
</script>

<span bind:this={anchor} role="button" tabindex="0" class="text-tip" aria-expanded={!!open}
  aria-label="{label}: {tipText(tip)}"
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = 'hover')}
  onpointerleave={(e) => e.pointerType === 'mouse' && open === 'hover' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = 'tap')}
  onblur={() => (open = false)}
  onclick={() => (open = 'tap')}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (open = 'tap'))}>{#if children}{@render children()}{:else}<CoffeeName text={label} />{/if}</span>{#if open && anchor}<FloatTip {anchor} reveal={open === 'tap'} onclose={() => (open = false)}><TipBody {tip} /></FloatTip>{/if}

<style>
  .text-tip {
    cursor: help;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    /* A 44 px hit area (rule 4): an inline box's vertical padding grows the target without moving the line; its
       content area is at least 1em tall, so this padding reaches 44px at any font size. */
    padding: calc((44px - 1em) / 2) 0;
  }
  .text-tip:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
