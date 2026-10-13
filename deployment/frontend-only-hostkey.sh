#!/bin/sh
# Fetch only the ED25519 host key and refuse to write it unless its
# fingerprint matches the key verified from the VPS and from a separate Mac.
set -eu

HOST=${1:-}
OUT=${2:-}
EXPECTED='SHA256:LPQv0Wf2i7YpOkuz+UBDw0U244tU/NumiDo4v7zuHGc'

if [ -z "$HOST" ] || [ -z "$OUT" ]; then
  echo "usage: frontend-only-hostkey.sh <host> <known_hosts_path>" >&2
  exit 2
fi

case "$HOST" in
  ''|*[!A-Za-z0-9._-]*)
    echo "VPS_HOST_UNSAFE" >&2
    exit 1
    ;;
esac

scan=$(mktemp)
trap 'rm -f "$scan"' EXIT

ssh-keyscan -T 15 -t ed25519 -- "$HOST" 2>/dev/null | grep 'ssh-ed25519 ' >"$scan" || true
count=$(grep -c 'ssh-ed25519 ' "$scan" || true)
if [ "$count" -ne 1 ]; then
  echo "HOST_KEY_SCAN_FAILED count=$count" >&2
  exit 1
fi

fp=$(ssh-keygen -lf "$scan" | awk 'NR==1 { print $2 }')
echo "HOST_KEY_FINGERPRINT=$fp"
if [ "$fp" != "$EXPECTED" ]; then
  echo "HOST_KEY_FINGERPRINT_MISMATCH" >&2
  exit 1
fi
ssh-keygen -lf "$scan" | grep -q '(ED25519)'

umask 022
cp "$scan" "$OUT"
chmod 644 "$OUT"
echo "HOST_KEY_FINGERPRINT_OK"
