<script lang="ts" module>
  // A chart tip's content (ui-rules 36): one bold title, 1–4 label/value rows, an optional short note.
  export type Tip = { title: string; rows?: [string, string][]; note?: string };
  // The same tip as one line, for an aria-label.
  export const tipText = (t: Tip) => [t.title, ...(t.rows ?? []).map(([l, v]) => `${l} ${v}`), t.note].filter(Boolean).join(' · ');
</script>

<script lang="ts">
  let { tip }: { tip: Tip } = $props();
</script>

<strong class="tip-title">{tip.title}</strong>
{#if tip.rows?.length}<dl class="tip-rows">{#each tip.rows as [l, v] (l)}<dt>{l}</dt><dd>{v}</dd>{/each}</dl>{/if}
{#if tip.note}<span class="tip-note">{tip.note}</span>{/if}
