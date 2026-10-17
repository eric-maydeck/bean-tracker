<script lang="ts">
  import TextTip from './TextTip.svelte';
  import { usd, usdPrecise } from '$lib/money';

  // One dollar amount on a page (user, 2026-10-17): 2 decimals (usd), and when that rounds the value, the amount to
  // 4 decimals in the shared text tip (ui-rules 36, 39, 41). `suffix`: a per-unit label ("/g"), in both; `tipSuffix`:
  // the tip's alone, when the page sets the unit apart (a record's small "/ 100 g").
  let { n, suffix = '', tipSuffix = suffix }: { n: number; suffix?: string; tipSuffix?: string } = $props();
  let precise = $derived(usdPrecise(n));
</script>

{#if precise}<span class="usd"><TextTip label={usd(n) + suffix} tip={{ title: 'Before rounding', rows: [['To 4 decimals', precise + tipSuffix]] }} /></span>{:else}{usd(n) + suffix}{/if}

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
