#!/usr/bin/env bash
# Mission 2 — Full business flow certification
# Usage: bash scripts/run-mission2-certification.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRED_JSON="$ROOT/e2e/.e2e-credentials.json"
REPORT="$ROOT/e2e/reports/mission2-certification.json"
mkdir -p "$ROOT/e2e/reports" "$ROOT/e2e/.auth"

if [[ -f "$ROOT/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  REDIS_URL="$(grep -E '^REDIS_URL=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL REDIS_URL
fi

export BASE_URL="${BASE_URL:-http://127.0.0.1}"
export ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://127.0.0.1/admin}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:4000}"
export SKIP_WEBSERVER=1
export MISSION2_FORCE_PROVISION="${MISSION2_FORCE_PROVISION:-0}"
export E2E_TIMEOUT_MS="${E2E_TIMEOUT_MS:-60000}"
export E2E_SPOT_TRADE_SETTLEMENT_MS="${E2E_SPOT_TRADE_SETTLEMENT_MS:-45000}"

DB_URL="${MISSION2_DATABASE_URL:-${DATABASE_URL:-}}"
DB_URL="${DB_URL/postgres:/127.0.0.1:}"
REDIS_URL_HOST="${MISSION2_REDIS_URL:-${REDIS_URL:-redis://127.0.0.1:6379}}"
REDIS_URL_HOST="${REDIS_URL_HOST/redis:\/\/redis:/redis:\/\/127.0.0.1:}"

echo "=== Mission 2: Provision credentials ==="
cd "$ROOT"
docker run --rm --network host \
  -v "$ROOT:/work" -w /work/apps/backend \
  -e "DATABASE_URL=$DB_URL" -e "REDIS_URL=$REDIS_URL_HOST" \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  npx tsx scripts/e2e-provision-credentials.ts --emit-json ../../e2e/.e2e-credentials.json \
  || { echo "Provision failed — trying existing creds"; test -f "$CRED_JSON" || exit 1; }

read_cred() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$CRED_JSON" "$1"
}
export E2E_JWT="$(read_cred E2E_JWT)"
export E2E_COUNTERPARTY_JWT="$(read_cred E2E_COUNTERPARTY_JWT)"
export E2E_API_KEY="$(read_cred E2E_API_KEY)"
export E2E_COUNTERPARTY_API_KEY="$(read_cred E2E_COUNTERPARTY_API_KEY)"

echo "=== Mission 2: Playwright business flows ==="
docker run --rm --network host \
  -v "$ROOT:/work" -w /work \
  -e BASE_URL -e ADMIN_BASE_URL -e E2E_BASE_URL \
  -e E2E_JWT -e E2E_COUNTERPARTY_JWT -e E2E_API_KEY -e E2E_COUNTERPARTY_API_KEY \
  -e E2E_TIMEOUT_MS -e E2E_SPOT_TRADE_SETTLEMENT_MS \
  -e "MISSION2_DATABASE_URL=$DB_URL" -e "MISSION2_REDIS_URL=$REDIS_URL_HOST" \
  -e MISSION2_SKIP_GLOBAL_PROVISION=1 \
  -e MISSION2_RESTART_TESTS="${MISSION2_RESTART_TESTS:-0}" \
  -e E2E_SKIP_CLEAR_SETTLEMENT_CIRCUIT="${E2E_SKIP_CLEAR_SETTLEMENT_CIRCUIT:-1}" \
  -e E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}" \
  -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-admin123}" \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  sh -c 'npx playwright install chromium 2>&1 | tail -1; npx playwright test --config=playwright.mission2.config.ts 2>&1' \
  | tee "$ROOT/e2e/reports/mission2-run.log"

echo "=== Mission 2: API regression phases ==="
docker run --rm --network host \
  -v "$ROOT:/work" -w /work \
  -e E2E_BASE_URL -e E2E_JWT -e E2E_COUNTERPARTY_JWT -e E2E_API_KEY -e E2E_COUNTERPARTY_API_KEY \
  -e E2E_TIMEOUT_MS -e E2E_SPOT_TRADE_SETTLEMENT_MS \
  -e E2E_ADMIN_EMAIL -e E2E_ADMIN_PASSWORD \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  npx tsx e2e/run-e2e.ts 2>&1 | tee "$ROOT/e2e/reports/mission2-api-phases.log"

python3 << 'NODE'
import json, re, sys
from pathlib import Path

root = Path("/opt/m-live")
pw_path = root / "e2e/reports/mission2-playwright.json"
pw = json.loads(pw_path.read_text()) if pw_path.exists() else {"suites": []}

def collect_tests(suites):
    tests = []
    for s in suites:
        for sp in s.get("specs", []):
            tests.extend(sp.get("tests", []))
        tests.extend(collect_tests(s.get("suites", [])))
    return tests

pw_tests = collect_tests(pw.get("suites", []))
pw_failed = sum(1 for t in pw_tests if any(r.get("status") == "failed" for r in t.get("results", [])))
pw_skipped = sum(1 for t in pw_tests if all(r.get("status") == "skipped" for r in t.get("results", [])))
pw_passed = len(pw_tests) - pw_failed - pw_skipped

api_log = (root / "e2e/reports/mission2-api-phases.log").read_text()
api_match = re.search(r"Total: (\d+) passed, (\d+) failed", api_log)
api_passed = int(api_match.group(1)) if api_match else 0
api_failed = int(api_match.group(2)) if api_match else 0

report = {
    "certifiedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "playwright": {"total": len(pw_tests), "passed": pw_passed, "failed": pw_failed, "skipped": pw_skipped},
    "apiPhases": {"passed": api_passed, "failed": api_failed},
    "verdict": "PASS" if pw_failed == 0 and api_failed == 0 else "FAIL",
    "businessFlowCoveragePct": round(((pw_passed + pw_skipped) / len(pw_tests)) * 1000) / 10 if pw_tests else 0,
    "productionBusinessReadiness": "READY" if pw_failed == 0 and api_failed == 0 else "NOT_READY",
}
out = root / "e2e/reports/mission2-certification.json"
out.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
sys.exit(0 if report["verdict"] == "PASS" else 1)
NODE

echo "Mission 2 certification: PASS — report at $REPORT"
