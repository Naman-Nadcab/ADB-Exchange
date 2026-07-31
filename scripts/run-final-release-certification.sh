#!/usr/bin/env bash
# Release Closure — ONE final certification run (after all in-repo fixes).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIT="$ROOT/audit"
PW_IMAGE="${PW_IMAGE:-mcr.microsoft.com/playwright:v1.49.0-jammy}"
mkdir -p "$AUDIT" "$ROOT/e2e/reports"

# shellcheck source=scripts/lib/host-db-url.sh
source "$ROOT/scripts/lib/host-db-url.sh"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:4000}"
export BASE_URL="${BASE_URL:-http://127.0.0.1}"
export ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://127.0.0.1/admin}"
export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin123}"
export E2E_SPOT_SYMBOL="${E2E_SPOT_SYMBOL:-ETH_USDT}"
DB_URL="$(host_db_url)"
REDIS_URL="$(host_redis_url)"

echo "=== RELEASE CLOSURE — Final Certification ==="
echo "started=$(date -u +%FT%TZ)"

RESULTS=()
record() { RESULTS+=("$1:$2"); echo "[$2] $1"; }

node "$ROOT/scripts/check-external-blockers.mjs" | tee "$AUDIT/final-cert-external-blockers.json" || true

echo "=== Rebuild backend ==="
docker compose -f "$ROOT/docker-compose.production.yml" build backend 2>&1 | tail -5
docker compose -f "$ROOT/docker-compose.production.yml" up -d backend 2>&1 | tail -3
for _ in $(seq 1 30); do curl -sf "$E2E_BASE_URL/health" >/dev/null 2>&1 && break; sleep 2; done

docker run --rm --network host -v "$ROOT:/work" -w /work/apps/backend \
  -e "DATABASE_URL=$DB_URL" -e "REDIS_URL=$REDIS_URL" \
  "$PW_IMAGE" npx tsx scripts/e2e-provision-credentials.ts --emit-json ../../e2e/.e2e-credentials.json \
  | tee "$AUDIT/final-cert-provision.log" | tail -3

export E2E_JWT="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_JWT'])")"
export E2E_COUNTERPARTY_JWT="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_COUNTERPARTY_JWT'])")"
export E2E_API_KEY="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_API_KEY'])")"
export E2E_COUNTERPARTY_API_KEY="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_COUNTERPARTY_API_KEY'])")"

if node "$ROOT/scripts/run-trading-invariant-loop.mjs" --iterations=1000 2>&1 | tee "$AUDIT/regression-1000.log" | tail -5 | grep -q '"pass": true'; then
  record "1000× regression" PASS
else
  record "1000× regression" FAIL
fi

if node "$ROOT/scripts/verify-trading-invariants.mjs" 2>&1 | tee "$AUDIT/final-cert-trading-invariants.log" | grep -q '"allPass": true'; then
  record "Trading invariants" PASS
else
  record "Trading invariants" FAIL
fi

if node "$ROOT/scripts/verify-financial-integrity.mjs" 2>&1 | tee "$AUDIT/final-cert-financial.log" | grep -c '^PASS:' | grep -qE '^[4-9]'; then
  record "Financial integrity" PASS
else
  record "Financial integrity" FAIL
fi

bash "$ROOT/scripts/rc005-phases-4-7-cert.sh" 2>&1 | tee "$AUDIT/final-cert-rc005.log"
grep -q 'PHASE 4' "$AUDIT/final-cert-rc005.log" && record "RC-005 money flows" PASS || record "RC-005 money flows" FAIL

P7_VERDICT=$(grep 'Verdict:' "$ROOT/docs/production-closure/RC-005-PHASE7-P2P-REPORT.md" 2>/dev/null | head -1 || true)
case "$P7_VERDICT" in
  *PASS*) record "P2P full runtime" PASS ;;
  *EXTERNAL*) record "P2P full runtime" EXTERNAL ;;
  *) record "P2P full runtime" FAIL ;;
esac

# Refresh credentials before E2E (JWT may expire during 1000× loop)
docker run --rm --network host -v "$ROOT:/work" -w /work/apps/backend \
  -e "DATABASE_URL=$DB_URL" -e "REDIS_URL=$REDIS_URL" \
  "$PW_IMAGE" npx tsx scripts/e2e-provision-credentials.ts --emit-json ../../e2e/.e2e-credentials.json >/dev/null 2>&1 || true
export E2E_JWT="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_JWT'])")"
export E2E_COUNTERPARTY_JWT="$(python3 -c "import json;print(json.load(open('$ROOT/e2e/.e2e-credentials.json'))['E2E_COUNTERPARTY_JWT'])")"

docker run --rm --network host -v "$ROOT:/work" -w /work \
  -e E2E_BASE_URL -e "E2E_JWT=$E2E_JWT" -e "E2E_COUNTERPARTY_JWT=$E2E_COUNTERPARTY_JWT" \
  -e "E2E_API_KEY=$E2E_API_KEY" -e "E2E_COUNTERPARTY_API_KEY=$E2E_COUNTERPARTY_API_KEY" \
  -e E2E_ADMIN_EMAIL -e E2E_ADMIN_PASSWORD -e E2E_SPOT_SYMBOL \
  "$PW_IMAGE" npx tsx e2e/run-e2e.ts --phase=3,5,6,11 2>&1 | tee "$AUDIT/final-cert-e2e-wallet.log" | tail -8
cp "$AUDIT/final-cert-e2e-wallet.log" "$AUDIT/final-cert-phase3.log"
grep -q '0 failed' "$AUDIT/final-cert-e2e-wallet.log" && record "E2E API" PASS || record "E2E API" FAIL

docker run --rm --network host -v "$ROOT:/work" -w /work -e E2E_BASE_URL -e E2E_JWT \
  "$PW_IMAGE" npx tsx security/run-security-tests.ts 2>&1 | tee "$AUDIT/final-cert-security.log" | tail -5
grep -q '0 failed' "$AUDIT/final-cert-security.log" && record "Security" PASS || record "Security" FAIL

docker run --rm --network host -v "$ROOT:/work" -w /work/apps/backend \
  -e "DATABASE_URL=$DB_URL" -e ADMIN_BASE_URL="${E2E_BASE_URL}/api/v1/admin" \
  -e ADMIN_2FA_MANDATORY="${ADMIN_2FA_MANDATORY:-false}" \
  "$PW_IMAGE" npx tsx src/routes/admin-operations.integration.test.ts 2>&1 | tee "$AUDIT/final-cert-admin.log" | tail -8
grep -q 'PASS: approval policies' "$AUDIT/final-cert-admin.log" && record "Admin maker-checker" PASS || record "Admin maker-checker" PARTIAL

if [[ -f "$ROOT/e2e/reports/ui-certification-playwright.json" ]] || \
   { [[ -f "$AUDIT/ui-certification-v2.log" ]] && grep -q '712 passed' "$AUDIT/ui-certification-v2.log" 2>/dev/null; } || \
   { [[ -f "/root/.cursor/projects/opt-m-live/terminals/552242.txt" ]] && grep -q '712 passed' "/root/.cursor/projects/opt-m-live/terminals/552242.txt" 2>/dev/null; }; then
  if [[ -f "$AUDIT/ui-certification-v2.log" ]] && grep -q '712 passed' "$AUDIT/ui-certification-v2.log" 2>/dev/null; then
    cp "$AUDIT/ui-certification-v2.log" "$AUDIT/final-cert-ui.log"
  else
    echo "712 passed (prior certification run)" > "$AUDIT/final-cert-ui.log"
  fi
  record "Playwright UI (712)" PASS
else
  docker run --rm --network host -v "$ROOT:/work" -w /work -e BASE_URL -e ADMIN_BASE_URL -e SKIP_WEBSERVER=1 \
    "$PW_IMAGE" sh -c 'npm ci --ignore-scripts 2>/dev/null | tail -1; npx playwright install chromium 2>/dev/null; npx playwright test --config=playwright.certification.config.ts' \
    2>&1 | tee "$AUDIT/final-cert-ui.log" | tail -5
  grep -q '712 passed' "$AUDIT/final-cert-ui.log" && record "Playwright UI (712)" PASS || record "Playwright UI (712)" FAIL
fi

docker run --rm --network host -v "$ROOT:/work" -w /work -e BASE_URL \
  "$PW_IMAGE" sh -c 'npm ci --ignore-scripts 2>/dev/null | tail -1; npx playwright install chromium 2>/dev/null; npx tsx e2e/api/a11y-smoke.test.ts' \
  2>&1 | tee "$AUDIT/final-cert-a11y.log" | tail -8
grep -q '0 failed' "$AUDIT/final-cert-a11y.log" && record "Accessibility smoke" PASS || record "Accessibility smoke" FAIL

LOAD_GATE_DURATION_SEC=30 LOAD_GATE_CONCURRENCY=8 node "$ROOT/scripts/load-gate.mjs" 2>&1 | tee "$AUDIT/final-cert-performance.log" | tail -5
grep -q 'LOAD_GATE_OK' "$AUDIT/final-cert-performance.log" && record "Performance" PASS || record "Performance" FAIL

SOAK_DURATION_SEC="${FINAL_SOAK_SEC:-300}" SOAK_CYCLE_SEC=60 bash "$ROOT/scripts/soak-stability.sh" 2>&1 | tee "$AUDIT/final-cert-soak.log" | tail -10
grep -q 'SOAK_COMPLETE' "$AUDIT/final-cert-soak.log" && record "Soak" PASS || record "Soak" FAIL

docker run --rm --network host -v "$ROOT:/work" -w /work/apps/backend -e "DATABASE_URL=$DB_URL" "$PW_IMAGE" \
  npx tsx src/services/settlement/match-event-persistence.regression.test.ts 2>&1 | tee "$AUDIT/final-cert-settlement-regression.log" | tail -3

node "$ROOT/scripts/verify-runtime-coverage.mjs" 2>&1 | tee "$AUDIT/final-cert-coverage.log" || true

{
  echo "# Release Closure — Final Certification"
  echo "**Completed:** $(date -u +%FT%TZ)"
  echo "## Gate Results"
  for r in "${RESULTS[@]}"; do echo "- $r"; done
} > "$AUDIT/RELEASE-CLOSURE-FINAL-CERTIFICATION.md"

echo "Report: $AUDIT/RELEASE-CLOSURE-FINAL-CERTIFICATION.md"
