<script lang="ts">
  import { page } from '$app/state';
  import { nameColor, nameRuns } from '$lib/nameColor';
  import { signRuns } from './deltaColor';
  // A coffee name in its keyword color (nameColor.ts), over any color the spot would give it (an inline style wins
  // over link, hover, status and board colors). `name`: a coffee name. `text`: any text (a headline, a
  // "Roaster · Name" label, a tip line); only the colored coffee names and the signed numbers (+0.3 green, −0.1 red) inside it are colored.
  let { name, text }: { name?: string | null; text?: string | null } = $props();
</script>

{#if text != null}{#each nameRuns(text, page.data.coloredNames) as [t, color], i (i)}{#if color}<span class="coffee-name" style:color>{t}</span>{:else}{#each signRuns(t) as [u, ink], j (j)}{#if ink}<span class={ink}>{u}</span>{:else}{u}{/if}{/each}{/if}{/each}{:else if nameColor(name)}<span class="coffee-name" style:color={nameColor(name)}>{name}</span>{:else}{name}{/if}
