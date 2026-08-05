#!/usr/bin/env bash
# Post-deploy health checks.
# Usage: bash deployment/health-check.sh [base-url]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  require_env_file
  load_env
  BASE="$(public_base_url)"
fi

FAIL=0
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
HEALTH_RETRY_DELAY_SEC="${HEALTH_RETRY_DELAY_SEC:-3}"

check() {
  local name="$1" url="$2" extra="${3:-}"
  local attempt
  for attempt in $(seq 1 "$HEALTH_RETRIES"); do
    if [[ "$extra" == "-k" ]]; then
      if curl -skf --max-time 20 "$url" >/dev/null 2>&1; then
        echo "OK  $name (attempt ${attempt}/${HEALTH_RETRIES})"
        return 0
      fi
    else
      if curl -sf --max-time 20 "$url" >/dev/null 2>&1; then
        echo "OK  $name (attempt ${attempt}/${HEALTH_RETRIES})"
        return 0
      fi
    fi
    [[ "$attempt" -lt "$HEALTH_RETRIES" ]] && sleep "$HEALTH_RETRY_DELAY_SEC"
  done
  echo "FAIL $name ($url) after ${HEALTH_RETRIES} attempts"
  FAIL=1
}

echo "=== Health checks (base: $BASE) ==="
if [[ "$BASE" == https://* ]]; then
  CURL_EXTRA=-k
else
  CURL_EXTRA=
fi

check "nginx healthz" "$BASE/healthz" "$CURL_EXTRA"
check "backend liveness" "$BASE/health/live" "$CURL_EXTRA"
check "backend readiness" "$BASE/health" "$CURL_EXTRA"
check "spot markets" "$BASE/api/v1/spot/markets" "$CURL_EXTRA"

if [[ "$FAIL" -eq 0 ]]; then
  echo "=== PASS ==="
  exit 0
fi
echo "=== FAIL ==="
exit 1
