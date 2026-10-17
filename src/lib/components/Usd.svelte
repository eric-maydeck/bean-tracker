<script lang="ts">
  import TextTip from './TextTip.svelte';
  import { isWholeUsd, usd, usdPrecise } from '$lib/money';

  // One dollar amount on a page (user, 2026-10-17): usd's format (2 decimals, whole dollars from $1,000), and when that
  // rounds the value, the amount before rounding (usdPrecise) in the shared text tip (ui-rules 36, 39, 41). `suffix`: a per-unit label ("/g"), in both; `tipSuffix`:
  // the tip's alone, when the page sets the unit apart (a record's small "/ 100 g"). `whole`: the set's format
  // (wholeUsd over the column, chart or list it sits in); default: this amount's own.
  let { n, suffix = '', tipSuffix = suffix, whole = isWholeUsd(n) }: { n: number; suffix?: string; tipSuffix?: string; whole?: boolean } = $props();
  let precise = $derived(usdPrecise(n, whole));
</script>

{#if precise}<span class="usd"><TextTip label={usd(n, whole) + suffix} tip={{ title: 'Before rounding', rows: [[whole ? 'To the cent' : 'To 4 decimals', precise + tipSuffix]] }} /></span>{:else}{usd(n, whole) + suffix}{/if}

<style>
  /* Phones: "$1.05" is ~33px wide; side padding, pulled back by the margin so nothing moves, grows its target to 44
     (rule 4). */
  @media (max-width: 640px) {
    .usd :global(.text-tip) {
      padding-inline: 12px;
      margin-inline: -12px;
    }
  }
</style>
