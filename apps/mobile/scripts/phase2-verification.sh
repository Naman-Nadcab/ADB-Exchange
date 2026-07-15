#!/usr/bin/env bash
# Phase 2 — Markets ecosystem verification.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase2-screenshots"
METRO_PORT=8081
FAILED=0
PASSED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo "=== Phase 2 quality gates ==="
cd "$ROOT"
npm run typecheck && pass "typecheck" || fail "typecheck"
npm run lint && pass "lint" || fail "lint"
npm test -- --passWithNoTests && pass "tests" || fail "tests"

kill_metro() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 2; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; return 1; }
wait_bundle() { local log="$1"; for _ in $(seq 1 50); do rg -q "Bundled" "$log" 2>/dev/null && return 0; sleep 2; done; return 1; }

mkdir -p "$OUT"
kill_metro
LOG="/tmp/metheorium-phase2-metro.log"
env EXPO_PUBLIC_GUEST_BOOT=1 npx expo start --dev-client --clear --port "$METRO_PORT" >"$LOG" 2>&1 &
wait_metro && pass "metro" || fail "metro"

launch_app() {
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
}

shot() {
  local label="$1" file="$2" wait="${3:-4}"
  sleep "$wait"
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null && pass "screenshot $label" || fail "screenshot $label"
}

deeplink() { xcrun simctl openurl "$UDID" "$1" >/dev/null 2>&1 || true; }

echo "=== Phase 2 markets walkthrough ==="
launch_app
wait_bundle "$LOG" || true
sleep 20
shot "Markets home" "01-markets-home.png" 2
deeplink "metheorium://markets/search"
shot "Market search" "02-market-search.png" 4
deeplink "metheorium://markets/BTC-USDT"
shot "Pair detail" "03-pair-detail.png" 5
deeplink "metheorium://markets"
sleep 2
deeplink "metheorium://account/preferences"
shot "Preferences (theme/lang)" "04-preferences.png" 4

kill_metro
echo "Passed: $PASSED | Failed: $FAILED | Screenshots: $OUT"
[[ "$FAILED" -eq 0 ]]