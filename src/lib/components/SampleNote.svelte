<script lang="ts">
  import FloatTip from './FloatTip.svelte';
  import Icon from './Icon.svelte';
  import TipBody, { tipText } from './TipBody.svelte';
  import { SAMPLE_LABEL, sampleTip, type Sample } from '$lib/sample';

  // The one small-sample marker (spec 2026-10-15 Part 1): an amber "Low confidence" chip; the reason and exact
  // counts on hover, tap and keyboard focus, in the shared top-layer tip (ui-rules 36, 39). `paired`: the counts
  // are of same-bag paired brews (a lab row's delta), so the rows say so beside plain columns.
  let { s, paired = false }: { s: Sample; paired?: boolean } = $props();
  let anchor: HTMLButtonElement | undefined = $state();
  let open = $state(false);
  let tip = $derived({ title: SAMPLE_LABEL, ...sampleTip(s, paired) });
</script>

<button bind:this={anchor} type="button" class="sample-note" aria-expanded={open}
  aria-label={tipText(tip)}
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = true)}
  onblur={() => (open = false)}
  onclick={() => (open = true)}><span class="sample-chip"><Icon name="warning" />{SAMPLE_LABEL}</span></button>
{#if open && anchor}<FloatTip {anchor}><TipBody {tip} /></FloatTip>{/if}

<style>
  /* The chip look is global (.sample-chip, app.css); this is the button around it. */
  .sample-note {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.82em;
    color: inherit;
    cursor: help;
    position: relative; /* over a row's stretched link */
    z-index: 1;
    flex: none;
  }
  .sample-note:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Phones: a 44 px hit area around the chip, without growing the line (as .mode-tip-button). */
  @media (max-width: 640px) {
    .sample-note {
      padding: 16px 6px;
      margin: -16px -6px;
    }
  }
</style>
