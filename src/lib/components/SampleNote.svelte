<script lang="ts">
  import FloatTip from './FloatTip.svelte';
  import TipBody from './TipBody.svelte';
  import { sampleLabel, sampleRows, type Sample } from '$lib/sample';

  // The one small-sample marker (spec 2026-10-15 Part 1): a short muted label; the exact counts on hover,
  // tap and keyboard focus, in the shared top-layer tip (ui-rules 36, 39). `paired`: the counts are of
  // same-bag paired brews (a lab row's delta), so the rows say so beside plain columns.
  let { s, paired = false }: { s: Sample; paired?: boolean } = $props();
  let anchor: HTMLButtonElement | undefined = $state();
  let open = $state(false);
  let label = $derived(sampleLabel(s));
  let rows = $derived(sampleRows(s).map(([k, v]): [string, string] => [paired ? `Paired ${k.toLowerCase()}` : k, v]));
</script>

<button bind:this={anchor} type="button" class="sample-note small-sample" aria-expanded={open}
  aria-label="{label}: {s.bags} {s.bags === 1 ? 'bag' : 'bags'}, {s.brews} {s.brews === 1 ? 'brew' : 'brews'}"
  onpointerenter={(e) => e.pointerType === 'mouse' && (open = true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (open = false)}
  onfocus={(e) => e.currentTarget.matches(':focus-visible') && (open = true)}
  onblur={() => (open = false)}
  onclick={() => (open = true)}>{label}</button>
{#if open && anchor}<FloatTip {anchor}><TipBody tip={{ title: 'Small sample', rows }} /></FloatTip>{/if}

<style>
  .sample-note {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.85em;
    white-space: nowrap;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: help;
    position: relative; /* over a row's stretched link */
    z-index: 1;
    flex: none;
  }
  .sample-note:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Phones: a 44 px hit area around the text, without growing the line (as .mode-tip-button). */
  @media (max-width: 640px) {
    .sample-note {
      min-width: 44px;
      padding: 16px 15px;
      margin: -16px -15px;
    }
  }
</style>
