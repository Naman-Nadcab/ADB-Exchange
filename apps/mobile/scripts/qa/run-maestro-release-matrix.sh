#!/usr/bin/env bash
# Run Release build deep-link matrix on iOS simulator.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEVICE="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
APP_NAME="${IOS_APP_NAME:-METHErium.app}"
DERIVED="${IOS_DERIVED_DATA:-$HOME/Library/Developer/Xcode/DerivedData}"

export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"

find_release_app() {
  find "$DERIVED" -name "$APP_NAME" -path "*Release-iphonesimulator*" 2>/dev/null | head -1
}

APP="${RELEASE_APP_PATH:-$(find_release_app)}"

if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Release simulator app not found. Build with:" >&2
  echo "  npx expo run:ios --configuration Release --device \"iPhone 17\"" >&2
  echo "Or set RELEASE_APP_PATH=/path/to/METHErium.app" >&2
  exit 1
fi

echo "Using Release app: $APP"
echo "Target simulator: $DEVICE"

xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl uninstall "$DEVICE" com.metheorium.mobile 2>/dev/null || true
xcrun simctl install "$DEVICE" "$APP"

maestro test --device "$DEVICE" e2e/release/deep-link-matrix.yaml
