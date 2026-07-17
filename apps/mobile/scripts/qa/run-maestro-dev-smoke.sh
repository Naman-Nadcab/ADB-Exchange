#!/usr/bin/env bash
# Run all dev-client Maestro smoke flows (requires Metro on :8081).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEVICE="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
METRO_PORT="${METRO_PORT:-8081}"
FLOW_PAUSE_SEC="${FLOW_PAUSE_SEC:-5}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"

if ! curl -sf "http://127.0.0.1:${METRO_PORT}/status" >/dev/null; then
  echo "Metro not running on :${METRO_PORT}. Start with:" >&2
  echo "  npx expo start --dev-client --port ${METRO_PORT}" >&2
  echo "Or: ./scripts/dev-launch.sh" >&2
  exit 1
fi

FLOWS=(
  e2e/auth/smoke.yaml
  e2e/markets/smoke.yaml
  e2e/trade/smoke.yaml
  e2e/wallet/smoke.yaml
  e2e/wallet/deposit-smoke.yaml
  e2e/wallet/withdraw-smoke.yaml
  e2e/p2p/marketplace-smoke.yaml
  e2e/account/account-smoke.yaml
)

pass=0
fail=0

for flow in "${FLOWS[@]}"; do
  echo "========== $flow =========="
  if maestro test --device "$DEVICE" "$flow"; then
    echo "PASS: $flow"
    pass=$((pass + 1))
  else
    echo "FAIL: $flow"
    fail=$((fail + 1))
  fi
  sleep "$FLOW_PAUSE_SEC"
done

echo ""
echo "Dev smoke summary: PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]
