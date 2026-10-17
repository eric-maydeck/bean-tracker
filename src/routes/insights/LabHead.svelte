<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import TipBody, { type Tip } from '$lib/components/TipBody.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import { SAMPLE_HELP } from '$lib/sample';
  import HeadingAnchor from './HeadingAnchor.svelte';

  // A lab section's heading (an anchor link) and its `?` explanation popover (ui-rules 27): the section's
  // title in bold, then `help`, one short idea per line (ui-rules 36). `cut`: the chart drops data for practicality
  // (ui-rules 47): a top-right note "<lead> See all." whose See all opens a tip with what was dropped.
  let { id, title, help, placeTip, level = 2, cut }: { id: string; title: string; help: string[]; placeTip: (e: ToggleEvent) => void; level?: 2 | 3; cut?: { lead: string; tip: Tip } } = $props();
</script>

<div class="lab-head">
  <HeadingAnchor {id} {level}>{title}</HeadingAnchor>
  <button class="mode-tip-button" popovertarget="{id}-help" aria-label="About {title}" aria-describedby="{id}-help"><Icon name="question" /></button>
  <div class="mode-tip" id="{id}-help" popover onbeforetoggle={placeTip}><TipBody tip={{ title, lines: help.filter((l) => l !== SAMPLE_HELP), sampleLegend: help.includes(SAMPLE_HELP) }} /></div>
  {#if cut}<p class="chart-note cut-note">{cut.lead} <TextTip label="See all" tip={cut.tip} />.</p>{/if}
</div>

<style>
  .lab-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .lab-head :global(:is(h2, h3)) {
    margin: 0;
  }
  /* Top right; on a narrow card it wraps under the title, still right-aligned. */
  .cut-note {
    margin: 0 0 0 auto;
    text-align: right;
  }
  .cut-note :global(.text-tip) {
    white-space: nowrap; /* "See all" never splits across lines */
  }
  /* Phones: "See all" is ~38px wide; side padding, pulled back by the margin so nothing moves, grows its target to 44
     (rule 4). */
  @media (max-width: 640px) {
    .cut-note :global(.text-tip) {
      padding-inline: 6px;
      margin-inline: -6px;
    }
  }
  .lab-head .mode-tip {
    --w: min(20rem, 100vw - 2rem);
  }
</style>
