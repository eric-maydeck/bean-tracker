<script lang="ts">
  import FloatTip from './FloatTip.svelte';
  import Icon from './Icon.svelte';
  import TipBody, { tipText, type Tip } from './TipBody.svelte';
  import { chipLabel, type Sample } from '$lib/sample';
  import type { Badge } from '$lib/strength';

  // The one small-sample marker: an amber "Low confidence" chip; the reason and exact
  // counts on hover, tap and keyboard focus, in the shared top-layer tip (ui-rules 36, 39). `paired`: the counts
  // are of same-bag paired brews (a lab row's delta), so the rows say so beside plain columns.
  // `tip`: a fuller tip to open instead (the mineral map row's own, so the name and its chip show one tip);
  // `label`: the chip's words when it speaks for several rows (a Water pair heading).
  // `icon`: the warning icon alone (a table column of its own); the button's accessible name is still the tip's text.
  let { s, paired = false, strength, tip: given, label, icon = false }: { s: Sample; paired?: boolean; strength?: Badge; tip?: Tip; label?: string; icon?: boolean } = $props();
  let anchor: HTMLButtonElement | undefined = $state();
  let open = $state(false);
  let tip = $derived<Tip>(given ?? { title: '', ...(strength ? { strength } : {}), sample: { s, paired } });
</script>

<button bind:this={anchor} type="button" class="sample-note" class:icon aria-expanded={open}
  aria-label={tipText(tip)}
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = true)}
  onblur={() => (open = false)}
  onclick={() => (open = true)}><span class="sample-chip"><Icon name="warning" />{#if !icon}{label ?? chipLabel(s)}{/if}</span></button>
{#if open && anchor}<FloatTip {anchor} onclose={() => (open = false)}><TipBody {tip} /></FloatTip>{/if}

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
    /* the icon alone is narrower: more side padding to reach 44 */
    .sample-note.icon {
      padding-inline: 12px;
      margin-inline: -12px;
    }
  }
</style>
