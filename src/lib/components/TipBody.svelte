<script lang="ts" module>
  // Every tip and help popover's content, one format (ui-rules 36, round 3 T1): a bold title, then either
  // label/value rows (data tips: label muted, value right-aligned; a row's third item colors a signed delta,
  // T4) or short lines (help: one idea per line), and an optional muted note.
  export type TipRow = [string, string] | [string, string, 'better' | 'worse' | undefined];
  export type Tip = { title: string; rows?: TipRow[]; lines?: string[]; note?: string };
  // The same tip as one line, for an aria-label.
  export const tipText = (t: Tip) => [t.title, ...(t.rows ?? []).map(([l, v]) => `${l} ${v}`), ...(t.lines ?? []), t.note].filter(Boolean).join(' · ');
</script>

<script lang="ts">
  let { tip }: { tip: Tip } = $props();
</script>

<strong class="tip-title">{tip.title}</strong>
{#if tip.rows?.length}<dl class="tip-rows">{#each tip.rows as [l, v, ink] (l)}<dt>{l}</dt><dd class={ink && `ink-${ink}`}>{v}</dd>{/each}</dl>{/if}
{#if tip.lines?.length}<ul class="tip-lines">{#each tip.lines as line, i (i)}<li>{line}</li>{/each}</ul>{/if}
{#if tip.note}<span class="tip-note">{tip.note}</span>{/if}
