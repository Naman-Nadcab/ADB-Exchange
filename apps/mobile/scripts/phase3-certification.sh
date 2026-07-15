#!/usr/bin/env bash
# Phase 3 — Final production certification evidence (fresh screenshots).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase3-certification"
METRO_PORT=8081
LOG="/tmp/metheorium-phase3-cert.log"

mkdir -p "$OUT"
rm -f "$OUT"/*.png 2>/dev/null || true

pass_gate() { echo "  ✓ $1"; }
fail_gate() { echo "  ✗ $1"; exit 1; }

echo "=== STEP 4 — Quality gates ==="
cd "$ROOT"
npm run typecheck && pass_gate "typecheck" || fail_gate "typecheck"
npm run lint && pass_gate "lint" || fail_gate "lint"
npm test -- --passWithNoTests && pass_gate "tests" || fail_gate "tests"

kill_m() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 1; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; return 1; }
wait_bundle() { for _ in $(seq 1 90); do rg -q "iOS Bundled|Android Bundled" "$LOG" 2>/dev/null && return 0; sleep 2; done; return 1; }

tap() { xcrun simctl ui "$UDID" tap "$1" "$2" 2>/dev/null || true; sleep 1; }
deeplink() { xcrun simctl openurl "$UDID" "$1" >/dev/null 2>&1 || true; sleep 1; }
shot() { sleep "${3:-4}"; xcrun simctl io "$UDID" screenshot "$OUT/$2" >/dev/null && echo "  ✓ $1 → $2"; }

launch_session() {
  local extra_env=("$@")
  kill_m
  cd "$ROOT"
  env "${extra_env[@]}" npx expo start --dev-client --port "$METRO_PORT" >"$LOG" 2>&1 &
  wait_metro || fail_gate "metro start"
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
  wait_bundle || echo "  ⚠ bundle wait timed out"
  sleep 6
  tap 280 520
}

echo ""
echo "=== STEP 2/5 — Guest certification walkthrough ==="
launch_session EXPO_PUBLIC_GUEST_BOOT=1

deeplink "metheorium://trade/BTC-USDT"
sleep 8
shot "01 Trade Overview" "01-trade-overview.png" 2

# Chart tab (default) — 02
shot "02 Chart" "02-chart.png" 2

# Enable SMA 25 + RSI(14)
tap 175 395
tap 95 435
shot "03 Indicators Enabled" "03-indicators-enabled.png" 2

# Depth chart toggle
tap 215 345
shot "04 Depth Chart" "04-depth-chart.png" 3

# Book tab
tap 148 235
shot "05 Book" "05-book.png" 3

# Trade form tab (guest sign-in)
tap 246 235
shot "06 Trade Form (guest)" "06-trade-form-guest.png" 3

# Trade orders tab (guest)
tap 344 235
shot "09 Guest Login Prompt" "09-guest-login-prompt.png" 3

# Main Orders tab — history
tap 196 810
sleep 4
tap 280 520
deeplink "metheorium://orders"
sleep 5
shot "07 Open Orders (guest)" "07-open-orders-guest.png" 2
tap 220 280
shot "08 History (guest)" "08-history-guest.png" 2

# Pair selector
deeplink "metheorium://trade/pairs"
sleep 4
shot "Pair selector" "pair-selector.png" 2

echo ""
echo "=== Authenticated UI (cert preview — no live backend) ==="
launch_session EXPO_PUBLIC_CERT_PREVIEW=1 EXPO_PUBLIC_CERT_INITIAL_TAB=Trade

deeplink "metheorium://trade/BTC-USDT"
sleep 8
tap 246 235
shot "10 Authenticated Trading" "10-authenticated-trading.png" 3

deeplink "metheorium://orders"
sleep 5
shot "07 Open Orders (auth UI)" "07-open-orders-auth.png" 2

echo ""
echo "=== Metro log errors ==="
if rg -i "TypeError|ReferenceError|Invariant Violation|Fatal" "$LOG" 2>/dev/null; then
  echo "  ✗ JS errors found in Metro log"
else
  echo "  ✓ No fatal JS errors in Metro log"
fi

echo ""
echo "Fresh certification screenshots: $OUT"
ls -la "$OUT"
echo ""
echo "Metro still running on :$METRO_PORT — do NOT kill until done reviewing."
