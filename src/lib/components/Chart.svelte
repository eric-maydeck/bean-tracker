<script lang="ts">
  import { Chart as ChartJS, registerables } from 'chart.js';
  ChartJS.register(...registerables);

  let {
    type,
    labels,
    values,
    datasetLabel = ''
  }: {
    type: 'bar' | 'doughnut';
    labels: string[];
    values: number[];
    datasetLabel?: string;
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
        plugins: {
          legend: { display: type === 'doughnut', labels: { color: textColor } },
          tooltip: { enabled: true }
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

<div class="chart-container">
  <canvas bind:this={canvasEl}></canvas>
</div>
