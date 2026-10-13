#!/usr/bin/env bash
# Run a command while sampling laptop metrics: scripts/test-metrics.sh <label> -- <command...>
# Output: .ui-test/metrics/<label>-<stamp>/ (summary.json + printed table). Needs macmon (brew).
set -u
label=$1; shift; [ "$1" = "--" ] && shift
out=".ui-test/metrics/$label-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$out"
macmon pipe -i 1000 > "$out/macmon.jsonl" 2>/dev/null & pids=$!
iostat -d -w 2 > "$out/iostat.txt" & pids="$pids $!"
node scripts/lag-probe.ts > "$out/lag.jsonl" & pids="$pids $!"
( while :; do
    printf '{"t":%s,"load":"%s","memFree":"%s","therm":"%s"}\n' "$(date +%s)" \
      "$(sysctl -n vm.loadavg)" "$(memory_pressure -Q | grep -o '[0-9]*%' | head -1)" \
      "$(pmset -g therm | tr '\n' ' ' | tr -d '"')"
    sleep 2
  done > "$out/sys.jsonl" ) & pids="$pids $!"
start=$(date +%s)
"$@"; code=$?
printf '{"wallS":%s,"exitCode":%s}\n' "$(( $(date +%s) - start ))" "$code" > "$out/run.json"
kill $pids 2>/dev/null; wait 2>/dev/null
node scripts/testMetricsSummary.ts "$out"
exit $code
