<!-- TEMP preview — delete before push -->
<script lang="ts">
  import { page } from '$app/state';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import type { Timeline } from '$lib/pours';

  // Three blooms (each with a timed wait), then a fast and a slow pour and a swirl.
  const timeline: Timeline = {
    pours: [
      { startS: 0, durationS: 4, grams: 40, kind: 'bloom' },
      { startS: 20, durationS: 4, grams: 40, kind: 'bloom' },
      { startS: 40, durationS: 4, grams: 40, kind: 'bloom' },
      { startS: 60, durationS: 8, grams: 80, kind: 'fast' },
      { startS: 90, durationS: 20, grams: 100, kind: 'slow' }
    ],
    labels: ['First bloom (0:00–0:20)', 'Second bloom (0:20–0:40)', 'Third bloom (0:40–1:00)', 'Fourth pour (1:00–1:30)', 'Fifth pour (1:30 → end)'],
    swirls: [48],
    swirlLabels: ['Swirl after third bloom'],
    totalS: 150,
    windows: [
      { startS: 0, targetS: 20, bloom: 0, pour: 0 },
      { startS: 20, targetS: 40, bloom: 1, pour: 1 },
      { startS: 40, targetS: 60, bloom: 2, pour: 2 }
    ]
  };
  // First / second / third bloom: [series token numbers].
  const OPTIONS: [number, number, number][] = [
    [2, 7, 3], [3, 7, 2], [2, 14, 10], [9, 7, 3], [3, 12, 2], [7, 2, 12], [10, 14, 9], [2, 12, 7]
  ];
  const only = $derived(Number(page.url.searchParams.get('opt')) || null);
  const shown = $derived(OPTIONS.map((o, i) => ({ o, n: i + 1 })).filter((x) => !only || x.n === only));
  const vars = (o: number[]) => o.map((t, i) => `--band-${i}: var(--series-${t});`).join(' ');
</script>

<h1>Bloom band colours</h1>
<p class="text-muted">Pour fills in use: bloom series-4, fast series-1-ink, slow series-6, medium series-5. <a href="?">All</a></p>
{#each shown as { o, n } (n)}
  <h2><a href="?opt={n}">Option {n}</a>: first series-{o[0]}, second series-{o[1]}, third series-{o[2]}</h2>
  <div class="pair" class:big={!!only}>
    <div class="panel light" style={vars(o)}><PourTimeline {timeline} label="Option {n}, light" /></div>
    <div class="panel dark" style={vars(o)}><PourTimeline {timeline} label="Option {n}, dark" /></div>
  </div>
{/each}

<style>
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pair.big { grid-template-columns: 1fr; }
  .panel { padding: 12px; border-radius: 8px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); }
  .panel.dark {
    --color-surface: #262019; --color-text: #f1e9e0; --color-text-muted: #b3a494; --color-border: #3a2f26;
    --series-1-ink: #c7d7fd; --series-2: #eeb9f6; --series-3: #ffd7d9; --series-4: #febf95; --series-5: #e5e89a; --series-6: #9ee6b5;
    --series-7: #80eaf7; --series-8: #718fe1; --series-9: #c470d1; --series-10: #fc7184; --series-11: #c16300; --series-12: #898904;
    --series-13: #00a259; --series-14: #07a3b2;
  }
  @media (max-width: 640px) { .pair { grid-template-columns: 1fr; } }
</style>
