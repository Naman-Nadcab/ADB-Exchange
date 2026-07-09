#!/usr/bin/env bash
# Mission 3 — Final Tier-1 Release Certification
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="$ROOT/e2e/reports/mission3-certification.json"
LOG="$ROOT/e2e/reports/mission3-run.log"
PW_IMAGE="${PW_IMAGE:-mcr.microsoft.com/playwright:v1.49.0-jammy}"
mkdir -p "$ROOT/e2e/reports" "$ROOT/docs/reports"

exec > >(tee "$LOG") 2>&1

echo "=== Mission 3: Final Tier-1 Release Certification ==="
echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export BASE_URL="${BASE_URL:-http://127.0.0.1}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:4000}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4000}"
export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1}"

if [[ -f "$ROOT/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  REDIS_URL="$(grep -E '^REDIS_URL=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL REDIS_URL
fi
DB_URL="${MISSION2_DATABASE_URL:-${DATABASE_URL:-}}"
DB_URL="${DB_URL/postgres:/127.0.0.1:}"

PHASES=()
FAILURES=()

run_phase() {
  local id="$1" name="$2"
  shift 2
  echo ""
  echo "=== Phase: $name ==="
  local started=$(date +%s)
  if "$@"; then
    local elapsed=$(( $(date +%s) - started ))
    PHASES+=("$id:PASS:${elapsed}s")
    echo "[PASS] $name (${elapsed}s)"
  else
    local elapsed=$(( $(date +%s) - started ))
    PHASES+=("$id:FAIL:${elapsed}s")
    FAILURES+=("$id:$name")
    echo "[FAIL] $name (${elapsed}s)"
  fi
}

docker_node() {
  docker run --rm --network host -v "$ROOT:/work" -w /work "$PW_IMAGE" "$@"
}

# --- Phase 1: Performance ---
phase1_performance() {
  docker_node node scripts/perf-baseline.mjs 2>&1 | tee "$ROOT/e2e/reports/mission3-perf-baseline.json" | tail -5
  docker_node node scripts/load-gate.mjs 2>&1 | tee "$ROOT/e2e/reports/mission3-load-gate.log" | tail -8
  python3 "$ROOT/scripts/mission3-latency-snapshot.py" | tee "$ROOT/e2e/reports/mission3-latency.json"
}

# --- Phase 2+3: Resilience + Chaos ---
phase2_resilience() {
  BASE_URL="$E2E_BASE_URL" DRILL_SERVICES="redis" DRILL_TIMEOUT_SEC=120 bash "$ROOT/scripts/incident-drill.sh"
}

phase3_chaos() {
  BASE_URL="$E2E_BASE_URL" DRILL_SERVICES="nats redis" DRILL_TIMEOUT_SEC=120 bash "$ROOT/scripts/incident-drill.sh"
  # Backend restart recovery
  docker compose -f "$ROOT/docker-compose.production.yml" restart backend >/dev/null
  ok=0
  for _ in $(seq 1 60); do
    if curl -sf "$E2E_BASE_URL/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 2
  done
  [[ "$ok" = "1" ]]
}

# --- Phase 4: Regression ---
phase4_regression() {
  bash "$ROOT/scripts/run-mission2-certification.sh"
}

# --- Phase 5: Security ---
phase5_security() {
  docker run --rm --network host -v "$ROOT:/work" -w /work \
    -e E2E_BASE_URL \
    $( [[ -f "$ROOT/e2e/.e2e-credentials.json" ]] && echo "-e E2E_JWT=$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_JWT'])")" ) \
    "$PW_IMAGE" npx tsx security/run-security-tests.ts 2>&1 | tee "$ROOT/e2e/reports/mission3-security.log" | tail -5
}

# --- Phase 6+7: Forensic + cleanliness ---
phase6_forensic() {
  python3 "$ROOT/scripts/mission3-forensic-audit.py" | tee "$ROOT/e2e/reports/mission3-forensic.json"
}

# --- Phase 9: Build + typecheck + tier1 ---
phase9_build() {
  docker_node bash -c 'npm run build --workspace=@exchange/backend 2>&1 | tail -3'
  docker_node bash -c 'cd apps/frontend && npm run build 2>&1 | tail -5'
  docker_node bash -c 'cd apps/admin-panel && npm run build 2>&1 | tail -5'
  docker_node npx tsx apps/backend/scripts/tier1-phase1-verify.ts 2>&1 | tail -3
  docker_node npx tsx apps/backend/scripts/tier1-phase2-verify.ts 2>&1 | tail -3
  docker_node npx tsx apps/backend/scripts/tier1-phase3-verify.ts 2>&1 | tail -3
}

run_phase "P1" "Performance certification" phase1_performance || true
run_phase "P2" "Resilience (redis restart)" phase2_resilience || true
run_phase "P3" "Chaos (nats+redis+backend restart)" phase3_chaos || true
run_phase "P4" "Mission 2 regression" phase4_regression || true
run_phase "P5" "Security certification" phase5_security || true
run_phase "P6" "Repository forensic audit" phase6_forensic || true
run_phase "P9" "Build + tier1 verify" phase9_build || true

python3 "$ROOT/scripts/mission3-report.py" --phases "${PHASES[*]}" --failures "${FAILURES[*]}" --log "$LOG"
echo "Report: $REPORT"
