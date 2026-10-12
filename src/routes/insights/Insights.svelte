<script lang="ts" module>
  // The strength badges' words and explanations, shared with Sweet spots.
  export const STRENGTH = { solid: 'Solid', hint: 'Hint' } as const;
  export const STRENGTH_HELP = {
    solid: 'Solid: the difference is at least twice its usual noise, so chance is an unlikely explanation.',
    hint: 'Hint: 1.5 to 2 times its usual noise. Worth watching; more data will tell.'
  };
</script>

<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { formatGrams } from '$lib/grams';
  import { MON, THEMES, WHATIF_LIMITS as L, type InsightsUrlState, type Theme } from '$lib/insightsUrl';
  import { DAYS_PER_MONTH, runway, spend, type WhatIf } from '$lib/insightsWhatIf';
  import type { Finding, InsightsTab } from '$lib/server/insights/insightGenerators';
  import { lines } from './multiLine';
  import { rowVars, sizedGrid } from './rows';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import TileCaption from './TileCaption.svelte';

  let { t, theme, inputs, today, placeTip, choose }: {
    t: InsightsTab; theme: Theme | undefined; inputs: Partial<WhatIf>; today: string;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  const THEME_LABEL: Record<Theme, string> = { taste: 'Taste', dialin: 'Dial-in', habits: 'Habits', gear: 'Gear', money: 'Money' };
  const anchor = (key: string) => `insight-${key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, '')}`;
  const date = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`;
  // "115 days" → 115 + a small "days"; "r = 0.04" and "8:20 → 8:52" stay whole.
  const split = (v: string) => /^(\S*\d\S*) ([a-z].*)$/i.exec(v)?.slice(1) ?? [v];

  // Top stories come bucketed from the server (insightsTab): the deck and the grid never share a finding.
  let deck = $derived(t.stories);
  let grid = $derived(t.grid);
  // Card sizes come from content (ui-rules 34): a chart or a versus split is LARGE, a number SMALL.
  // The card's title: the headline plus each versus side in full (a clamped side label's only full-text route besides the popover).
  const full = (f: Finding) => [f.headline, ...(f.sides?.length === 2 ? f.sides.map((s) => `${s.label}: ${s.value}`) : [])].join('\n');
  const large = (f: Finding) => f.sides?.length === 2 || (f.series?.length ?? 0) > 1 || (!!f.multi && f.multi.x.length > 1 && f.multi.lines.length > 0);
  let sized = $derived(sizedGrid(grid, large));
  let mythVars = $derived(rowVars(t.myths.length));

  // Details are filler only (user rule B7): lay the cards out without them (natural heights, top-aligned;
  // charts at their base height, .fit), then per card reveal groups in order while its content stays within
  // its row's tallest card (a fixed-height findings card: its own height). A group never makes a row
  // taller; once revealed, charts and details share the card's spare height (svg min 1.5rem).
  // Re-runs when the width or the cards change (SSR: all hidden).
  function filler(el: HTMLElement, _cards: unknown) {
    let w = -1;
    const run = () => {
      const groups = [...el.querySelectorAll<HTMLElement>('.dgroup')];
      for (const g of groups) g.hidden = true;
      const cards = [...el.children] as HTMLElement[];
      // A fixed-height findings card whose text doesn't fit tightens step by step (CSS [data-tight],
      // ui-rules 34); still overflowing at 3 is a test failure. Auto-height cards never overflow.
      for (const c of cards) {
        delete c.dataset.tight;
        for (let t = 1; t <= 3 && c.scrollHeight > c.clientHeight + 1; t++) c.dataset.tight = `${t}`;
      }
      if (!groups.length) return;
      el.style.alignItems = 'flex-start';
      el.classList.add('fit');
      const rowMax = new Map<number, number>();
      for (const c of cards) rowMax.set(c.offsetTop, Math.max(rowMax.get(c.offsetTop) ?? 0, c.clientHeight));
      // Item by item, so a group can show its top entries when the whole list doesn't fit.
      for (const c of cards) {
        const max = rowMax.get(c.offsetTop)!;
        fill: for (const g of c.querySelectorAll<HTMLElement>('.dgroup')) {
          const items = [...g.querySelectorAll<HTMLElement>('li')];
          for (const li of items) li.hidden = true;
          g.hidden = false;
          for (const [i, li] of items.entries()) {
            li.hidden = false;
            if (c.scrollHeight > max) {
              li.hidden = true;
              if (i === 0) g.hidden = true;
              break fill;
            }
          }
        }
      }
      el.style.alignItems = '';
      el.classList.remove('fit');
    };
    // Width only: revealing groups changes heights, which must not re-trigger (no layout loop). A reveal
    // that toggles the page scrollbar changes the width once and re-runs; run is deterministic per width.
    const ro = new ResizeObserver(([e]) => {
      if (Math.round(e.contentRect.width) === w) return;
      w = Math.round(e.contentRect.width);
      run();
    });
    ro.observe(el);
    document.fonts?.ready.then(run);
    let raf = 0;
    return { update: () => (raf = requestAnimationFrame(run)), destroy: () => (ro.disconnect(), cancelAnimationFrame(raf)) };
  }

  // A tap on a card whose headline or body is clamped shows the full text (title covers hover).
  function unclamp(e: MouseEvent) {
    const c = e.currentTarget as HTMLElement;
    if ((e.target as Element).closest('a, button, .mode-tip')) return;
    if ([...c.querySelectorAll('.body, .stat-label')].some((t) => t.scrollHeight > t.clientHeight + 1)) document.getElementById(c.dataset.tip!)!.togglePopover();
  }

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
  // A URL value above it widens the slider so the thumb matches the label.
  let gppMax = $derived(Math.max(Math.round(w.gpp), Math.min(L.gpp[1], Math.max(100, Math.ceil((d.gpp * 3) / 10) * 10))));
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(timer));
  function set(k: keyof WhatIf, raw: string, wait = 0) {
    const v = Number(raw);
    const [lo, hi] = L[k];
    if (raw === '' || !Number.isFinite(v) || v < lo || v > hi) return; // a half-typed value waits
    live = { ...live, [k]: k === 'drinkers' ? Math.round(v) : v };
    clearTimeout(timer);
    timer = setTimeout(() => choose({ ...live }), wait);
  }
  const r1 = (n: number) => +n.toFixed(1);
  const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  // ---- Too early to tell: what was seen, the sample, why it isn't trusted yet, what would settle it. ----
  const early = (f: Finding) => f.caveat ?? 'Not yet enough to rule out chance.';
  const pct = (p: number) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;

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
        {@const [v, unit] = split(s.value)}
        {#if i}<span class="vs-x" aria-hidden="true">vs</span>{/if}
        <div class="vs-side">
          <span class="hl-value">{v}{#if unit}<small>{` ${unit}`}</small>{/if}</span>
          <span class="vs-label">{s.label}</span>
        </div>
      {/each}
    </div>
  {:else if f.value}
    {@const [v, unit] = split(f.value)}
    <span class="hl-value" class:long={v.length > 9}>{v}{#if unit}<small>{` ${unit}`}</small>{/if}</span>
  {/if}
  {#if f.multi && f.multi.x.length > 1 && f.multi.lines.length}
    {@const ls = lines(f.multi)}
    <div class="multi" role="img" aria-label="{f.multi.lines.map((l) => l.label).join(', ')} from {f.multi.x[0]} to {f.multi.x.at(-1)}">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        {#each ls as l (l.label)}{#each l.runs as r, j (j)}<polyline points={r} style:stroke={l.color} />{/each}{/each}
      </svg>
      <div class="spark-ends" aria-hidden="true"><span>{f.multi.x[0]}</span><span>{f.multi.x.at(-1)}{f.multi.unit ? ` · ${f.multi.unit}` : ''}</span></div>
      <ul class="legend" aria-hidden="true">
        {#each ls as l (l.label)}<li><span class="swatch" style:background={l.color}></span>{l.label}</li>{/each}
      </ul>
    </div>
  {:else if f.series && f.series.length > 1 && f.chart === 'bars'}
    {@const max = Math.max(...f.series.map((p) => p.value)) || 1}
    {@const w = 100 / f.series.length}
    <!-- Magnitudes from zero: bars. Weekend bars take the second colour (and their initials are bold). -->
    <div class="bars" role="img" aria-label={f.series.map((p) => `${p.label} ${+p.value.toFixed(2)}`).join(', ')}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        {#each f.series as p, i (i)}
          <rect x={i * w + w * 0.15} width={w * 0.7} y={40 - (Math.max(0, p.value) / max) * 38} height={(Math.max(0, p.value) / max) * 38}
            class:weekend={/^(Sat|Sun)/.test(p.label)} />
        {/each}
      </svg>
      <div class="bar-labels" aria-hidden="true" style:--n={f.series.length}>
        {#each f.series as p, i (i)}<span class:weekend={/^(Sat|Sun)/.test(p.label)}>{p.label[0]}</span>{/each}
      </div>
    </div>
  {:else if f.series && f.series.length > 1}
    {@const l = line(f.series)}
    <div class="spark" role="img" aria-label="{f.series.map((p) => p.label).join(', ')}">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        {#if l.zero !== null}<line class="zero" x1="0" x2="100" y1={l.zero} y2={l.zero} />{/if}
        <polyline points={l.points} />
      </svg>
      <div class="spark-ends"><span>{f.series[0].label}</span><span>{f.series.at(-1)!.label}</span></div>
    </div>
  {/if}
  {#if f.details}
    <div class="details">
      {#each f.details as g (g.label)}
        <div class="dgroup" hidden>
          <span class="dlabel">{g.label}</span>
          <ol>
            {#each g.items as it, k (k)}
              <li><span class="dname">{#if it.href}<a href={it.href}>{it.name}</a>{:else}{it.name}{/if}</span>{#if it.value}<span class="dval">{it.value}</span>{/if}</li>
            {/each}
          </ol>
        </div>
      {/each}
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
    <div class="hl-grid finding-grid" use:filler={sized}>
      {#each sized as { item: f, size, style }, i (f.key)}
        {@const id = anchor(f.key)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the clamped text is in the DOM for readers) -->
        <div class="hl-card finding" {id} {style} data-size={size} data-tip="full-{id}" title={full(f)} onclick={unclamp}>
          <div class="hl-top">{@render badge(f, `g-${i}`)}</div>
          {@render visual(f)}
          {#if f.body}<span class="hl-line wrap body" title={f.body}>{f.body}</span>{/if}
          <span class="hl-line wrap sample">{f.sample}{#if f.href}{' · '}<a href={f.href}>Data</a>{/if}</span>
          <TileCaption href="#{id}" label={f.headline} />
          <div class="mode-tip" id="full-{id}" popover onbeforetoggle={placeTip}>{f.headline}{#if f.sides?.length === 2}{#each f.sides as s, i (i)}<br />{s.label}: {s.value}{/each}{/if}{#if f.body}<br />{f.body}{/if}{#if f.caveat}<br />{f.caveat}{/if}</div>
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
      <div class="deck-track" style:translate="{-pos * 100}% 0" use:filler={deck}>
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
              <input type="number" min={L.drinkers[0]} max={L.drinkers[1]} step="1" inputmode="numeric" aria-label="People drinking" value={w.drinkers}
                oninput={(e) => set('drinkers', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field">
              <span>Incoming g/week</span>
              <input type="number" min={L.inflow[0]} max={L.inflow[1]} step="50" inputmode="numeric" aria-label="Incoming g/week" value={r1(w.inflow)}
                oninput={(e) => set('inflow', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field wide">
              <span>g/day per person <b>{Math.round(w.gpp)}</b></span>
              <input type="range" min={L.gpp[0]} max={gppMax} step="1" aria-label="g/day per person" value={Math.round(w.gpp)}
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
              <input type="number" min={L.bpd[0]} max={L.bpd[1]} step="0.1" inputmode="decimal" aria-label="Brews per day" value={r1(w.bpd)}
                oninput={(e) => set('bpd', e.currentTarget.value, 400)} />
            </label>
            <label class="form-field">
              <span>Dose (g)</span>
              <input type="number" min={L.dose[0]} max={L.dose[1]} step="0.1" inputmode="decimal" aria-label="Dose" value={r1(w.dose)}
                oninput={(e) => set('dose', e.currentTarget.value, 400)} />
            </label>
            <!-- What the month is made of: the row beside the runway's slider, so neither card has a gap. -->
            <div class="form-field wide month">
              <span>Each month</span>
              <div class="month-parts">
                <span><b>{Math.round(w.bpd * DAYS_PER_MONTH)}</b> brews</span>
                <span><b>{formatGrams(w.bpd * w.dose * DAYS_PER_MONTH)}</b></span>
                <span><b>${(w.dose * t.whatIf.avgPricePerG!).toFixed(2)}</b> a cup</span>
              </div>
            </div>
          </div>
          {#if w.bpd * w.dose > 0}
            <span class="hl-value result">{usd0(perMonth)}<small>{' a month'}</small></span>
          {:else}
            <span class="hl-line wrap result">Not enough brews to measure your spend yet</span>
          {/if}
          <span class="hl-line wrap">At ${(t.whatIf.avgPricePerG! * 100).toFixed(2)} / 100&nbsp;g, your last 12 months' average</span>
          {#if w.bpd * w.dose > 0}<span class="hl-line">{usd0(perMonth * 12)} a year</span>{/if}
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
      {#each t.tooEarly as f (f.key)}
        <li>
          <div class="early-top"><span class="early-theme">{THEME_LABEL[f.theme]}</span><span>{f.sample}</span></div>
          <p class="early-head">{f.headline}</p>
          <p class="early-why">{early(f)}</p>
          {#if f.progress !== undefined}
            <div class="meter" role="meter" aria-label="Evidence toward settled" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(f.progress * 100)}>
              <span style:width={pct(f.progress)}></span>
            </div>
          {/if}
          <div class="early-foot">
            {#if f.progress !== undefined}<b>{pct(f.progress)} there</b>{/if}
            {#if f.settle}<span>{f.settle}</span>{/if}
          </div>
        </li>
      {/each}
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
  /* Findings card sizes (ui-rules 34): a card is its row's height token (rows.ts sizedGrid picks the
     token per column count, +page.svelte's --h by the grid's width), measured from the 2026-10-12
     layout the user picked. Content is forced to fit: charts take what's left, text clamps (the card's
     title has the headline, the body's its full text). */
  /* The --fs-* height tokens are :global(.finding-grid) in +page.svelte (shared with Sweet spots). */
  .finding {
    height: var(--h);
  }
  /* Only a chart gives way; text never shrinks (a clipped line would hide, not overflow). */
  .finding > * {
    flex-shrink: 0;
  }
  .finding :global(.hl-caption .stat-label),
  .finding .body,
  .finding:global([data-tight='2']) .sample {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--clamp, 3);
    line-clamp: var(--clamp, 3);
    overflow: hidden;
  }
  /* Too little room (narrow phones): headline and body to 2 lines, then legend entries and the sample
     line to 1 line each, then headline and body to 1. */
  .finding:global([data-tight]) {
    --clamp: 2;
    --vs-clamp: 2;
  }
  .finding:global([data-tight='3']) {
    --clamp: 1;
  }
  /* Versus side labels give way too (the full-text popover and title list each side in full). */
  .finding:global(:is([data-tight='2'], [data-tight='3'])) {
    --vs-clamp: 1;
  }
  .finding:global([data-tight='3']) .sample {
    white-space: nowrap;
  }
  .finding:global(:is([data-tight='2'], [data-tight='3'])) .legend li {
    display: block;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .finding:global(:is([data-tight='2'], [data-tight='3'])) .swatch {
    display: inline-block;
    margin-right: 0.25rem;
    vertical-align: middle;
  }
  /* A long value wraps at its spaces inside the card rather than spill (B3). */
  .finding > .hl-value {
    max-width: 100%;
    white-space: normal;
    text-wrap: balance;
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
  /* A side's value wraps under its number rather than spill over the card ("33 of 81 bags"). */
  .vs .hl-value {
    max-width: 100%;
    font-size: min(1.5rem, 11cqw / var(--q, 2));
    white-space: normal;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }
  /* Multi-line charts take the categorical slots (--series-*, app.css). Text stays in text colours. */
  .multi {
    width: 100%;
  }
  .multi svg {
    display: block;
    width: 100%;
    height: 3rem;
    overflow: visible;
  }
  /* A chart takes the card's spare height (a taller neighbour sets the row), so no hole opens under it. */
  .bars {
    width: 100%;
    max-width: 14rem;
  }
  .bars svg {
    display: block;
    width: 100%;
    height: 2.5rem;
  }
  .bars rect {
    fill: var(--chart-color-1);
  }
  .bars rect.weekend {
    fill: var(--chart-color-2);
  }
  .bar-labels {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    margin-top: 0.15rem;
    color: var(--color-text-muted);
    font-size: 0.68rem;
    text-align: center;
  }
  .bar-labels .weekend {
    color: var(--color-text);
    font-weight: 700;
  }
  .hl-card > .bars,
  .hl-card > .multi,
  .hl-card > .spark {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
  }
  .hl-card > .bars svg,
  .hl-card > .multi svg,
  .hl-card > .spark svg {
    flex: 1 0 auto;
  }
  /* A findings card's height is fixed: its chart takes the spare height, down to a readable minimum.
     While details are fitted (.fit), charts sit at their base height so details only take true spare. */
  .finding > :is(.bars, .multi, .spark) {
    flex: 1 1 0;
  }
  .finding > :is(.bars, .multi, .spark) svg {
    flex: 1 1 0;
    min-height: 1.5rem;
  }
  :global(.finding-grid.fit) .finding > :is(.bars, .multi, .spark),
  :global(.finding-grid.fit) .finding > :is(.bars, .multi, .spark) svg {
    flex: none;
  }
  .multi polyline {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.1rem 0.6rem;
    margin: 0.2rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.72rem;
    line-height: 1.3;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }
  .swatch {
    flex-shrink: 0;
    width: 0.7rem;
    height: 2px;
    border-radius: 1px;
  }
  .story-visual .multi {
    max-width: 32rem;
  }
  .story-visual .multi svg {
    height: 5rem;
  }
  .vs-x {
    margin-top: var(--space-2);
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  /* A long side label clamps to 3 lines, fewer when the card tightens; the full text is in the card's popover and title. */
  .vs-label {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--vs-clamp, 3);
    line-clamp: var(--vs-clamp, 3);
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
  .story-head .mode-tip-button {
    flex-shrink: 0;
  }
  /* Supporting lists (details): small label, names left, values right; they take the card's spare
     height, centred, so a short card beside a chart card has no hole. */
  .details:not(:has(.dgroup:not([hidden]))),
  .details :global(li[hidden]) {
    display: none;
  }
  .details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
    flex: 1 0 auto;
    width: 100%;
    margin-top: var(--space-1);
    text-align: left;
  }
  .dlabel {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .details ol {
    margin: 0.15rem 0 0;
    padding: 0;
    list-style: none;
  }
  .details li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    padding: 0.15rem 0;
    border-top: 1px solid var(--color-border);
    font-size: 0.78rem;
    line-height: 1.3;
  }
  .dname {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  /* Two-up phone cards: a name takes the full line, its value under it at the right. */
  @container (max-width: 519px) {
    .finding-grid .details li {
      flex-wrap: wrap;
      gap: 0 var(--space-2);
    }
    .finding-grid .dval {
      margin-left: auto;
    }
  }
  .dval {
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
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
  /* Too early to tell: compact rows in the tile language, two across from ~44rem; an odd last row spans. */
  .early {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
    gap: var(--space-2) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 720px) {
    .early {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .early li:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }
  }
  .early li {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .early-top,
  .early-foot {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .early-foot b {
    flex-shrink: 0;
    color: var(--color-text);
    font-weight: 600;
  }
  .early-foot span {
    text-align: right;
  }
  .early-theme {
    color: var(--color-label);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68rem;
  }
  .early-head {
    margin: 0;
    font-weight: 600;
    line-height: 1.3;
  }
  .early-why {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    line-height: 1.35;
  }
  .meter {
    margin-top: auto;
    height: 0.4rem;
    border-radius: 999px;
    background: var(--color-border);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--color-accent);
  }
</style>
