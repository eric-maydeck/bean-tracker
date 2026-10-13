import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Stat = { mean: number; p95: number; max: number; min: number };

export function stats(xs: number[]): Stat {
  if (!xs.length) return { mean: 0, p95: 0, max: 0, min: 0 };
  const s = [...xs].sort((a, b) => a - b);
  return {
    mean: xs.reduce((a, b) => a + b, 0) / xs.length,
    p95: s[Math.ceil(0.95 * s.length) - 1],
    max: s[s.length - 1],
    min: s[0]
  };
}

const lines = (f: string): string[] =>
  existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()) : [];
const jsonl = (f: string): any[] =>
  lines(f).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

const GB = 1e9;
const METRICS = ['cpuPct', 'pcpuPct', 'ecpuPct', 'cpuTempC', 'gpuTempC', 'sysPowerW', 'pcpuFreqMhz',
  'fanRpm', 'ramUsedGb', 'swapUsedGb', 'load1', 'memFreePct', 'lagMs', 'diskMBps'] as const;
export type Summary = { wallS: number; exitCode: number; thermalWarnings: string[] } &
  Record<(typeof METRICS)[number], Stat>;

// iostat -d: numeric rows are (KB/t tps MB/s) per disk; skip the first row (since-boot average).
function diskRates(f: string): number[] {
  const rows = lines(f).map((l) => l.trim().split(/\s+/)).filter((c) => c.length && c.length % 3 === 0 && c.every((x) => /^[\d.]+$/.test(x)));
  return rows.slice(1).map((c) => c.filter((_, i) => i % 3 === 2).reduce((a, x) => a + Number(x), 0));
}

export function summarize(dir: string): Summary {
  const mac = jsonl(join(dir, 'macmon.jsonl'));
  const sys = jsonl(join(dir, 'sys.jsonl'));
  const run = existsSync(join(dir, 'run.json')) ? JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) : {};
  const m = (f: (x: any) => number) => stats(mac.map(f).filter(Number.isFinite));
  const warn = new Set<string>();
  for (const s of sys) {
    // therm lines are space-joined; drop the "Note: No ... recorded" ones, keep the rest
    const rest = String(s.therm ?? '').replace(/(Note:\s*)?No [^\n]*?recorded/g, '').trim();
    if (rest) warn.add(rest);
  }
  const out: Summary = {
    wallS: run.wallS ?? 0,
    exitCode: run.exitCode ?? 0,
    cpuPct: m((x) => x.cpu_active_ratio * 100),
    pcpuPct: m((x) => x.pcpu_active_ratio * 100),
    ecpuPct: m((x) => x.ecpu_active_ratio * 100),
    cpuTempC: m((x) => x.temp?.cpu_temp_avg),
    gpuTempC: m((x) => x.temp?.gpu_temp_avg),
    sysPowerW: m((x) => x.sys_power),
    pcpuFreqMhz: m((x) => x.pcpu_freq_mhz),
    fanRpm: m((x) => Math.max(0, ...(x.fans ?? []).map((f: any) => f.rpm))),
    ramUsedGb: m((x) => x.memory?.ram_usage / GB),
    swapUsedGb: m((x) => x.memory?.swap_usage / GB),
    load1: stats(sys.map((s) => Number(String(s.load).match(/[\d.]+/)?.[0])).filter(Number.isFinite)),
    memFreePct: stats(sys.map((s) => parseFloat(s.memFree)).filter(Number.isFinite)),
    lagMs: stats(jsonl(join(dir, 'lag.jsonl')).map((x) => x.max).filter(Number.isFinite)),
    diskMBps: stats(diskRates(join(dir, 'iostat.txt'))),
    thermalWarnings: [...warn]
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(out, null, 2));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = summarize(process.argv[2]);
  const f = (n: number) => n.toFixed(1).padStart(9);
  console.log(`wall ${s.wallS}s  exit ${s.exitCode}`);
  console.log('metric'.padEnd(13) + 'mean'.padStart(9) + 'p95'.padStart(9) + 'max'.padStart(9));
  for (const k of METRICS) console.log(k.padEnd(13) + f(s[k].mean) + f(s[k].p95) + f(s[k].max));
  console.log(`thermal warnings: ${s.thermalWarnings.join('; ') || 'none'}`);
}
