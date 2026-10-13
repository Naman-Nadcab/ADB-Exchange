#!/bin/sh
# The URL classifier must explain a rejection without printing the raw value.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
script=$root/deployment/frontend-only-url-check.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"

run() {
  set +e
  out=$(
    FRONTEND_ONLY_URL_LIBRARY=1
    # shellcheck disable=SC1090
    . "$script"
    classify_assignment PUBLIC_API_URL https
    true
  )
  code=$?
  set -e
  printf '%s\n' "$out"
  return "$code"
}

expect() {
  label=$1
  want=$2
  if ! out=$(run); then
    :
  fi
  if ! printf '%s\n' "$out" | grep -q "$want"; then
    echo "FAIL $label missing $want" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  if printf '%s\n' "$out" | grep -q 'CHANGE_ME_HOSTNAME\|super-secret\|user:password'; then
    echo "FAIL $label printed a secret-like value" >&2
    printf '%s\n' "$out" >&2
    exit 1
  fi
  echo "PASS $label"
}

printf '%s\n' 'OTHER=1' > .env
expect missing 'PUBLIC_API_URL_legacy_reason=missing'

printf '%s\n' 'PUBLIC_API_URL=https://CHANGE_ME_HOSTNAME_OR_IP' > .env
expect placeholder 'PUBLIC_API_URL_legacy_reason=placeholder'
printf '%s\n' "$out" | grep -q 'PUBLIC_API_URL_placeholder=CHANGE_ME'

printf '%s\n' 'PUBLIC_API_URL=https://api.example.com' > .env
expect example 'PUBLIC_API_URL_placeholder=api.example.com'

printf '%s\n' 'PUBLIC_API_URL=http://169.58.39.2' > .env
expect http 'PUBLIC_API_URL_legacy_reason=bad_scheme'

printf '%s\n' 'PUBLIC_API_URL=https://169.58.39.2' > .env
expect edge 'PUBLIC_API_URL_ok=yes'
printf '%s\n' "$out" | grep -q 'PUBLIC_API_URL_host=169.58.39.2'
printf '%s\n' "$out" | grep -q 'PUBLIC_API_URL_host_is_production_edge=yes'
printf '%s\n' "$out" | grep -q 'PUBLIC_API_URL_legacy_reason=ok'

printf '%s\n' 'export PUBLIC_API_URL=https://169.58.39.2' > .env
expect export_prefix 'PUBLIC_API_URL_legacy_reason=missing_strict_assignment'
printf '%s\n' "$out" | grep -q 'PUBLIC_API_URL_reason=ok'

printf '%s\n' 'PUBLIC_API_URL=https://user:password@169.58.39.2/secret' > .env
expect userinfo 'PUBLIC_API_URL_reason=userinfo'

echo "URL_CHECK_TESTS_OK"
