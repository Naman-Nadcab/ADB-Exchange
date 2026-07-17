#!/usr/bin/env bash
# Multi-device Release matrix (iOS). Runs deep-link matrix on each UDID sequentially.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Default QA device set (override with DEVICE_LIST env, space-separated UDIDs)
DEFAULT_DEVICES=(
  "9CC9BE08-33DD-41FA-9824-FDE70851144D"   # iPhone 17
  "0AF2800B-0BDE-41FC-B037-4CF3021CECA4"   # iPhone 17 Pro Max
)

if [[ -n "${DEVICE_LIST:-}" ]]; then
  read -ra DEVICES <<< "$DEVICE_LIST"
else
  DEVICES=("${DEFAULT_DEVICES[@]}")
fi

pass=0
fail=0

for udid in "${DEVICES[@]}"; do
  echo "===== Device $udid ====="
  if SIM_UDID="$udid" "$ROOT/scripts/qa/run-maestro-release-matrix.sh"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
  fi
  sleep 3
done

echo "Multi-device matrix: PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]
