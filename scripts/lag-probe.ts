// Event-loop lateness probe (stand-in for UI lag): one JSON line per second.
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
let late: number[] = [];
let last = performance.now();
function tick() {
  const now = performance.now();
  late.push(Math.max(0, now - last - 10));
  last = now;
  setTimeout(tick, 10);
}
setTimeout(tick, 10);
setInterval(() => {
  const s = sorted(late);
  late = [];
  if (!s.length) return;
  const r = (n: number) => Math.round(n * 100) / 100;
  console.log(JSON.stringify({ t: Date.now(), p95: r(s[Math.ceil(0.95 * s.length) - 1]), max: r(s[s.length - 1]) }));
}, 1000);
