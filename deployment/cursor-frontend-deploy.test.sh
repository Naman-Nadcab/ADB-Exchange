#!/bin/sh
# The Cursor entry point must stop before SSH when no authorized key is available.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
script="$root/deployment/cursor-frontend-deploy.sh"

run() {
  mode=$1
  shift
  set +e
  out=$(env "$@" sh "$script" "$mode" 2>&1)
  code=$?
  set -e
  printf '%s\n' "$out"
  return "$code"
}

expect_fail() {
  label=$1
  want=$2
  mode=$3
  shift 3
  if out=$(run "$mode" "$@"); then
    echo "FAIL $label unexpectedly passed" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if ! printf '%s\n' "$out" | grep -q "$want"; then
    echo "FAIL $label missing $want" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if printf '%s\n' "$out" | grep -q 'HOST_KEY_FINGERPRINT\|PRODUCTION_HEAD=\|DEPLOY_OK\|CURSOR_DEPLOY_OK'; then
    echo "FAIL $label reached a live step" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  echo "PASS $label"
}

expect_fail unknown_mode UNKNOWN_MODE nosuch
expect_fail missing_key SSH_KEY_MISSING deploy \
  VPS_HOST=169.58.39.2 \
  VPS_USER=root \
  EXPECTED_SHA=4bb8e42a1772e45fcd16bfe8e072accd863cc7d4 \
  RELEASE_SHA=1591905dc047f397a2e764ee81dbeb1a42c6b8d5

key=$(mktemp)
trap 'rm -f "$key"' EXIT
printf '%s\n' 'not-a-private-key' >"$key"
chmod 644 "$key"
expect_fail open_key SSH_KEY_PERMISSIONS inspect \
  VPS_HOST=169.58.39.2 \
  VPS_USER=root \
  VPS_SSH_KEY_PATH="$key"

chmod 600 "$key"
expect_fail unreadable_key DEPLOY_KEY_UNREADABLE inspect \
  VPS_HOST=169.58.39.2 \
  VPS_USER=root \
  VPS_SSH_KEY_PATH="$key"

if grep -q 'StrictHostKeyChecking=no' "$script"; then
  echo "FAIL host checking disabled" >&2
  exit 1
fi
echo "PASS host_checking_stays_on"
echo "CURSOR_DEPLOY_TESTS_OK"
