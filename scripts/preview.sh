#!/usr/bin/env bash
# LAN preview server on a scratch copy of the prod DB. Usage: scripts/preview.sh [db]
# Login password is `test`. The scratch copy is deleted on exit.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-.preview-data/prod-copy.db}"
[ -f "$src" ] || { echo "no such db: $src" >&2; exit 1; }
ip="$(ipconfig getifaddr en0 || ipconfig getifaddr en1)"
scratch=".preview-data/scratch-$(date +%s).db"
mkdir -p .preview-data
cp "$src" "$scratch"
trap 'kill "${pid:-}" 2>/dev/null || true; rm -f "$scratch" "$scratch"-wal "$scratch"-shm' EXIT
trap 'exit 130' INT TERM
export DB_PATH="$scratch" SESSION_SECRET="$(openssl rand -hex 32)"
ADMIN_PASSWORD_HASH="$(node scripts/hash-password.ts test)"
export ADMIN_PASSWORD_HASH
echo "Preview: http://$ip:5199  password: test  (db: $scratch)"
node_modules/.bin/vite dev --host --port 5199 --strictPort &
pid=$!
wait "$pid"
