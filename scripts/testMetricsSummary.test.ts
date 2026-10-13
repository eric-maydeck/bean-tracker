import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stats, summarize } from './testMetricsSummary.ts';

describe('stats', () => {
  it('computes mean, nearest-rank p95, min, max', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(stats(xs)).toEqual({ mean: 10.5, p95: 19, max: 20, min: 1 });
  });
  it('returns zeros for empty input', () => {
    expect(stats([])).toEqual({ mean: 0, p95: 0, max: 0, min: 0 });
  });
});

const mac = (cpu: number, temp: number, rpms: number[]) =>
  JSON.stringify({
    cpu_active_ratio: cpu, pcpu_active_ratio: cpu, ecpu_active_ratio: cpu / 2,
    temp: { cpu_temp_avg: temp, gpu_temp_avg: temp - 1 }, sys_power: 10, pcpu_freq_mhz: 2638,
    fans: rpms.map((rpm, i) => ({ max_rpm: 7826, name: `fan${i}`, rpm })),
    memory: { ram_total: 51539607552, ram_usage: 25e9, swap_total: 0, swap_usage: 1e9 }
  });
const sys = (load: string, therm: string) =>
  JSON.stringify({ t: 1, load, memFree: '88%', therm });
const NOTE = 'Note: No thermal warning level has been recorded Note: No CPU power status has been recorded ';

describe('summarize', () => {
  it('maps fixture files to metrics', () => {
    const d = mkdtempSync(join(tmpdir(), 'tm-'));
    writeFileSync(join(d, 'macmon.jsonl'), mac(0.5, 50, [0, 3000]) + '\n' + mac(0.7, 70, [100, 0]) + '\n');
    writeFileSync(join(d, 'sys.jsonl'),
      sys('{ 2.00 1.00 1.00 }', NOTE) + '\n' + sys('{ 4.00 1.00 1.00 }', NOTE + 'CPU_Speed_Limit = 80') + '\n');
    writeFileSync(join(d, 'lag.jsonl'),
      '{"t":1,"p95":1,"max":2}\n{"t":2,"p95":1,"max":9}\n');
    writeFileSync(join(d, 'iostat.txt'),
      '  disk0 \nKB/t tps MB/s\n25.0 67 99.0\n10.0 10 4.0\n10.0 10 6.0\n');
    writeFileSync(join(d, 'run.json'), '{ "wallS": 12.5, "exitCode": 0 }');
    const s = summarize(d);
    expect(s.cpuTempC.max).toBe(70);
    expect(s.fanRpm.max).toBe(3000);
    expect(s.load1.mean).toBe(3);
    expect(s.lagMs.p95).toBe(9);
    expect(s.diskMBps.mean).toBe(5);
    expect(s.cpuPct.max).toBe(70);
    expect(s.wallS).toBe(12.5);
    expect(s.thermalWarnings).toEqual(['CPU_Speed_Limit = 80']);
  });
});
