#!/usr/bin/env bash
# Start Metro and launch iOS dev client — keeps Metro running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDID="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
METRO_PORT="${METRO_PORT:-8081}"
LOG="${TMPDIR:-/tmp}/metheorium-dev-metro.log"
CLEAR_FLAG=""
if [[ "${METRO_CLEAR:-0}" == "1" ]]; then
  CLEAR_FLAG="--clear"
fi

kill_metro() { lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true; sleep 1; }
wait_metro() {
  for _ in $(seq 1 60); do
    curl -sf "http://localhost:$METRO_PORT/status" >/dev/null && return 0
    sleep 2
  done
  echo "Metro failed to start — see $LOG" >&2
  return 1
}
wait_bundle() {
  # Bundle starts only after the dev client connects — must run AFTER launch/openurl.
  for _ in $(seq 1 90); do
    if rg -q "iOS Bundled|Android Bundled" "$LOG" 2>/dev/null; then return 0; fi
    sleep 2
  done
  echo "Bundle did not finish in time — check: tail -f $LOG" >&2
  return 1
}

echo "Starting Metro on port $METRO_PORT (log: $LOG)"
kill_metro
cd "$ROOT"
# Pass through env e.g. EXPO_PUBLIC_GUEST_BOOT=1 ./scripts/dev-launch.sh
# Use METRO_CLEAR=1 to force cache clear (slower first boot).
npx expo start --dev-client $CLEAR_FLAG --port "$METRO_PORT" >"$LOG" 2>&1 &
wait_metro

echo "Launching dev client on simulator $UDID"
xcrun simctl terminate "$UDID" com.metheorium.mobile 2>/dev/null || true
sleep 1
xcrun simctl launch "$UDID" com.metheorium.mobile >/dev/null
sleep 2
xcrun simctl openurl "$UDID" "exp+metheorium-mobile://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null || true

echo "Waiting for JS bundle (dev client triggers Metro build)..."
if wait_bundle; then
  echo "Bundle ready."
else
  echo "Warning: bundle wait timed out — UI may still be loading."
fi
sleep 3

echo ""
echo "Metro is running (PID $(lsof -ti:$METRO_PORT)). Do NOT kill it while using the dev client."
echo "Blank white screen = bundle still loading OR Metro stopped. Wait or run this script again."
echo "Tail logs: tail -f $LOG"
