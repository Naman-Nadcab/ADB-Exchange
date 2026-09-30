#!/usr/bin/env bash
# PostgreSQL backup for VPS production stack (Docker Postgres).
# Usage: bash scripts/vps-backup-db.sh [output_dir]
# Default output: ./backups/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/exchange_db_${TIMESTAMP}.sql.gz"

if [ ! -f .env ]; then
  echo "Error: .env not found. Run from repo root after first boot." >&2
  exit 1
fi

# Do not `source .env` — production files can contain unquoted shell metacharacters.
env_get() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" .env | tail -1 || true)"
  printf '%s' "${line#*=}"
}

PG_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER)}"
PG_DB="${POSTGRES_DB:-$(env_get POSTGRES_DB)}"
PG_USER="${PG_USER:-exchange}"
PG_DB="${PG_DB:-exchange}"

mkdir -p "$OUTPUT_DIR"

echo "Checking Postgres is up..."
if ! docker exec exchange-postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
  echo "Error: exchange-postgres is not ready. Will not start extra compose services from cron." >&2
  exit 1
fi

echo "Backing up to $BACKUP_FILE ..."
docker exec exchange-postgres pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip > "$BACKUP_FILE"

if ! gzip -t "$BACKUP_FILE"; then
  echo "Error: gzip integrity check failed for $BACKUP_FILE" >&2
  exit 1
fi

echo "Backup complete: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo "Copy off-site: scp $BACKUP_FILE user@backup-host:/path/"
echo "Do not overwrite /opt/m-live/release-backup/"
