#!/usr/bin/env bash
# Post-deploy health checks for VPS production stack.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${1:-http://127.0.0.1}"
FAIL=0

check() {
  local name="$1" url="$2"
  if curl -sf --max-time 15 "$url" >/dev/null; then
    echo "OK  $name"
  else
    echo "FAIL $name ($url)"
    FAIL=1
  fi
}

echo "=== VPS health checks (base: $BASE) ==="
check "nginx healthz" "$BASE/healthz"
check "backend liveness" "$BASE/health/live"
check "backend health" "$BASE/health"
check "spot markets API" "$BASE/api/v1/spot/markets"

if [ "$FAIL" -eq 0 ]; then
  echo "=== PASS ==="
  exit 0
fi
echo "=== FAIL ==="
exit 1
