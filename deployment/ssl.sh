#!/usr/bin/env bash
# Generate self-signed TLS for first boot (replace with Let's Encrypt when domain is ready).
# Usage: bash deployment/ssl.sh [hostname-or-ip]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${1:-}"

if [[ -z "$HOST" && -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
  HOST="${PUBLIC_HOST:-${VPS_PUBLIC_IP:-}}"
fi

[[ -n "$HOST" ]] || {
  echo "Usage: bash deployment/ssl.sh <hostname-or-ip>"
  echo "  Or set PUBLIC_HOST in .env"
  exit 1
}

exec bash "${REPO_ROOT}/scripts/generate-self-signed-tls.sh" "$HOST"
