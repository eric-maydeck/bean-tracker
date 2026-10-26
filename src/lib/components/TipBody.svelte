<script lang="ts" module>
  import { TIP_TITLE, sampleTip, type Sample } from '$lib/sample';
  import { STRENGTH, STRENGTH_WHY, type Badge } from '$lib/strength';
  import { plainText, settingRuns } from '$lib/settingName';
  // Every tip and help popover's content, one format (ui-rules 36, round 3 T1): a bold title, then either
  // label/value rows (data tips: label muted, value right-aligned; a row's third item, a deltaInk class,
  // colors a signed delta, T4) or short lines (help: one idea per line; an empty line is a visual gap), and an optional muted note.
  export type TipRow = [string, string] | [string, string, string]; // the third: a class (deltaInk)
  // The tip ends with the caveats (ui-rules 36): the caveat's count rows, then `strength` (the badge word and its
  // one-line why), then the Low confidence title and reason. `sample` builds the caution from a Sample (sample.ts),
  // `caution` is a custom one (lines + count rows);
// `sampleLegend`: the help line explaining the chip (the one place the chip and the striped swatch show together).
// `points`: labeled facts, one per line: a bold label, then a concise value that may wrap ("Before: Lotus - Light and
// Bright (49% as of Mar 26)"); related facts merge into one point (ui-rules 36). Numbers to compare go in `rows`.
// `groups`: titled row sets (a chart tip's current and previous period), each a bold title over its own rows.
// A row's legend symbol: a swatch (bars; faded for a previous period) or a short line sample (lines; dashed for a previous period).
export type Mark = { color: string; line?: boolean; dashed?: boolean; faded?: boolean };
export type Tip = { title: string; rows?: TipRow[]; groups?: { title: string; rows: TipRow[]; marks?: (Mark | null)[] }[]; marks?: (Mark | null)[]; points?: [string, string][]; lines?: string[]; note?: string; sample?: { s: Sample; paired?: boolean }; sampleLegend?: boolean; strength?: Badge; caution?: { lines: string[]; rows: [string, string][] } };
  // The same tip as one line, for an aria-label.
  export const tipText = (t: Tip) => {
    const st = t.caution ?? (t.sample && sampleTip(t.sample.s, t.sample.paired));
    return [t.title, ...(t.rows ?? []).map(([l, v]) => `${l} ${v}`), ...(t.groups ?? []).flatMap((g) => [g.title, ...g.rows.map(([l, v]) => `${l} ${v}`)]), ...(t.points ?? []).map(([l, v]) => `${l}: ${v}`), ...(t.lines ?? []), t.note, ...(st ? st.rows.map(([l, v]) => `${l} ${v}`) : []), ...(t.strength ? [STRENGTH[t.strength], STRENGTH_WHY[t.strength]] : []), ...(st ? [TIP_TITLE, st.lines[0]] : [])].filter(Boolean).map((x) => plainText(String(x))).join(' · ');
  };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import CoffeeName from './CoffeeName.svelte';
  import { CHIP_EXAMPLE, SAMPLE_NOTE } from '$lib/sample';
  let { tip }: { tip: Tip } = $props();
  let caution = $derived(tip.caution ?? (tip.sample ? sampleTip(tip.sample.s, tip.sample.paired) : null));
</script>

<!-- Text with setting names (settingName.ts) marked: the names bold brown; coffee names in their keyword color. -->
{#snippet text(s: string)}{#each settingRuns(s) as [t, name], i (i)}{#if name}<span class="setting-name">{t}</span>{:else}<CoffeeName text={t} />{/if}{/each}{/snippet}
{#snippet mark(m: Mark | null | undefined)}{#if m}<i class="tip-mark" class:line={m.line} class:dashed={m.dashed} class:faded={m.faded} style:--mark={m.color} aria-hidden="true"></i>{/if}{/snippet}
{#if tip.title}<strong class="tip-title"><CoffeeName text={plainText(tip.title)} /></strong>{/if}
{#if tip.rows?.length}<dl class="tip-rows">{#each tip.rows as [l, v, ink], i (i)}<dt>{@render mark(tip.marks?.[i])}{@render text(l)}</dt><dd class={ink}><CoffeeName text={v} /></dd>{/each}</dl>{/if}

{#each tip.groups ?? [] as g, gi (gi)}<strong class="tip-title tip-group">{g.title}</strong><dl class="tip-rows">{#each g.rows as [l, v, ink], i (i)}<dt>{@render mark(g.marks?.[i])}{@render text(l)}</dt><dd class={ink}><CoffeeName text={v} /></dd>{/each}</dl>{/each}
{#if tip.points?.length}<ul class="tip-lines tip-points">{#each tip.points as [l, v], i (i)}<li><b class="tip-label">{@render text(l)}:</b> {@render text(v)}</li>{/each}</ul>{/if}
{#if tip.lines?.length || tip.sampleLegend}<ul class="tip-lines">{#each tip.lines ?? [] as line, i (i)}<li class:gap={!line} aria-hidden={line ? undefined : true}>{@render text(line)}</li>{/each}{#if tip.sampleLegend}<li><span class="sample-chip"><Icon name="warning" />{CHIP_EXAMPLE}</span> <i class="sample-swatch small-sample-mark"></i> {SAMPLE_NOTE}</li>{/if}</ul>{/if}
{#if tip.note}<span class="tip-note">{@render text(tip.note)}</span>{/if}
{#if caution}<dl class="tip-rows tip-counts">{#each caution.rows as [l, v] (l)}<dt>{l}</dt><dd>{v}</dd>{/each}</dl>{/if}
{#if tip.strength}
  <div class="tip-block strength-{tip.strength}"><strong class="tip-title">{STRENGTH[tip.strength]}</strong>
  <ul class="tip-lines"><li>{STRENGTH_WHY[tip.strength]}</li></ul></div>
{/if}
{#if caution}
  <div class="tip-block caution"><strong class="tip-title">{TIP_TITLE}</strong>
  <ul class="tip-lines"><li>{caution.lines[0]}</li></ul></div>
{/if}
