#!/usr/bin/env bash
# Phase 1 auth flow screenshots (requires iOS Simulator + dev client).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="$ROOT/phase1-screenshots"
METRO_PORT=8081

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
  local log="/tmp/metheorium-phase1-metro.log"
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
  xcrun simctl ui "$UDID" tap 280 520 2>/dev/null || true
  sleep 1
}

shot() {
  local file="$1"
  local wait="${2:-18}"
  sleep "$wait"
  dismiss_open_dialog
  sleep 1
  xcrun simctl io "$UDID" screenshot "$OUT/$file" >/dev/null
  echo "  ✓ $file"
}

run_capture() {
  local label="$1"
  local file="$2"
  local wait="${3:-20}"
  shift 3
  echo "--- $label ---"
  local log
  log="$(start_metro "$@")"
  reload_app
  dismiss_open_dialog
  wait_bundle "$log" || true
  shot "$file" "$wait"
}

echo "=== Phase 1 auth screenshots ==="

run_capture "Splash (boot)" "00-splash.png" 3 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_BOOT_MIN_MS=8000

run_capture "Welcome" "01-welcome.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1

run_capture "Login password" "02-login-password.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=LoginPassword

run_capture "Login password (reset success)" "02-login-reset-success.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=LoginPassword \
  'EXPO_PUBLIC_AUTH_PREVIEW_PARAMS={"resetSuccess":true}'

run_capture "Login OTP identifier" "03-login-otp-identifier.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=LoginIdentifier

run_capture "Login OTP verify" "04-login-otp-verify.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=LoginOtp \
  'EXPO_PUBLIC_AUTH_PREVIEW_PARAMS={"identifier":"trader@metheorium.com"}'

run_capture "Signup identifier" "05-signup-identifier.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=SignupIdentifier

run_capture "Signup OTP" "06-signup-otp.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=SignupOtp \
  'EXPO_PUBLIC_AUTH_PREVIEW_PARAMS={"identifier":"trader@metheorium.com"}'

run_capture "Forgot password request" "07-forgot-password-request.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=ForgotPasswordRequest

run_capture "Forgot password OTP" "08-forgot-password-otp.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=ForgotPasswordOtp \
  'EXPO_PUBLIC_AUTH_PREVIEW_PARAMS={"identifier":"trader@metheorium.com"}'

run_capture "Forgot password new" "09-forgot-password-new.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=ForgotPasswordNew \
  'EXPO_PUBLIC_AUTH_PREVIEW_PARAMS={"identifier":"trader@metheorium.com","otp":"123456"}'

run_capture "Onboarding biometrics" "10-onboarding-biometrics.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_PHASE=onboarding \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=EnableBiometrics

run_capture "Onboarding PIN fallback" "11-onboarding-pin.png" 16 \
  EXPO_PUBLIC_AUTH_PREVIEW=1 \
  EXPO_PUBLIC_AUTH_PREVIEW_PHASE=onboarding \
  EXPO_PUBLIC_AUTH_PREVIEW_SCREEN=PinFallback

run_capture "Offline gate" "12-offline-gate.png" 16 \
  EXPO_PUBLIC_FORCE_SHELL_GATE=offline

echo "Phase 1 screenshots saved to $OUT"
ls -la "$OUT"
