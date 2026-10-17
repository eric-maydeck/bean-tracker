<script lang="ts">
  // Labels under a row of bars (findings' bars, Brewing's Brews until dialed in): one-letter initials (weekday bars,
  // weekends bold), or `full`: the value, then the name, ellipsized; on phones "value name" chips, names whole.
  let { series, full = false }: { series: { label: string; value: number }[]; full?: boolean } = $props();
</script>

<div class="bar-labels" class:full aria-hidden="true" style:--n={series.length}>
  {#each series as p, i (i)}
    {#if full}<span title={p.label}><b>{+p.value.toFixed(2)}</b>{p.label}</span>
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
  /* Phones: columns are too narrow for names, so the labels wrap as "value name" chips under the bars, whole. */
  @media (max-width: 480px) {
    .bar-labels.full {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0 0.6rem;
    }
    .bar-labels.full span {
      flex: none;
      max-width: 100%;
    }
    .bar-labels.full b {
      display: inline;
      margin-right: 0.25em;
    }
  }
  .bar-labels .weekend {
    color: var(--color-text);
    font-weight: 700;
  }
</style>
