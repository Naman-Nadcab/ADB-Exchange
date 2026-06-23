#!/usr/bin/env bash
# Provision hot wallet families via backend script (idempotent).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/backend"
if [ -f "$ROOT/.env" ]; then set -a; # shellcheck disable=SC1090
  . "$ROOT/.env"; set +a; fi
exec npx tsx scripts/provision-hot-wallets.ts "$@"
