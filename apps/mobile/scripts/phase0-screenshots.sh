#!/usr/bin/env bash
# Phase 0 guest mode screenshots.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase0-screenshots"
METRO_PORT=8081

mkdir -p "$OUT"
kill_metro() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 2; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; exit 1; }
wait_bundle() { local log="$1"; for _ in $(seq 1 40); do rg -q "Bundled" "$log" 2>/dev/null && return 0; sleep 2; done; return 1; }

run_capture() {
  local label="$1" file="$2" wait="${3:-20}"
  shift 3
  echo "--- $label ---"
  kill_metro
  cd "$ROOT"
  local log="/tmp/metheorium-phase0-metro.log"
  env "$@" npx expo start --dev-client --clear --port "$METRO_PORT" >"$log" 2>&1 &
  wait_metro
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
  wait_bundle "$log" || true
  sleep "$wait"
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null
  echo "  ✓ $file"
}

echo "=== Phase 0 guest mode ==="
run_capture "Welcome" "01-welcome-guest-cta.png" 18 EXPO_PUBLIC_AUTH_PREVIEW=1
run_capture "Guest markets" "02-guest-markets.png" 22 EXPO_PUBLIC_AUTH_PREVIEW=0 EXPO_PUBLIC_GUEST_BOOT=1
run_capture "Guest trade" "03-guest-trade.png" 22 EXPO_PUBLIC_GUEST_BOOT=1 EXPO_PUBLIC_CERT_INITIAL_TAB=Trade
run_capture "Guest wallet" "04-guest-wallet.png" 22 EXPO_PUBLIC_GUEST_BOOT=1 EXPO_PUBLIC_CERT_INITIAL_TAB=Wallet
run_capture "Guest orders" "05-guest-orders.png" 22 EXPO_PUBLIC_GUEST_BOOT=1 EXPO_PUBLIC_CERT_INITIAL_TAB=Orders
run_capture "Guest account" "06-guest-account.png" 22 EXPO_PUBLIC_GUEST_BOOT=1 EXPO_PUBLIC_CERT_OPEN_ACCOUNT=1
echo "Saved to $OUT"
