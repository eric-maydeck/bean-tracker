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
      if (chart.config.type !== 'bar') return;
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
    height = 320
  }: {
    type: 'bar' | 'doughnut';
    labels: string[];
    values: number[];
    datasetLabel?: string;
    height?: number;
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

  function render() {
    const textColor = themeColor('--color-text');
    const gridColor = themeColor('--color-border');
    const surfaceColor = themeColor('--color-surface');

    chart?.destroy();
    chart = new ChartJS(canvasEl, {
      type,
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            backgroundColor: paletteColors(labels.length),
            borderWidth: type === 'doughnut' ? 2 : 0,
            borderColor: surfaceColor
          }
        ]
      },
      options: {
        indexAxis: type === 'bar' ? 'y' : undefined,
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        // Leaves room on the right so the value-label plugin's text doesn't
        // get clipped when a bar's own value already reaches the chart edge.
        layout: type === 'bar' ? { padding: { right: 48 } } : undefined,
        plugins: {
          legend: { display: type === 'doughnut', labels: { color: textColor } },
          tooltip: { enabled: true },
          datalabels:
            type === 'doughnut'
              ? {
                  color: '#fff',
                  font: { weight: 'bold', size: 12 },
                  // Only label a slice once it's big enough for the text to
                  // actually fit inside it without looking cramped.
                  formatter: (value: number, ctx) => {
                    const data = (ctx.chart.data.datasets[0]?.data ?? []) as number[];
                    const total = data.reduce((sum, v) => sum + (v ?? 0), 0);
                    const share = total > 0 ? value / total : 0;
                    return share >= 0.08 ? value.toLocaleString('en-US') : '';
                  }
                }
              : { display: false }
        },
        scales:
          type === 'bar'
            ? {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { display: false } }
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
