<script lang="ts">
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { labelTip } from '$lib/components/labelTip';
  // A finding's headline; `tip`: a phrase in it that opens clarifying info in the shared tip (hover, tap, focus;
  // labelTip), e.g. "like coffees" naming the like-group (user, 2026-10-18).
  let { text, tip }: { text: string; tip?: { phrase: string; tip: string } } = $props();
  let at = $derived(tip ? text.indexOf(tip.phrase) : -1);
</script>

{#if tip && at >= 0}<CoffeeName text={text.slice(0, at)} /><span class="phrase-tip" use:labelTip={tip.tip}>{tip.phrase}</span
  ><CoffeeName text={text.slice(at + tip.phrase.length)} />{:else}<CoffeeName {text} />{/if}

<style>
  .phrase-tip {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
</style>
