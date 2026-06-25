#!/usr/bin/env bash
# PostgreSQL backup for VPS production stack (Docker Postgres).
# Usage: bash scripts/vps-backup-db.sh [output_dir]
# Default output: ./backups/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)
OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/exchange_db_${TIMESTAMP}.sql.gz"

if [ ! -f .env ]; then
  echo "Error: .env not found. Run from repo root after first boot." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PG_USER="${POSTGRES_USER:-exchange}"
PG_DB="${POSTGRES_DB:-exchange}"

mkdir -p "$OUTPUT_DIR"

echo "Ensuring Postgres is up..."
"${COMPOSE[@]}" up -d postgres
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 60 ] && { echo "Postgres not ready" >&2; exit 1; }
  sleep 1
done

echo "Backing up to $BACKUP_FILE ..."
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl | gzip > "$BACKUP_FILE"

echo "Backup complete: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo "Copy off-site: scp $BACKUP_FILE user@backup-host:/path/"
