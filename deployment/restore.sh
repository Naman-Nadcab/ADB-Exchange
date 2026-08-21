#!/usr/bin/env bash
# Restore PostgreSQL from gzip SQL dump.
# Usage: bash deployment/restore.sh <path-to-backup.sql.gz>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deployment/lib/common.sh
source "${REPO_ROOT}/deployment/lib/common.sh"

BACKUP="${1:-}"
[[ -n "$BACKUP" && -f "$BACKUP" ]] || {
  echo "Usage: bash deployment/restore.sh <backup.sql.gz>" >&2
  exit 1
}

require_env_file
load_env

echo "WARNING: This will overwrite the current database."
read -r -p "Type RESTORE to continue: " confirm
[[ "$confirm" == "RESTORE" ]] || exit 1

bash "${REPO_ROOT}/scripts/vps-trading-halt.sh" halt 2>/dev/null || true
"${COMPOSE[@]}" up -d postgres
wait_postgres

echo "Restoring from $BACKUP ..."
gunzip -c "$BACKUP" | "${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-exchange}" -d "${POSTGRES_DB:-exchange}"

log_ok "Restore complete — restart application: bash deployment/deploy.sh"
