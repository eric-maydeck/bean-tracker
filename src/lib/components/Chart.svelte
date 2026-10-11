<script lang="ts">
  import { Chart as ChartJS, registerables, type Plugin } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';

  // Only draws for horizontal bar charts (this app's composition breakdown) —
  // Chart.js has no built-in "show the value next to each bar" option, and
  // chartjs-plugin-datalabels (used below for the doughnut in-slice labels)
  // doesn't anchor cleanly past the end of a horizontal bar the way this
  // does, so both live here for their own chart type.
  const valueLabelsPlugin: Plugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      if (chart.config.type !== 'bar' || chart.options.indexAxis !== 'y') return;
      const { ctx } = chart;
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value == null) return;
          const { x, y } = element.tooltipPosition(true);
          ctx.save();
          ctx.fillStyle = textColor;
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(Number(value).toLocaleString('en-US'), x + 6, y);
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
    format,
    dots = true,
    monotone = false,
    integer = false,
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
    // line overlay; otherwise a paired series in the next palette colour.
    series?: { label: string; values: (number | null)[]; faded?: boolean; dashed?: boolean }[];
    // Vertical bars: a fitted value axis floor (a 1–10 rating scale), instead of zero.
    yMin?: number;
    // Vertical bars and plain lines: the tooltip's value text.
    format?: (v: number) => string;
    // Plain lines: point markers (off for dense series, where they merge into a blob).
    dots?: boolean;
    // Plain lines: monotone interpolation, so a step (a delivery) never overshoots past real values.
    monotone?: boolean;
    // Value axis: whole-number ticks (counts), never 0.1 steps.
    integer?: boolean;
    // Always show the legend, so paired charts' plot areas line up.
    legend?: boolean;
  } = $props();

  let canvasEl: HTMLCanvasElement;
  let chart: ChartJS | undefined;

  function themeColor(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function paletteColors(count: number): string[] {
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(themeColor(`--chart-color-${(i % 8) + 1}`));
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

  function render() {
    const textColor = themeColor('--color-text');
    const gridColor = themeColor('--color-border');
    const surfaceColor = themeColor('--color-surface');

    // A line chart is a single trend over time, not a set of discrete
    // categories — one line color (for the line and its point markers)
    // reads more naturally than the bar/doughnut per-category palette, and
    // filling the area under the line would visually overstate a rating
    // scale that doesn't start at 0.
    const lineColor = themeColor('--chart-color-1');
    const bgColors = paletteColors(labels.length);
    const vbar = type === 'bar' && vertical;

    chart?.destroy();
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
                // ponytail: assumes --chart-color-1 is 6-digit hex. 7-digit hex + alpha byte: the raw series stays visible as
                // texture without competing with the trend line.
                backgroundColor: `${lineColor}4d`,
                barPercentage: 1,
                categoryPercentage: 1
              }
            : type === 'line'
            ? {
                label: datasetLabel,
                data: values,
                borderColor: lineColor,
                backgroundColor: lineColor,
                pointBackgroundColor: lineColor,
                borderWidth: 2,
                pointRadius: dots ? 3 : 0,
                tension: 0.25,
                ...(monotone && { cubicInterpolationMode: 'monotone' as const }),
                fill: false
              }
            : vbar
            ? { label: datasetLabel, data: values, backgroundColor: lineColor, borderWidth: 0 }
            : {
                label: datasetLabel,
                data: values,
                backgroundColor: bgColors,
                borderWidth: type === 'doughnut' ? 2 : 0,
                borderColor: surfaceColor
              },
          ...(type === 'line' && trendValues
            ? [
                {
                  label: trendLabel,
                  data: trendValues,
                  borderColor: lineColor,
                  backgroundColor: lineColor,
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
              ? { type: 'line' as const, label: x.label, data: x.values, borderColor: lineColor, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false }
              : { label: x.label, data: x.values, backgroundColor: x.faded ? `${lineColor}4d` : themeColor(`--chart-color-${i + 2}`), borderWidth: 0 }
          )
        ]
      },
      options: {
        indexAxis: type === 'bar' && !vertical ? 'y' : undefined,
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        // Line charts read by date: hovering anywhere over a day shows every
        // series' value for it, not just a point under the cursor.
        interaction: type === 'line' ? { mode: 'index', intersect: false } : undefined,
        // Leaves room on the right so the value-label plugin's text doesn't
        // get clipped when a bar's own value already reaches the chart edge.
        layout: type === 'bar' && !vertical ? { padding: { right: 48 } } : undefined,
        plugins: {
          legend: { display: legend || type === 'doughnut' || !!trendValues || series.length > 0, labels: { color: textColor } },
          // Trend charts: raw values are whole counts/grams, the average gets
          // one decimal — never a 15-digit float in the tooltip.
          tooltip: format && !trendValues
            ? { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${format(ctx.parsed.y ?? 0)}` } }
            : trendValues
            ? {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(ctx.datasetIndex === 0 ? 0 : 1)}${unit}`
                }
              }
            : { enabled: true },
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
                x: { suggestedMax: valueAxisMax, ticks: { color: textColor }, grid: { color: gridColor } },
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
    void format;
    void dots;
    void monotone;
    void integer;
    void legend;
    render();

    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      chart?.destroy();
      chart = undefined;
    };
  });
</script>

<div class="chart-container" style="height: {height}px">
  <canvas bind:this={canvasEl}></canvas>
</div>
