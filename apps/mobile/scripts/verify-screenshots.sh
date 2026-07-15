#!/usr/bin/env bash
# Verify redesigned UI is mounted (requires iOS Simulator + dev client).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/verify-screenshots"
METRO_PORT=8081
BUNDLE_URL="http://localhost:${METRO_PORT}/apps/mobile/index.bundle?platform=ios&dev=true&minify=false"

mkdir -p "$OUT"

kill_metro() {
  lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true
  sleep 2
}

wait_metro() {
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:$METRO_PORT/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Metro failed to start" >&2
  exit 1
}

wait_bundle() {
  local log="$1"
  for _ in $(seq 1 40); do
    if rg -q "Bundled" "$log" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "Bundle did not complete — check $log" >&2
  return 1
}

start_metro() {
  kill_metro
  cd "$ROOT"
  local log="/tmp/metheorium-verify-metro.log"
  env "$@" npx expo start --dev-client --clear --port "$METRO_PORT" >"$log" 2>&1 &
  wait_metro
  echo "$log"
}

reload_app() {
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true
}

dismiss_open_dialog() {
  # iOS "Open in METHErium?" deep-link prompt — tap Open (right side of dialog).
  xcrun simctl ui "$UDID" tap 280 520 2>/dev/null || true
  sleep 1
}

shot() {
  local file="$1"
  local wait="${2:-20}"
  sleep "$wait"
  dismiss_open_dialog
  sleep 2
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null
  echo "  ✓ $file"
}

echo "=== Verify redesigned main tabs ==="
for spec in \
  "Markets|01-markets-verify.png" \
  "Trade|02-trade-verify.png" \
  "Orders|03-orders-verify.png" \
  "Wallet|04-wallet-verify.png" \
  "P2P|05-p2p-verify.png"; do
  tab="${spec%%|*}"
  file="${spec#*|}"
  echo "--- $tab ---"
  log="$(start_metro EXPO_PUBLIC_CERT_PREVIEW=1 "EXPO_PUBLIC_CERT_INITIAL_TAB=$tab")"
  reload_app
  dismiss_open_dialog
  wait_bundle "$log" || true
  shot "$file" 22
done

echo "--- Account ---"
log="$(start_metro EXPO_PUBLIC_CERT_PREVIEW=1 EXPO_PUBLIC_CERT_OPEN_ACCOUNT=1)"
reload_app
dismiss_open_dialog
wait_bundle "$log" || true
shot "06-account-verify.png" 24

echo "Verify screenshots saved to $OUT"
ls -la "$OUT"
