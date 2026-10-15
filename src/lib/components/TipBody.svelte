<script lang="ts" module>
  // Every tip and help popover's content, one format (ui-rules 36, round 3 T1): a bold title, then either
  // label/value rows (data tips: label muted, value right-aligned; a row's third item, a deltaInk class,
  // colors a signed delta, T4) or short lines (help: one idea per line; an empty line is a visual gap), and an optional muted note.
  export type TipRow = [string, string] | [string, string, string]; // the third: a class (deltaInk)
  export type Tip = { title: string; rows?: TipRow[]; lines?: string[]; note?: string };
  // The same tip as one line, for an aria-label.
  export const tipText = (t: Tip) => [t.title, ...(t.rows ?? []).map(([l, v]) => `${l} ${v}`), ...(t.lines ?? []), t.note].filter(Boolean).join(' · ');
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import { SAMPLE_LABEL } from '$lib/sample';
  let { tip }: { tip: Tip } = $props();
</script>

{#if tip.title}<strong class="tip-title">{tip.title}</strong>{/if}
{#if tip.rows?.length}<dl class="tip-rows">{#each tip.rows as [l, v, ink], i (i)}<dt>{l}</dt><dd class={ink}>{v}</dd>{/each}</dl>{/if}
{#if tip.lines?.length}<ul class="tip-lines">{#each tip.lines as line, i (i)}<li class:gap={!line} aria-hidden={line ? undefined : true}>{#if line.startsWith(`${SAMPLE_LABEL}:`)}<span class="sample-chip"><Icon name="warning" />{SAMPLE_LABEL}</span>{line.slice(SAMPLE_LABEL.length)} <i class="sample-swatch small-sample-mark"></i>{:else}{line}{/if}</li>{/each}</ul>{/if}
{#if tip.note}<span class="tip-note">{tip.note}</span>{/if}
