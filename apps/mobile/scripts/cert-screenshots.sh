#!/usr/bin/env bash
# Dev-only UI certification screenshots (requires iOS Simulator + dev client).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/cert-screenshots"
METRO_PORT=8081

mkdir -p "$OUT"

kill_metro() {
  lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
}

start_metro() {
  kill_metro
  cd "$ROOT"
  env "$@" npx expo start --dev-client --clear --port "$METRO_PORT" >/tmp/metheorium-cert-metro.log 2>&1 &
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:$METRO_PORT/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Metro failed to start" >&2
  exit 1
}

reload_app() {
  xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
  sleep 2
  xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null
}

shot() {
  local file="$1"
  local wait="${2:-18}"
  sleep "$wait"
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null
  echo "  ✓ $file"
}

echo "=== Auth flow (Welcome) ==="
start_metro
reload_app
shot "08-welcome.png" 22

echo "=== Main app (cert preview) ==="
for spec in \
  "Markets|02-markets-home.png|Markets" \
  "Trade|04-spot-trading.png|Trade" \
  "Orders|05-orders.png|Orders" \
  "Wallet|06-wallet.png|Wallet"; do
  tab="${spec%%|*}"
  rest="${spec#*|}"
  file="${rest%%|*}"
  start_metro EXPO_PUBLIC_CERT_PREVIEW=1 "EXPO_PUBLIC_CERT_INITIAL_TAB=$tab"
  reload_app
  shot "$file" 24
done

start_metro EXPO_PUBLIC_CERT_PREVIEW=1 EXPO_PUBLIC_CERT_OPEN_ACCOUNT=1
reload_app
shot "07-profile-account.png" 24

echo "Screenshots saved to $OUT"
ls -la "$OUT"
