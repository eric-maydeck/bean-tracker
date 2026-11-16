<script lang="ts">
  import { labelTip } from '$lib/components/labelTip';
  // Labels under a row of bars (findings' bars, Brewing's Brews until dialed in): one-letter initials (weekday bars,
  // weekends bold), or `full`: the value stacked over the name, centered under its bar, the name ellipsized (full text in its tip).
  let { series, full = false, diverging = false }: { series: { label: string; value: number }[]; full?: boolean; diverging?: boolean } = $props();
  // Gaps read signed to 2 dp (+0.17, −0.13); plain values 1 dp.
  const val = (v: number) => (diverging ? `${v < -0.005 ? '−' : '+'}${Math.abs(v).toFixed(2)}` : `${+v.toFixed(1)}`);
</script>

<div class="bar-labels" class:full aria-hidden="true" style:--n={series.length}>
  {#each series as p, i (i)}
    {#if full}<span use:labelTip={p.label}><b>{val(p.value)}</b>{p.label}</span>
    {:else}<span class:weekend={/^(Sat|Sun)/.test(p.label)}>{p.label[0]}</span>{/if}
  {/each}
</div>

<style>
  .bar-labels {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    margin-top: 0.15rem;
    color: var(--color-text-muted);
    font-size: 0.68rem;
    text-align: center;
  }
  /* Full labels (roast / process groups): the value, then the name, cut with an ellipsis rather than spilling. */
  .bar-labels.full span {
    min-width: 0;
    max-width: 100%;
    justify-self: center; /* the text's own width, so only the label opens its tip (ui-rules 50) */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.62rem;
    line-height: 1.15;
  }
  /* Before the phone rule, which makes it inline. */
  .bar-labels.full b {
    display: block;
    color: var(--color-text);
    font-weight: 700;
  }
  .bar-labels .weekend {
    color: var(--color-text);
    font-weight: 700;
  }
</style>
