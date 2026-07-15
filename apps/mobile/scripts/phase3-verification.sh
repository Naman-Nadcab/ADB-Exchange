#!/usr/bin/env bash
# Phase 3 — Spot trading parity verification.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase3-screenshots"
METRO_PORT=8081
FAILED=0
PASSED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo "=== Phase 3 quality gates ==="
cd "$ROOT"
npm run typecheck && pass "typecheck" || fail "typecheck"
npm run lint && pass "lint" || fail "lint"
npm test -- --passWithNoTests && pass "tests" || fail "tests"

kill_metro() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 2; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; return 1; }
wait_bundle() { local log="$1"; for _ in $(seq 1 50); do rg -q "Bundled" "$log" 2>/dev/null && return 0; sleep 2; done; return 1; }

mkdir -p "$OUT"
kill_metro
LOG="/tmp/metheorium-phase3-metro.log"
env EXPO_PUBLIC_GUEST_BOOT=1 npx expo start --dev-client --port "$METRO_PORT" >"$LOG" 2>&1 &
wait_metro && pass "metro" || fail "metro"

launch_app() {
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
  for _ in $(seq 1 60); do rg -q "iOS Bundled|Android Bundled" "$LOG" 2>/dev/null && break; sleep 2; done
  if rg -q "iOS Bundled|Android Bundled" "$LOG" 2>/dev/null; then pass "bundle ready"; else fail "bundle not ready"; fi
  sleep 8
}

shot() {
  local label="$1" file="$2" wait="${3:-4}"
  sleep "$wait"
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null && pass "screenshot $label" || fail "screenshot $label"
}

deeplink() { xcrun simctl openurl "$UDID" "$1" >/dev/null 2>&1 || true; }

echo "=== Phase 3 spot trading walkthrough (guest) ==="
launch_app
wait_bundle "$LOG" || true
sleep 22

deeplink "metheorium://trade/BTC-USDT"
shot "Trade chart + studies toolbar" "01-trade-chart.png" 5

deeplink "metheorium://trade/BTC-USDT"
shot "Trade terminal header" "02-trade-header.png" 3

deeplink "metheorium://orders"
shot "Orders guest prompt" "03-orders-guest.png" 4

deeplink "metheorium://trade/BTC-USDT"
shot "Trade screen refresh" "04-trade-terminal.png" 3

kill_metro
echo ""
echo "Passed: $PASSED | Failed: $FAILED | Screenshots: $OUT"
echo "NOTE: Metro was stopped. Run ./scripts/dev-launch.sh before opening the dev client again."
echo "Backend-only gaps: features/trade/PHASE3_BACKEND_ONLY.md"
[[ "$FAILED" -eq 0 ]]
