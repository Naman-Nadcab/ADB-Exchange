#!/usr/bin/env bash
# Final production closure — run all verification suites and generate certification bundle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs/production-closure"
PW_IMAGE="${PW_IMAGE:-mcr.microsoft.com/playwright:v1.49.0-jammy}"
mkdir -p "$DOCS"

export ADMIN_BASE="${ADMIN_BASE:-http://109.123.254.30/admin}"
export API_BASE="${API_BASE:-http://127.0.0.1:4000}"
export ORDER_TIERS="${ORDER_TIERS:-500,2000,5000}"

run_node() {
  local script="$1"
  local outdir="$2"
  docker run --rm --network host \
    -v "$ROOT:/work" -w /work \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e ADMIN_BASE -e API_BASE -e E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}" \
    -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin123}" \
    -e ORDER_TIERS -e OUT_DIR="$outdir" \
    node:20-bookworm-slim \
    bash -c 'apt-get update -qq && apt-get install -qq -y docker.io curl >/dev/null 2>&1 && node '"$script" 2>&1 | tee "$outdir/run.log" || return 1
}

run_playwright() {
  local script="$1"
  local outdir="$2"
  docker run --rm --network host \
    -v "$ROOT:/work" -w /work \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e ADMIN_BASE -e API_BASE -e E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}" \
    -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin123}" \
    -e OUT_DIR="$outdir" \
    "$PW_IMAGE" \
    bash -c 'apt-get update -qq && apt-get install -qq -y docker.io >/dev/null 2>&1 && npx playwright install chromium >/dev/null 2>&1 && node '"$script" 2>&1 | tee "$outdir/run.log" || return 1
}

echo "=== Rebuild admin-panel (session UI fixes) ==="
cd "$ROOT"
docker compose -f docker-compose.production.yml build admin-panel 2>&1 | tail -5
docker compose -f docker-compose.production.yml up -d admin-panel 2>&1 | tail -3
sleep 8

RESULTS=()
run_or_warn() {
  local name="$1" script="$2" dir="$3" runner="${4:-node}"
  mkdir -p "$dir"
  echo ""
  echo "=== $name ==="
  if [[ "$runner" == "playwright" ]]; then
    if run_playwright "$script" "$dir"; then RESULTS+=("$name:PASS"); else RESULTS+=("$name:FAIL"); fi
  elif [[ "$runner" == "load" ]]; then
    if run_load_test "$dir"; then RESULTS+=("$name:PASS"); else RESULTS+=("$name:FAIL"); fi
  else
    if run_node "$script" "$dir"; then RESULTS+=("$name:PASS"); else RESULTS+=("$name:FAIL"); fi
  fi
}

run_load_test() {
  local outdir="$1"
  mkdir -p "$outdir"
  docker run --rm --network container:exchange-backend \
    -v "$ROOT:/work" -w /work \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e ORDER_TIERS -e OUT_DIR="$outdir" \
    -e MATCH_ENGINE_URL=http://matching-engine:7101 \
    node:20-bookworm-slim \
    bash -c 'apt-get update -qq && apt-get install -qq -y docker.io curl >/dev/null 2>&1 && node scripts/matching-engine-load-test.mjs' \
    2>&1 | tee "$outdir/run.log" || return 1
}

run_or_warn "Match engine durability" "scripts/verify-match-engine-durability.mjs" "$ROOT/docs/verification-match-engine"
run_or_warn "Match engine load test" "" "$ROOT/docs/verification-match-load" load
run_or_warn "Financial integrity" "scripts/verify-financial-integrity.mjs" "$ROOT/docs/verification-financial"
run_or_warn "Infrastructure" "scripts/verify-infrastructure.mjs" "$ROOT/docs/verification-infrastructure"
run_or_warn "Realtime WS" "scripts/verify-realtime.mjs" "$ROOT/docs/verification-realtime" playwright
run_or_warn "Alert center" "scripts/verify-alert-center.mjs" "$ROOT/docs/verification-alerts" playwright
run_or_warn "Admin full sweep" "scripts/verify-admin-full-sweep.mjs" "$ROOT/docs/verification-admin-sweep" playwright

# Monitoring controls — skip destructive restarts by default
export SKIP_RESTART_TESTS=1
run_or_warn "Monitoring controls (non-restart)" "scripts/verify-monitoring-controls.mjs" "$ROOT/docs/verification-controls" playwright

echo ""
echo "=== Aggregating production closure report ==="
docker run --rm --network host -v "$ROOT:/work" -w /work \
  -v /var/run/docker.sock:/var/run/docker.sock \
  node:20-bookworm-slim \
  bash -c 'apt-get update -qq && apt-get install -qq -y docker.io >/dev/null 2>&1 && node scripts/verify-production-closure.mjs' \
  2>&1 | tee "$DOCS/certification.log"
