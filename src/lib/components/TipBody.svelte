<script lang="ts" module>
  import { TIP_TITLE, sampleTip, type Sample } from '$lib/sample';
  // Every tip and help popover's content, one format (ui-rules 36, round 3 T1): a bold title, then either
  // label/value rows (data tips: label muted, value right-aligned; a row's third item, a deltaInk class,
  // colors a signed delta, T4) or short lines (help: one idea per line; an empty line is a visual gap), and an optional muted note.
  export type TipRow = [string, string] | [string, string, string]; // the third: a class (deltaInk)
  // `sample`: a small sample's block (title, reason, counts; sample.ts), after the rows and lines;
// `sampleLegend`: the help line explaining the chip (the one place the chip and the striped swatch show together).
export type Tip = { title: string; rows?: TipRow[]; lines?: string[]; note?: string; sample?: { s: Sample; paired?: boolean }; sampleLegend?: boolean };
  // The same tip as one line, for an aria-label.
  export const tipText = (t: Tip) => {
    const st = t.sample && sampleTip(t.sample.s, t.sample.paired);
    return [t.title, ...(t.rows ?? []).map(([l, v]) => `${l} ${v}`), ...(t.lines ?? []), ...(st ? [TIP_TITLE, st.lines[0], ...st.rows.map(([l, v]) => `${l} ${v}`)] : []), t.note].filter(Boolean).join(' · ');
  };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import { CHIP_EXAMPLE, SAMPLE_HELP } from '$lib/sample';
  let { tip }: { tip: Tip } = $props();
</script>

{#if tip.title}<strong class="tip-title">{tip.title}</strong>{/if}
{#if tip.rows?.length}<dl class="tip-rows">{#each tip.rows as [l, v, ink], i (i)}<dt>{l}</dt><dd class={ink}>{v}</dd>{/each}</dl>{/if}
{#if tip.lines?.length || tip.sampleLegend}<ul class="tip-lines">{#each tip.lines ?? [] as line, i (i)}<li class:gap={!line} aria-hidden={line ? undefined : true}>{line}</li>{/each}{#if tip.sampleLegend}<li><span class="sample-chip"><Icon name="warning" />{CHIP_EXAMPLE}</span> <i class="sample-swatch small-sample-mark"></i> {SAMPLE_HELP.slice(CHIP_EXAMPLE.length + 2)}</li>{/if}</ul>{/if}
{#if tip.sample}
  {@const st = sampleTip(tip.sample.s, tip.sample.paired)}
  <strong class="tip-title" class:tip-sample={!!tip.title}>{TIP_TITLE}</strong>
  <ul class="tip-lines"><li>{st.lines[0]}</li></ul>
  <dl class="tip-rows">{#each st.rows as [l, v] (l)}<dt>{l}</dt><dd>{v}</dd>{/each}</dl>
{/if}
{#if tip.note}<span class="tip-note">{tip.note}</span>{/if}
