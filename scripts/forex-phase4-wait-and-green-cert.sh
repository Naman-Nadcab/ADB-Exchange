#!/usr/bin/env bash
# Bounded wait for Forex session open, then run live GREEN cert + update master status.
# No session bypass. Max wait default 40h.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/.build"
LOG="$BUILD/forex-phase4-wait-cert.log"
MAX_WAIT_SEC="${P4_MAX_WAIT_SEC:-144000}"
INTERVAL_SEC="${P4_POLL_SEC:-300}"
API="${FOREX_LIVE_API:-http://127.0.0.1:4000}"
deadline=$(( $(date +%s) + MAX_WAIT_SEC ))

mkdir -p "$BUILD"
exec > >(tee -a "$LOG") 2>&1

echo "=== Phase 4 wait-and-green-cert started $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

while [ "$(date +%s)" -lt "$deadline" ]; do
  open=$(curl -sf "$API/api/v1/forex/sessions" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['eligibility'].get('open', False))" 2>/dev/null || echo False)
  reason=$(curl -sf "$API/api/v1/forex/sessions" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['eligibility'].get('reason',''))" 2>/dev/null || echo UNKNOWN)
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) session open=$open reason=$reason"
  if [ "$open" = "True" ]; then
    echo "Session OPEN — running live GREEN cert"
    cd "$ROOT" && node scripts/forex-phase4-live-green-cert.mjs
    ec=$?
    if [ "$ec" -eq 0 ]; then
      echo "Phase 4 GREEN — Phase 5 certification may proceed (manual/browser follow-up in cert script output)"
    fi
    exit "$ec"
  fi
  sleep "$INTERVAL_SEC"
done

echo "Max wait exceeded without open session — checkpoint NOT_PROVEN"
python3 - <<PY
import json, datetime
p = {
  "phase": 4,
  "verdict": "CONDITIONAL",
  "blocked": "SESSION_WAIT_TIMEOUT",
  "completedUtc": datetime.datetime.utcnow().isoformat() + "Z",
}
open("$BUILD/forex-phase4-wait-timeout.json", "w").write(json.dumps(p, indent=2))
PY
exit 2
