#!/usr/bin/env bash
# Phase 3 — Final certification evidence capture (31 shots where reachable).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase3-final-certification"
METRO_PORT=8081
LOG="/tmp/metheorium-phase3-final-cert.log"

mkdir -p "$OUT"
rm -f "$OUT"/[0-9][0-9]-*.png 2>/dev/null || true

shot() { sleep "${3:-3}"; xcrun simctl io "$UDID" screenshot "$OUT/$2" >/dev/null && echo "  ✓ $1"; }

kill_m() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 1; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; return 1; }
wait_bundle() { for _ in $(seq 1 90); do rg -q "iOS Bundled|Android Bundled" "$LOG" 2>/dev/null && return 0; sleep 2; done; return 1; }

launch() {
  local env_vars=("$@")
  kill_m
  cd "$ROOT"
  env "${env_vars[@]}" npx expo start --dev-client --port "$METRO_PORT" >"$LOG" 2>&1 &
  wait_metro
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
  wait_bundle || true
  sleep 5
  osascript -e 'tell application "Simulator" to activate' >/dev/null 2>&1 || true
  sleep 1
}

deeplink() { xcrun simctl openurl "$UDID" "$1" >/dev/null 2>&1 || true; sleep 2; }

echo "=== Guest session — trade terminal ==="
launch EXPO_PUBLIC_GUEST_BOOT=1
deeplink "metheorium://trade/BTC-USDT"
sleep 8
shot "01 Header + Status Row" "01-header-status-row.png" 2
shot "02 Pair Header" "02-pair-header.png" 1
shot "03 Live Price + 24H Stats" "03-live-price-24h.png" 1
shot "04 Candlestick Chart" "04-candlestick-chart.png" 1
shot "27 Reconnect Mode" "27-reconnect-mode.png" 1

deeplink "metheorium://orders"
sleep 5
shot "24 Guest Mode" "24-guest-mode.png" 2

echo "=== Authenticated cert-preview session ==="
launch EXPO_PUBLIC_CERT_PREVIEW=1 EXPO_PUBLIC_CERT_INITIAL_TAB=Trade
deeplink "metheorium://trade/BTC-USDT"
sleep 8
shot "25 Authenticated Mode (shell)" "25-authenticated-mode.png" 2

deeplink "metheorium://orders"
sleep 5
shot "21 Open Orders (auth shell)" "21-open-orders-auth.png" 2

echo "=== Metro errors ==="
if rg -i "TypeError|ReferenceError|Invariant Violation|Fatal" "$LOG" 2>/dev/null; then echo "  ✗ JS errors"; else echo "  ✓ No fatal JS errors"; fi

echo ""
echo "Captured: $OUT"
ls -1 "$OUT"/[0-9][0-9]-*.png 2>/dev/null || echo "(partial set)"
echo "Missing shots require: live backend, tab automation, device sizes"
