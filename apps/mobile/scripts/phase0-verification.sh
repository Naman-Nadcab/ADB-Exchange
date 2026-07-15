#!/usr/bin/env bash
# Phase 0 — full guest mode production verification.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase0-screenshots"
METRO_PORT=8081
FAILED=0
PASSED=0

pass() { echo "  ✓ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ $1"; FAILED=$((FAILED + 1)); }

echo "=== Phase 0 quality gates ==="
cd "$ROOT"
if npm run typecheck; then pass "typecheck"; else fail "typecheck"; fi
if npm run lint; then pass "lint"; else fail "lint"; fi
if npm test -- --passWithNoTests 2>/dev/null | tail -5 | rg -q "Tests:.*passed"; then pass "unit tests"; else
  if npm test -- --passWithNoTests; then pass "unit tests"; else fail "unit tests"; fi
fi

kill_metro() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 2; }
wait_metro() { for _ in $(seq 1 60); do curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0; sleep 2; done; return 1; }
wait_bundle() { local log="$1"; for _ in $(seq 1 50); do rg -q "Bundled" "$log" 2>/dev/null && return 0; sleep 2; done; return 1; }

mkdir -p "$OUT"
kill_metro
LOG="/tmp/metheorium-phase0-metro.log"
cd "$ROOT"
env EXPO_PUBLIC_GUEST_BOOT=1 npx expo start --dev-client --clear --port "$METRO_PORT" >"$LOG" 2>&1 &
if wait_metro; then pass "metro started"; else fail "metro started"; fi

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
  if xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null 2>&1; then
    pass "screenshot $label ($file)"
  else
    fail "screenshot $label ($file)"
  fi
}

deeplink() {
  local url="$1"
  xcrun simctl openurl "$UDID" "$url" >/dev/null 2>&1 || true
}

echo "=== Phase 0 guest walkthrough (simulator) ==="
launch_app
wait_bundle "$LOG" || true
sleep 20
shot "Markets tab" "02-guest-markets.png" 2

deeplink "metheorium://markets/search"
shot "Market search" "07-guest-market-search.png" 4

deeplink "metheorium://markets/BTC-USDT"
shot "Pair detail" "08-guest-pair-detail.png" 5

deeplink "metheorium://trade/BTC-USDT"
shot "Trade terminal" "03-guest-trade.png" 5

deeplink "metheorium://wallet"
shot "Wallet guest" "04-guest-wallet.png" 4

deeplink "metheorium://wallet/deposit"
shot "Wallet deposit guard" "09-guest-wallet-deposit-guard.png" 4

deeplink "metheorium://orders"
shot "Orders guest" "05-guest-orders.png" 4

deeplink "metheorium://p2p"
shot "P2P marketplace" "10-guest-p2p.png" 5

deeplink "metheorium://account"
shot "Account home" "06-guest-account.png" 4

deeplink "metheorium://account/preferences"
shot "Preferences" "11-guest-preferences.png" 4

deeplink "metheorium://account/help"
shot "Help" "12-guest-help.png" 4

deeplink "metheorium://account/about"
shot "About" "13-guest-about.png" 4

deeplink "metheorium://account/legal/terms"
shot "Terms" "14-guest-terms.png" 4

deeplink "metheorium://account/legal/privacy"
shot "Privacy" "15-guest-privacy.png" 4

deeplink "metheorium://trade/BTC-USDT"
sleep 3
deeplink "metheorium://login"
shot "Login modal (protected action)" "16-guest-login-modal.png" 5

kill_metro

echo "=== Welcome screen (auth preview) ==="
LOG2="/tmp/metheorium-phase0-welcome.log"
env EXPO_PUBLIC_AUTH_PREVIEW=1 npx expo start --dev-client --clear --port "$METRO_PORT" >"$LOG2" 2>&1 &
wait_metro
launch_app
wait_bundle "$LOG2" || true
shot "Welcome + Continue as Guest" "01-welcome-guest-cta.png" 18
kill_metro

echo ""
echo "=== Phase 0 Verification Summary ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Screenshots: $OUT"
echo "NOTE: Metro was stopped. Run ./scripts/dev-launch.sh before opening the dev client again."
if [[ "$FAILED" -gt 0 ]]; then exit 1; fi
