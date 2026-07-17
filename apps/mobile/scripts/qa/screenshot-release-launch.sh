#!/usr/bin/env bash
# Install Release build and capture cold-launch screenshot.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEVICE="${SIM_UDID:-9CC9BE08-33DD-41FA-9824-FDE70851144D}"
OUT="${1:-/tmp/metheorium-release-launch.png}"
APP_NAME="${IOS_APP_NAME:-METHErium.app}"
DERIVED="${IOS_DERIVED_DATA:-$HOME/Library/Developer/Xcode/DerivedData}"

APP="${RELEASE_APP_PATH:-$(find "$DERIVED" -name "$APP_NAME" -path "*Release-iphonesimulator*" 2>/dev/null | head -1)}"

if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Release app not found. Build first." >&2
  exit 1
fi

xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl uninstall "$DEVICE" com.metheorium.mobile 2>/dev/null || true
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" com.metheorium.mobile
sleep 6
xcrun simctl io "$DEVICE" screenshot "$OUT"
echo "Screenshot: $OUT"
