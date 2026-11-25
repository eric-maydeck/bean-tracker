#!/usr/bin/env bash
# LAN preview server on a scratch copy of the prod DB (or seeded test data if there is none).
# Usage: scripts/preview.sh [--issue <id>] [--dry-run] [--mock espresso|mixed] [db]
# --mock builds a scratch DB from the made-up espresso export (scripts/mock-bq-export.ts) instead of a prod copy:
# espresso = an empty DB plus the full mock import; mixed = the seeded test data plus the full mock import.
# Port and DB follow the issue (from the branch worktree-<id>-*, or --issue; p12 = private #12),
# see scripts/ports.ts. Login password is `test`. The scratch copy is deleted on exit.
set -euo pipefail
cd "$(dirname "$0")/.."
id="" dry=0 src="" mock=""
while [ $# -gt 0 ]; do
  case $1 in
    --issue) id=$2; shift ;;
    --dry-run) dry=1 ;;
    --mock) mock=$2; shift ;;
    *) src=$1; explicit=1 ;;
  esac
  shift
done
[ -n "$id" ] || id=$(git rev-parse --abbrev-ref HEAD | sed -nE 's/^worktree-(p?[0-9]+)-.*/\1/p')
case $mock in ''|espresso|mixed) ;; *) echo "bad --mock '$mock' (want espresso or mixed)" >&2; exit 2 ;; esac
if [ -n "$id" ] && ! [[ $id =~ ^p?[0-9]+$ ]]; then echo "bad --issue '$id' (want 142 or p12)" >&2; exit 2; fi
port=$(node scripts/ports.ts port "$id")
[ -n "$src" ] || src=$(node scripts/ports.ts db "$id")
# A fresh worktree has no per-issue copy yet: take the shared one, if there is one.
default=$(node scripts/ports.ts db)
if [ ! -f "$src" ] && [ -f "$default" ] && [ -z "${explicit:-}" ]; then
  [ $dry = 1 ] || { mkdir -p "$(dirname "$src")"; cp "$default" "$src"; }
  seen=$default
fi
ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo localhost)"
if [ -n "$mock" ]; then kind="mock $mock data"
elif [ -f "$src" ] || [ -n "${seen:-}" ]; then kind="prod copy"; else kind="seeded test data"; fi
if [ $dry = 1 ]; then
  shown=${seen:-$src}; [ -z "$mock" ] || shown=.ui-test/preview-$port.db
  echo "Preview: http://$ip:$port  db: $shown ($kind)"
  exit 0
fi
mkdir -p .preview-data .ui-test
scratch=".preview-data/scratch-$(date +%s).db"
trap 'kill "${pid:-}" 2>/dev/null || true; rm -f "$scratch" "$scratch"-wal "$scratch"-shm' EXIT
trap 'exit 130' INT TERM
if [ -n "$mock" ]; then
  # Full mock import through the real import path; BQ weight curves stored like a Visualizer upload.
  scratch=".ui-test/preview-$port.db"
  rm -f "$scratch" "$scratch"-wal "$scratch"-shm
  [ "$mock" = mixed ] && npx vite-node --config scripts/vite-node.config.mjs scripts/ui-seed.ts "$scratch"
  npx vite-node --config scripts/vite-node.config.mjs scripts/mock-bq-import.ts "$scratch"
  export CONFIG_PATH=tests/ui/fixtures/config.yaml
elif [ -f "$src" ]; then
  cp "$src" "$scratch"
else
  # Same seed the UI tests use; ui-seed only writes under .ui-test/.
  scratch=".ui-test/preview-$port.db"
  npx vite-node --config scripts/vite-node.config.mjs scripts/ui-seed.ts "$scratch"
  export CONFIG_PATH=tests/ui/fixtures/config.yaml
fi
export DB_PATH="$scratch" SESSION_SECRET="$(openssl rand -hex 32)"
ADMIN_PASSWORD_HASH="$(node scripts/hash-password.ts test)"
export ADMIN_PASSWORD_HASH
echo "Preview: http://$ip:$port  password: test  (db: $scratch, $kind)"
node_modules/.bin/vite dev --host --port "$port" --strictPort &
pid=$!
wait "$pid"
