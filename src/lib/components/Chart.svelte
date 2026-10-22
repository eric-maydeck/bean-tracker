<script lang="ts">
  import { Chart as ChartJS, registerables, type Plugin } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  import { seriesToken } from './chartColor';
  import { sampleField, type Sample } from '$lib/sample';
  import FloatTip from './FloatTip.svelte';
  import TipBody, { type Tip } from './TipBody.svelte';

  // Only draws for horizontal bar charts (this app's composition breakdown) —
  // Chart.js has no built-in "show the value next to each bar" option, and
  // chartjs-plugin-datalabels (used below for the doughnut in-slice labels)
  // doesn't anchor cleanly past the end of a horizontal bar the way this
  // does, so both live here for their own chart type.
  const valueLabelsPlugin: Plugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart, _args, opts: { format?: (v: number) => string }) {
      if ((chart.config as { type?: string }).type !== 'bar' || chart.options.indexAxis !== 'y') return;
      const { ctx } = chart;
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value == null) return;
          const { x, y } = element.tooltipPosition(true);
          if (x == null || y == null) return;
          ctx.save();
          ctx.fillStyle = textColor;
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          // `format` (the chart's prop, carried on its options) when set: money as usd (ui-rules 46).
          ctx.fillText(opts?.format ? opts.format(Number(value)) : Number(value).toLocaleString('en-US'), x + 6, y);
          ctx.restore();
        });
      });
    }
  };

  ChartJS.register(...registerables, valueLabelsPlugin, ChartDataLabels);

  let {
    type,
    labels,
    values,
    datasetLabel = '',
    height = 320,
    valueAxisMax,
    trendValues,
    trendLabel = '',
    unit = '',
    vertical = false,
    series = [],
    yMin,
    samples,
    format,
    tipFormat,
    titles,
    dots = true,
    monotone = false,
    integer = false,
    dashGaps = false,
    legend = false
  }: {
    type: 'bar' | 'doughnut' | 'line';
    labels: string[];
    values: (number | null)[];
    datasetLabel?: string;
    height?: number;
    // Bar charts only: pins the value axis's upper bound so it doesn't
    // rescale as the data changes. A suggestedMax, not a hard max, so
    // Chart.js still rounds it up to a clean tick.
    valueAxisMax?: number;
    // Line charts only: a smoothed series of the same measure drawn bold on
    // top, with `values` demoted to a faint raw line underneath (e.g. daily
    // counts under their rolling average). Same hue, so it reads as one
    // measure at two levels of noise rather than two competing series.
    trendValues?: number[];
    trendLabel?: string;
    // Trend charts only: suffix for y-axis ticks and tooltip values (e.g. 'g').
    unit?: string;
    // Bar charts only: upright bars in one hue (a distribution, not ranked categories).
    vertical?: boolean;
    // Extra series after `values`: faded = the compare window in the same hue; dashed = a
    // line overlay; otherwise a paired series in the next palette color.
    // `names`: per-bar dates for the tooltip when a series' bar covers other days than the axis label says.
    series?: { label: string; values: (number | null)[]; faded?: boolean; dashed?: boolean; names?: (string | null)[] }[];
    // Vertical bars: a fitted value axis floor (a 1–10 rating scale), instead of zero.
    yMin?: number;
    // The tooltip's value text, and horizontal bars' value labels.
    format?: (v: number) => string;
    // The tooltip's value text when it differs from the label's (money: the label rounds, the tip has the cents; a
    // second unit in parentheses, "1,750 g (14 bags)", from the bar's index `i`). A tip value carries its unit
    // (ui-rules 36).
    tipFormat?: (v: number, i: number) => string;
    // Vertical bars: tooltip titles, when the axis labels are abbreviated.
    titles?: string[];
    // Plain lines: point markers (off for dense series, where they merge into a blob).
    dots?: boolean;
    // Plain lines: monotone interpolation, so a step (a delivery) never overshoots past real values.
    monotone?: boolean;
    // Plain lines: a null (no data) is bridged by a dashed segment in the line's color; isolated points join their neighbors.
    dashGaps?: boolean;
    // Value axis: whole-number ticks (counts), never 0.1 steps.
    integer?: boolean;
    // Vertical bars: per-bar samples (sample.ts); a small one is striped over its color, its tip adds a Sample row.
    samples?: Sample[];
    // Always show the legend, so paired charts' plot areas line up.
    legend?: boolean;
  } = $props();

  let canvasEl: HTMLCanvasElement;
  let chart: ChartJS | undefined;

  function themeColor(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // One tip look (ui-rules 36, T1): Chart.js draws no tooltip of its own; its tooltip model renders as the shared
  // HTML tip (TipBody in a FloatTip) at the caret: the x label as the title, each "Series: value" line as a
  // label/value row (a line without a value stays a line).
  let tipAt = $state<{ x: number; y: number; tip: Tip } | null>(null);
  let tipAnchor: HTMLSpanElement | undefined = $state();
  const external = ({ tooltip }: { tooltip: { opacity: number; caretX: number; caretY: number; title?: string[]; body?: { lines: string[] }[]; dataPoints?: { datasetIndex: number; dataIndex: number }[] } }) => {
    if (!tooltip.opacity) return (tipAt = null);
    const all = (tooltip.body ?? []).flatMap((b) => b.lines);
    const split = all.map((l) => [l, l.lastIndexOf(': ')] as const);
    const rows = split.filter(([, i]) => i > 0).map(([l, i]): [string, string] => [l.slice(0, i), l.slice(i + 2)]);
    const lines = split.filter(([, i]) => i <= 0).map(([l]) => l);
    const title = (tooltip.title ?? []).join(' ');
    // No title: one row's label is the title over its value; several rows keep all of them under no title.
    const dp = tooltip.dataPoints?.[0];
    const sample = dp && dp.datasetIndex === 0 && samples?.[dp.dataIndex] ? sampleField(samples[dp.dataIndex]) : {};
    tipAt = { x: tooltip.caretX, y: tooltip.caretY, tip: { ...(title ? { title, rows, lines } : rows.length > 1 ? { title: '', rows, lines } : { title: rows[0]?.[0] ?? lines[0] ?? '', rows: [], lines: rows[0] ? [rows[0][1]] : lines.slice(1) }), ...sample } };
  };

  // The site's palette by position (ui-rules 42); `ink`: the same slot's -ink token, which outlines pastel fills.
  function paletteColors(count: number, ink = ''): string[] {
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(themeColor(seriesToken(i % 14, count) + ink));
    }
    return colors;
  }

  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
  }

  function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (v: number) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Always a shade of the slice's own hue, never plain white/black: a light
  // slice gets a dark label in the same hue (dark green on light green), a
  // dark slice gets a light label in the same hue (light green on dark
  // green). Keeping the background's own saturation, only pushing lightness
  // toward one end, is what keeps the label reading as "the same color,
  // darker/lighter" rather than a generic neutral overlay.
  function datalabelColorFor(backgroundHex: string): string {
    const { h, s, l } = hexToHsl(backgroundHex);
    return hslToHex(h, s, l > 0.5 ? 0.22 : 0.82);
  }

  // The canvas twin of --thin-hatch: surface stripes over the bar's full color (ui-rules 29).
  function hatch(color: string, stripe: string): CanvasPattern | string {
    const t = document.createElement('canvas');
    t.width = t.height = 8;
    const g = t.getContext('2d');
    if (!g) return color;
    g.fillStyle = color;
    g.fillRect(0, 0, 8, 8);
    g.strokeStyle = stripe;
    g.globalAlpha = 0.7;
    g.lineWidth = 3;
    for (const k of [0, 8, 16]) { g.beginPath(); g.moveTo(k, 0); g.lineTo(0, k); g.stroke(); }
    return g.createPattern(t, 'repeat') ?? color;
  }

  function render() {
    const textColor = themeColor('--color-text');
    const gridColor = themeColor('--color-border');
    const surfaceColor = themeColor('--color-surface');

    // A line chart is a single trend over time, not a set of discrete
    // categories — one line color (for the line and its point markers)
    // reads more naturally than the bar/doughnut per-category palette, and
    // filling the area under the line would visually overstate a rating
    // scale that doesn't start at 0.
    const lineColor = themeColor(seriesToken(0, series.length + 1)); // brown up to 3 series, else the palette's first slot
    const lineInk = themeColor(`${seriesToken(0, series.length + 1)}-ink`); // strokes and outlines: pastel fills fail 3:1 alone
    const bgColors = paletteColors(labels.length);
    const inkColors = paletteColors(labels.length, '-ink');
    const vbar = type === 'bar' && vertical;
    const gapped = dashGaps ? { spanGaps: true, segment: { borderDash: (c: { p0: { skip: boolean }; p1: { skip: boolean } }) => (c.p0.skip || c.p1.skip ? [6, 4] : undefined) } } : {};

    chart?.destroy();
    tipAt = null; // a rebuilt chart never fires the old hover's close
    chart = new ChartJS(canvasEl, {
      type,
      data: {
        labels,
        datasets: [
          type === 'line' && trendValues
            ? {
                // Thin full-width bars rather than a second line: a daily
                // count zigzags between 0 and N, which as a line is a dense
                // comb; as bars it reads as a soft volume backdrop.
                type: 'bar' as const,
                label: datasetLabel,
                data: values,
                // ponytail: assumes the color is 6-digit hex. 7-digit hex + alpha byte: the raw series stays visible as
                // texture without competing with the trend line.
                backgroundColor: `${lineInk}4d`,
                barPercentage: 1,
                categoryPercentage: 1
              }
            : type === 'line'
            ? {
                label: datasetLabel,
                data: values,
                borderColor: lineInk,
                backgroundColor: lineInk,
                pointBackgroundColor: lineInk,
                borderWidth: 2,
                pointRadius: dots ? 3 : 0,
                tension: 0.25,
                ...(monotone && { cubicInterpolationMode: 'monotone' as const }),
                ...gapped,
                fill: false
              }
            : vbar
            ? { label: datasetLabel, data: values, backgroundColor: samples ? values.map((_, i) => (samples[i]?.small ? hatch(lineColor, surfaceColor) : lineColor)) : lineColor, borderColor: lineInk, borderWidth: 1 }
            : {
                label: datasetLabel,
                data: values,
                backgroundColor: bgColors,
                // Slices: a clear dark separator (--slice-line: a very dark brown, both themes).
                borderWidth: type === 'doughnut' ? 1.5 : 1,
                borderColor: type === 'doughnut' ? themeColor('--slice-line') : inkColors
              },
          ...(type === 'line' && trendValues
            ? [
                {
                  label: trendLabel,
                  data: trendValues,
                  borderColor: lineInk,
                  backgroundColor: lineInk,
                  borderWidth: 2.5,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  tension: 0.25,
                  fill: false
                }
              ]
            : []),
          ...series.map((x, i) =>
            x.dashed
              ? { type: 'line' as const, label: x.label, data: x.values, borderColor: lineInk, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false }
              : { label: x.label, data: x.values, backgroundColor: x.faded ? `${lineInk}4d` : themeColor(seriesToken((i + 1) % 14, series.length + 1)), borderColor: themeColor(`${seriesToken((i + 1) % 14, series.length + 1)}-ink`), borderWidth: 1,
                // A multi-line chart: the first line's look (2px, dots, tension) for every line, in its own color.
                ...(type === 'line' && { borderWidth: 2, pointRadius: dots ? 3 : 0, tension: 0.25, ...gapped, pointBackgroundColor: themeColor(`${seriesToken((i + 1) % 14, series.length + 1)}-ink`), backgroundColor: themeColor(`${seriesToken((i + 1) % 14, series.length + 1)}-ink`) }) }
          )
        ]
      },
      // The amber corner fold of a small-sample bar (top left, 9px like the HTML .small-sample-mark; ui-rules 29): the
      // bar's top edge, its base for a bar below 0.
      plugins: samples && vbar ? [{
        id: 'sampleFold',
        afterDatasetsDraw(c) {
          const ctx = c.ctx, chip = themeColor('--chip');
          c.getDatasetMeta(0).data.forEach((bar, i) => {
            const { x, y, base, width } = bar.getProps(['x', 'y', 'base', 'width'], true) as { x: number; y: number; base: number; width: number };
            if (!samples[i]?.small || values[i] == null || !Number.isFinite(y)) return;
            const w = Math.min(9, width), l = x - width / 2, top = Math.min(y, base);
            ctx.save();
            ctx.fillStyle = chip;
            ctx.beginPath(); ctx.moveTo(l, top); ctx.lineTo(l + w, top); ctx.lineTo(l, top + w); ctx.closePath(); ctx.fill();
            ctx.restore();
          });
        }
      }] : [],
      options: {
        indexAxis: type === 'bar' && !vertical ? 'y' : undefined,
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        // A tip opens only on a mark (ui-rules 50): a bar, a slice, or within 8px of a line's point, never the
        // plot's empty space. On a line chart a point shows every series' value for its date (index mode).
        interaction: { mode: type === 'line' ? 'index' : 'nearest', intersect: true },
        elements: { point: { hitRadius: 8 } },
        // The help cursor over a mark (every mark has a tip), the arrow elsewhere.
        onHover: (_e, els, c) => (c.canvas.style.cursor = els.length ? 'help' : ''),
        // Leaves room on the right so the value-label plugin's text doesn't
        // get clipped when a bar's own value already reaches the chart edge.
        layout: type === 'bar' && !vertical ? { padding: { right: 48 } } : undefined,
        plugins: {
          legend: { display: legend || type === 'doughnut' || !!trendValues || series.length > 0, labels: { color: textColor } },
          ...({ valueLabels: { format } } as object), // the horizontal-bar value labels' text (valueLabelsPlugin)
          // Trend charts: raw values are whole counts/grams, the average gets
          // one decimal — never a 15-digit float in the tooltip.
          tooltip: { enabled: false, external, ...((format || tipFormat) && !trendValues
            ? { callbacks: { ...(titles && { title: (c) => titles[c[0].dataIndex] }), label: (ctx) => {
              const when = series[ctx.datasetIndex - 1]?.names?.[ctx.dataIndex];
              // Horizontal bars: x is the value; a doughnut's parsed value is the number itself.
              const p = ctx.parsed as number | { x: number; y: number };
              const v = (typeof p === 'number' ? p : ctx.chart.options.indexAxis === 'y' ? p.x : p.y) ?? 0;
              const line = `${ctx.dataset.label}${when ? ` (${when})` : ''}: ${tipFormat ? tipFormat(v, ctx.dataIndex) : format!(v)}`;
              return line;
            } } }
            : trendValues
            ? {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(ctx.datasetIndex === 0 ? 0 : 1)}${unit}`
                }
              }
            : {}) },
          datalabels:
            type === 'doughnut'
              ? {
                  color: (ctx) => datalabelColorFor(bgColors[ctx.dataIndex % bgColors.length]),
                  font: { weight: 'bold', size: 15 },
                  // Only label a slice once it's big enough for the text to
                  // actually fit inside it without looking cramped.
                  formatter: (value: number, ctx) => {
                    const data = (ctx.chart.data.datasets[0]?.data ?? []) as number[];
                    const total = data.reduce((sum, v) => sum + (v ?? 0), 0);
                    const share = total > 0 ? value / total : 0;
                    if (share < 0.08) return '';
                    // Two lines (value, then percentage) reads more cleanly
                    // inside a narrow slice than one long concatenated string.
                    return [value.toLocaleString('en-US'), `(${Math.round(share * 100)}%)`];
                  }
                }
              : { display: false }
        },
        scales: vbar
          ? {
              x: { ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
              y: {
                beginAtZero: yMin === undefined,
                min: yMin,
                ticks: { color: textColor, ...(integer && { precision: 0 }), ...(unit && { callback: (v: string | number) => `${v}${unit}` }) },
                grid: { color: gridColor }
              }
            }
          : type === 'bar'
            ? {
                x: { suggestedMax: valueAxisMax, ticks: { color: textColor, ...(format && { callback: (v: string | number) => format(Number(v)) }) }, grid: { color: gridColor } }, // money ticks as usd too
                y: {
                  ticks: {
                    color: textColor,
                    // Truncate to a fixed max length so the space Chart.js
                    // reserves for y-axis labels — and therefore the bar
                    // plot area's effective width — stays constant across
                    // dimensions/tabs, instead of shrinking whenever a
                    // dimension happens to have longer label text. The
                    // tooltip (below) still shows the untruncated label.
                    callback(_value, index) {
                      const label = labels[index] ?? '';
                      const maxLen = 20;
                      return label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label;
                    }
                  },
                  grid: { display: false },
                  afterFit(scale) {
                    scale.width = 170;
                  }
                }
              }
            : type === 'line'
              ? {
                  x: {
                    // Flat labels, auto-skipped: a daily series has hundreds
                    // of points, and rotated labels crowd a phone-width axis.
                    ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 16 },
                    grid: { color: gridColor }
                  },
                  y: {
                    beginAtZero: !!trendValues,
                    ticks: {
                      color: textColor,
                      ...(integer && { precision: 0 }),
                      ...(unit && { callback: (value: string | number) => `${value}${unit}` })
                    },
                    grid: { color: gridColor }
                  }
                }
              : undefined
      }
    });
  }

  // Chart.js reads CSS custom properties once, at construction time, so a
  // theme toggle (which only flips a data-theme attribute, not any of this
  // component's props) needs its own listener to pick up the new colors.
  $effect(() => {
    void type;
    void labels;
    void values;
    void datasetLabel;
    void valueAxisMax;
    void trendValues;
    void trendLabel;
    void unit;
    void vertical;
    void series;
    void yMin;
    void samples;
    void format;
    void tipFormat;
    void dots;
    void monotone;
    void integer;
    void dashGaps;
    void legend;
    render();

    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      chart?.destroy();
      chart = undefined;
      tipAt = null;
    };
  });
</script>

<div class="chart-container" style="height: {height}px">
  <canvas bind:this={canvasEl} data-dash-gaps={dashGaps || undefined}></canvas>
  <span class="tip-anchor" bind:this={tipAnchor} style:left="{tipAt?.x ?? 0}px" style:top="{tipAt?.y ?? 0}px"></span>
  {#if tipAt && tipAnchor}
    <!-- onclose: a tip that another tip dismisses unmounts, so only one .cell-tip is ever in the page (a hidden one
         left mounted broke insights-habits-rating-compare whenever the pointer sat on a chart). -->
    {#key `${tipAt.x},${tipAt.y}`}<FloatTip anchor={tipAnchor} onclose={() => (tipAt = null)}><TipBody tip={tipAt.tip} /></FloatTip>{/key}
  {/if}
</div>

<style>
  /* The tooltip's anchor: a point at the caret (FloatTip places the tip from its rect). */
  .tip-anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
</style>
