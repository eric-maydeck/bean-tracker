<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { formatGrams } from '$lib/grams';
  import { MON, THEMES, type InsightsUrlState, type Theme } from '$lib/insightsUrl';
  import { runway, spend, type WhatIf } from '$lib/insightsWhatIf';
  import type { Finding, InsightsTab } from '$lib/server/insights/insightGenerators';
  import { rowVars } from './rows';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import TileCaption from './TileCaption.svelte';

  let { t, theme, inputs, today, placeTip, choose }: {
    t: InsightsTab; theme: Theme | undefined; inputs: Partial<WhatIf>; today: string;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  const THEME_LABEL: Record<Theme, string> = { taste: 'Taste', dialin: 'Dial-in', habits: 'Habits', gear: 'Gear', money: 'Money' };
  const STRENGTH = { solid: 'Solid', hint: 'Hint' } as const;
  const STRENGTH_HELP = {
    solid: 'Solid: the difference is at least twice its usual noise, so chance is an unlikely explanation.',
    hint: 'Hint: 1.5 to 2 times its usual noise. Worth watching; more data will tell.'
  };
  const anchor = (key: string) => `insight-${key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, '')}`;
  const date = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`;
  // "115 days" → 115 + a small "days"; "r = 0.04" and "8:20 → 8:52" stay whole.
  const split = (v: string) => /^(\S*\d\S*) ([a-z].*)$/i.exec(v)?.slice(1) ?? [v];

  // Top stories come bucketed from the server (insightsTab): the deck and the grid never share a finding.
  let deck = $derived(t.stories);
  let grid = $derived(t.grid);
  let gridVars = $derived(rowVars(grid.length));
  let mythVars = $derived(rowVars(t.myths.length));

  // ---- Deck: position is component state, not URL (spec). ----
  let at = $state(0);
  let pos = $derived(Math.min(at, Math.max(0, deck.length - 1)));
  const go = (i: number) => (at = Math.max(0, Math.min(deck.length - 1, i)));
  // A #insight-… link to a deck card opens the deck on it (the page scrolls to the deck's card).
  let hashed = false;
  $effect(() => {
    if (hashed) return;
    hashed = true;
    const i = deck.findIndex((f) => `#${anchor(f.key)}` === decodeURIComponent(location.hash));
    if (i >= 0) at = i;
  });
  // A sideways swipe moves a card; a vertical one is the page's (touch-action: pan-y, which cancels the pointer).
  let start: { x: number; y: number } | null = null;
  function swipeEnd(e: PointerEvent) {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 2 * Math.abs(dy)) go(pos + (dx < 0 ? 1 : -1));
  }
  function deckKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      go(pos + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }

  // ---- What if: URL value, else the measured default. Typing shows at once; the URL follows. ----
  // No household size: one drinker.
  const d = $derived({ ...t.whatIf.defaults, drinkers: t.whatIf.defaults.drinkers || 1 });
  let live = $state<Partial<WhatIf>>({});
  // A navigation (the URL caught up, or Reset) hands the inputs back to the URL.
  $effect(() => {
    void [inputs.drinkers, inputs.gpp, inputs.inflow, inputs.bpd, inputs.dose];
    live = {};
  });
  let w = $derived<WhatIf>({
    drinkers: live.drinkers ?? inputs.drinkers ?? d.drinkers, gpp: live.gpp ?? inputs.gpp ?? d.gpp,
    inflow: live.inflow ?? inputs.inflow ?? d.inflow, bpd: live.bpd ?? inputs.bpd ?? d.bpd, dose: live.dose ?? inputs.dose ?? d.dose
  });
  let run = $derived(runway(t.whatIf.onHandG, w, today));
  let perMonth = $derived(spend(w, t.whatIf.avgPricePerG));
  // The slider reaches 3× the measured rate (at least 100 g/day), within the URL's 1–500.
  let gppMax = $derived(Math.min(500, Math.max(100, Math.ceil((d.gpp * 3) / 10) * 10)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(timer));
  const LIMITS: Record<keyof WhatIf, [number, number]> = { drinkers: [1, 20], gpp: [1, 500], inflow: [0, 10000], bpd: [0.5, 20], dose: [5, 40] };
  function set(k: keyof WhatIf, raw: string, wait = 0) {
    const v = Number(raw);
    const [lo, hi] = LIMITS[k];
    if (raw === '' || !Number.isFinite(v) || v < lo || v > hi) return; // a half-typed value waits
    live = { ...live, [k]: k === 'drinkers' ? Math.round(v) : v };
    clearTimeout(timer);
    timer = setTimeout(() => choose({ ...live }), wait);
  }
  const r1 = (n: number) => +n.toFixed(1);
  const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  // ---- Too early to tell: one plain sentence each. ----
  const lc = (s: string) => s[0].toLowerCase() + s.slice(1);
  const early = (f: Finding) =>
    `${f.headline}. That's from ${f.sample}, ${f.caveat ? `and ${lc(f.caveat)}` : 'not yet enough to rule out chance.'}${f.settle ? ` ${f.settle}` : ''}`;

  // A series as a 2px line over a 100×32 box; a dashed zero line when it crosses zero.
  function line(s: { value: number }[]) {
    const vs = s.map((p) => p.value), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
    const y = (v: number) => 30 - ((v - lo) / span) * 28;
    return {
      points: vs.map((v, i) => `${vs.length > 1 ? (i / (vs.length - 1)) * 100 : 50},${y(v).toFixed(2)}`).join(' '),
      zero: lo < 0 && hi > 0 ? y(0) : null
    };
  }
</script>

{#snippet badge(f: Finding, id: string)}
  {#if f.strength === 'solid' || f.strength === 'hint'}
    <button class="mode-tip-button" popovertarget="badge-{id}" aria-describedby="badge-{id}"
      ><span class="badge hl-badge" class:hint={f.strength === 'hint'}>{STRENGTH[f.strength]}</span></button
    >
    <div class="mode-tip" id="badge-{id}" popover onbeforetoggle={placeTip}>{STRENGTH_HELP[f.strength]}</div>
  {/if}
{/snippet}

<!-- The finding's number: a value, a versus split, or (no value) its chart. -->
{#snippet visual(f: Finding)}
  {#if f.sides?.length === 2}
    <div class="vs">
      {#each f.sides as s, i (i)}
        {#if i}<span class="vs-x" aria-hidden="true">vs</span>{/if}
        <div class="vs-side">
          <span class="hl-value">{s.value}</span>
          <span class="vs-label">{s.label}</span>
        </div>
      {/each}
    </div>
  {:else if f.value}
    {@const [v, unit] = split(f.value)}
    <span class="hl-value" class:long={v.length > 9}>{v}{#if unit}<small>{` ${unit}`}</small>{/if}</span>
  {/if}
  {#if f.series && f.series.length > 1}
    {@const l = line(f.series)}
    <div class="spark" role="img" aria-label="{f.series.map((p) => p.label).join(', ')}">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        {#if l.zero !== null}<line class="zero" x1="0" x2="100" y1={l.zero} y2={l.zero} />{/if}
        <polyline points={l.points} />
      </svg>
      <div class="spark-ends"><span>{f.series[0].label}</span><span>{f.series.at(-1)!.label}</span></div>
    </div>
  {/if}
{/snippet}

<section class="chart-panel">
  <HeadingAnchor id="insights-findings">Findings</HeadingAnchor>
  <div class="tab-group theme-chips" role="group" aria-label="Theme" data-button-row>
    {#each [undefined, ...THEMES] as th (th ?? 'all')}
      <button aria-pressed={theme === th} onclick={() => choose({ theme: th })}>{th ? THEME_LABEL[th] : 'All'}</button>
    {/each}
  </div>
  {#if !grid.length}
    <p class="hl-empty">No {theme ? `${THEME_LABEL[theme].toLowerCase()} ` : ''}findings in this period{deck.length ? ' beyond the top stories' : ''}.</p>
  {:else}
    <div class="hl-grid finding-grid">
      {#each grid as f, i (f.key)}
        {@const id = anchor(f.key)}
        <div class="hl-card finding" {id} style={gridVars[i]}>
          <div class="hl-top">{@render badge(f, `g-${i}`)}</div>
          {@render visual(f)}
          {#if f.body}<span class="hl-line wrap">{f.body}</span>{/if}
          <span class="hl-line wrap">{f.sample}{#if f.href}{' · '}<a href={f.href}>Data</a>{/if}</span>
          <TileCaption href="#{id}" label={f.headline} />
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if deck.length}
  <section class="chart-panel">
    <HeadingAnchor id="insights-stories">Top stories</HeadingAnchor>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="deck"
      role="region"
      aria-roledescription="carousel"
      aria-label="Top stories"
      tabindex={deck.length > 1 ? 0 : undefined}
      onkeydown={deckKey}
      onpointerdown={(e) => (start = e.isPrimary ? { x: e.clientX, y: e.clientY } : null)}
      onpointerup={swipeEnd}
      onpointercancel={() => (start = null)}
    >
      <div class="deck-track" style:translate="{-pos * 100}% 0">
        {#each deck as f, i (f.key)}
          <article class="story" id={anchor(f.key)} aria-hidden={i !== pos} inert={i !== pos}>
            <div class="story-head">
              <h3>{f.headline}</h3>
              {@render badge(f, `s-${i}`)}
            </div>
            <div class="story-visual">{@render visual(f)}</div>
            {#if f.body}<p>{f.body}</p>{/if}
            {#if f.caveat}<p class="muted">{f.caveat}</p>{/if}
            <div class="story-foot">
              <span class="muted">{f.sample}</span>
              {#if f.href}<a href={f.href}>See the data →</a>{/if}
            </div>
          </article>
        {/each}
      </div>
    </div>
    {#if deck.length > 1}
      <div class="deck-nav">
        <button class="button button-ghost" aria-label="Previous story" disabled={pos === 0} onclick={() => go(pos - 1)}><Icon name="caret-left" /></button>
        <span class="dots" aria-live="polite">
          <span class="sr-only">Story {pos + 1} of {deck.length}</span>
          {#each deck as f, i (f.key)}<span class="dot" class:on={i === pos} aria-hidden="true"></span>{/each}
        </span>
        <button class="button button-ghost" aria-label="Next story" disabled={pos === deck.length - 1} onclick={() => go(pos + 1)}><Icon name="caret-right" /></button>
      </div>
    {/if}
  </section>
{/if}

{#if t.myths.length}
  <section class="chart-panel">
    <HeadingAnchor id="insights-myths">Myth busters</HeadingAnchor>
    <div class="hl-grid myth-grid">
      {#each t.myths as f, i (f.key)}
        <div class="hl-card myth" id={anchor(f.key)} style={mythVars[i]}>
          <h3>{f.headline}</h3>
          {@render visual(f)}
          {#if f.body}<span class="hl-line wrap">{f.body}</span>{/if}
          <span class="hl-line wrap">{f.sample}{#if f.href}{' · '}<a href={f.href}>Data</a>{/if}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if t.whatIf.onHandG > 0 || perMonth !== null}
  {@const both = t.whatIf.onHandG > 0 && perMonth !== null}
  <section class="chart-panel">
    <HeadingAnchor id="insights-what-if">What if…</HeadingAnchor>
    <div class="hl-grid whatif-grid">
      {#if t.whatIf.onHandG > 0}
        <div class="hl-card calc" id="insights-runway" style="--q2:1;--q3:{both ? 2 : 1};--q4:{both ? 2 : 1}">
          <div class="fields">
            <label class="form-field">
              <span>People drinking</span>
              <input type="number" min="1" max="20" step="1" inputmode="numeric" aria-label="People drinking" value={w.drinkers}
                oninput={(e) => set('drinkers', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field">
              <span>Incoming g/week</span>
              <input type="number" min="0" max="10000" step="50" inputmode="numeric" aria-label="Incoming g/week" value={r1(w.inflow)}
                oninput={(e) => set('inflow', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field wide">
              <span>g/day per person <b>{Math.round(w.gpp)}</b></span>
              <input type="range" min="1" max={gppMax} step="1" aria-label="g/day per person" value={Math.round(w.gpp)}
                oninput={(e) => set('gpp', e.currentTarget.value, 250)} />
            </label>
          </div>
          {#if !(w.gpp > 0)}
            <span class="hl-line wrap result">Not enough brews to measure your daily use yet</span>
          {:else if run.days !== null}
            <span class="hl-value result">{run.days.toLocaleString('en-US')}<small>{' days'}</small></span>
            <span class="hl-line wrap">to clear · empty on {date(run.emptyOn!)}</span>
          {:else}
            <span class="hl-value result">Never</span>
            <span class="hl-line wrap">Your coffee keeps up — the backlog never runs out</span>
          {/if}
          <span class="hl-line">{formatGrams(t.whatIf.onHandG)} on hand</span>
          <TileCaption href="#insights-runway" label="Backlog runway" />
        </div>
      {/if}
      {#if perMonth !== null}
        <div class="hl-card calc" id="insights-spend" style="--q2:1;--q3:{both ? 2 : 1};--q4:{both ? 2 : 1}">
          <div class="fields">
            <label class="form-field">
              <span>Brews/day</span>
              <input type="number" min="0.5" max="20" step="0.1" inputmode="decimal" aria-label="Brews per day" value={r1(w.bpd)}
                oninput={(e) => set('bpd', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field">
              <span>Dose (g)</span>
              <input type="number" min="5" max="40" step="0.1" inputmode="decimal" aria-label="Dose" value={r1(w.dose)}
                oninput={(e) => set('dose', e.currentTarget.value, 400)} />
            </label>
            <!-- What the month is made of: the row beside the runway's slider, so neither card has a gap. -->
            <div class="form-field wide month">
              <span>Each month</span>
              <div class="month-parts">
                <span><b>{Math.round(w.bpd * 30.44)}</b> brews</span>
                <span><b>{formatGrams(w.bpd * w.dose * 30.44)}</b></span>
                <span><b>${(w.dose * t.whatIf.avgPricePerG!).toFixed(2)}</b> a cup</span>
              </div>
            </div>
          </div>
          <span class="hl-value result">{usd0(perMonth)}<small>{' a month'}</small></span>
          <span class="hl-line wrap">At ${(t.whatIf.avgPricePerG! * 100).toFixed(2)} / 100&nbsp;g, your last 12 months' average</span>
          <span class="hl-line">{usd0(perMonth * 12)} a year</span>
          <TileCaption href="#insights-spend" label="Monthly spend" />
        </div>
      {/if}
    </div>
  </section>
{/if}

{#if t.tooEarly.length}
  <section class="chart-panel">
    <HeadingAnchor id="insights-too-early">Too early to tell</HeadingAnchor>
    <ul class="early">
      {#each t.tooEarly as f (f.key)}<li>{early(f)}</li>{/each}
    </ul>
  </section>
{/if}

<style>
  .hl-card {
    gap: 0.35rem;
    scroll-margin-top: var(--space-2);
  }
  .theme-chips {
    margin-bottom: var(--space-3);
  }
  .theme-chips button {
    margin: 0;
    white-space: nowrap;
  }
  /* Phones: the six chips as a 3×2 grid of equal buttons (as Milestones' kinds). */
  @media (max-width: 640px) {
    .theme-chips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
  }
  /* The badge band: every card keeps it, badge or not, so values line up; the badge sits top right. */
  .hl-top {
    align-self: stretch;
    display: flex;
    justify-content: flex-end;
    height: 1.3rem;
    margin: calc(-1 * var(--space-1)) 0 calc(-1 * var(--space-1));
  }
  .hl-top .mode-tip-button,
  .story-head .mode-tip-button {
    line-height: 1;
  }
  .hl-badge.hint {
    background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
    color: var(--color-text-muted);
  }
  .hl-value.long {
    font-size: min(1.6rem, 12cqw / var(--q, 2));
  }
  .wrap {
    white-space: normal;
    line-height: 1.3;
  }
  /* Headlines are sentences: up to three lines. */
  .finding :global(.hl-caption .stat-label) {
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
  .vs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-1);
    width: 100%;
  }
  .vs-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }
  .vs .hl-value {
    font-size: min(1.5rem, 11cqw / var(--q, 2));
  }
  .vs-x {
    margin-top: var(--space-2);
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  /* A long bag name keeps to three lines (ponytail: cut without a tip; Records' use:full if it matters). */
  .vs-label {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    font-size: 0.8rem;
    line-height: 1.25;
    overflow-wrap: break-word;
    hyphens: auto;
  }
  /* Narrow (two-up phone) cards: the gap stands in for "vs", leaving the labels room. */
  @container (max-width: 519px) {
    .finding-grid .vs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .finding-grid .vs-x {
      display: none;
    }
  }
  .spark {
    width: 100%;
    max-width: 14rem;
  }
  .spark svg {
    display: block;
    width: 100%;
    height: 2.25rem;
    overflow: visible;
  }
  .spark polyline {
    fill: none;
    stroke: var(--chart-color-1);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .spark .zero {
    stroke: var(--color-border);
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }
  .spark-ends {
    display: flex;
    justify-content: space-between;
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }
  /* Myth cards: the belief as the heading, the answer largest under it. */
  .myth h3 {
    margin: 0;
    font-family: inherit;
    font-size: 0.85rem;
    line-height: 1.3;
    color: var(--color-label);
  }
  .myth .hl-line:last-child {
    margin-top: auto;
  }
  /* Story deck: one card visible, the track slides (no animation for reduced motion). */
  /* clip, not hidden: a hash jump's scrollIntoView can't scroll the track sideways. */
  .deck {
    overflow: clip;
    touch-action: pan-y;
    border-radius: var(--radius);
  }
  .deck:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .deck-track {
    display: flex;
    transition: translate 250ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .deck-track {
      transition: none;
    }
  }
  .story {
    flex: 0 0 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-4);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    container-type: inline-size;
  }
  .story-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .story h3 {
    margin: 0;
    font-family: inherit;
    font-size: 1.1rem;
    line-height: 1.3;
  }
  .story-visual {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    --q: 1;
  }
  .story-visual .hl-value {
    font-size: min(2.75rem, 12cqw);
  }
  .story-visual .vs .hl-value {
    font-size: min(2rem, 9cqw);
  }
  .story-visual .vs {
    max-width: 32rem;
  }
  .story-visual .spark {
    max-width: 28rem;
  }
  .story-visual .spark svg {
    height: 4rem;
  }
  .story p {
    margin: 0;
    line-height: 1.45;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
  .story-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    margin-top: auto;
  }
  .deck-nav {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-3);
  }
  .deck-nav button {
    margin: 0;
    min-width: 44px;
    min-height: 44px;
  }
  .deck-nav :global(.icon) {
    width: 1.1rem;
    height: 1.1rem;
  }
  .dots {
    display: flex;
    gap: 0.4rem;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--color-border);
  }
  .dot.on {
    background: var(--color-accent);
  }
  /* What if: inputs on top, the answer largest under them. */
  .calc {
    gap: 0.3rem;
  }
  /* Answers sit level across the two calculators, whatever their inputs' height. */
  .calc .result {
    margin-top: auto;
  }
  .calc :global(.hl-caption) {
    margin-top: 0;
  }
  .calc :global(.hl-caption .stat-label) {
    min-height: 0;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2) var(--space-3);
    width: 100%;
    margin-bottom: var(--space-2);
    text-align: left;
  }
  .fields .form-field {
    margin: 0;
    min-width: 0;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .fields .wide {
    grid-column: 1 / -1;
  }
  .fields b {
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }
  .fields input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .month-parts {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0 var(--space-3);
    min-height: 44px;
  }
  .fields input[type='range'] {
    padding: 0;
    border: 0;
    background: none;
    accent-color: var(--color-accent);
    min-height: 44px;
  }
  .early {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 2 24rem;
    column-gap: var(--space-5);
  }
  .early li {
    break-inside: avoid;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    line-height: 1.4;
    font-size: 0.9rem;
  }
</style>
