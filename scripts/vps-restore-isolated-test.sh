#!/usr/bin/env bash
# Restore a gzip dump into a throwaway Postgres container. Never touches production.
# Usage: bash scripts/vps-restore-isolated-test.sh [backup.sql.gz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(ls -1t "$ROOT"/backups/exchange_db_*.sql.gz 2>/dev/null | head -1 || true)"
fi
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 /path/to/exchange_db_YYYYMMDD_HHMMSS.sql.gz" >&2
  exit 1
fi

NAME="exchange-restore-test-$$"
echo "Isolated restore test from $BACKUP_FILE into container $NAME"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=restoretest -e POSTGRES_USER=exchange -e POSTGRES_DB=exchange postgres:16-alpine >/dev/null
for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U exchange -d exchange >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 30 ] && { echo "Restore-test Postgres not ready" >&2; docker rm -f "$NAME" >/dev/null; exit 1; }
  sleep 1
done

gunzip -c "$BACKUP_FILE" | docker exec -i "$NAME" psql -U exchange -d exchange -v ON_ERROR_STOP=1 >/tmp/restore-test.out
TABLES="$(docker exec "$NAME" psql -U exchange -d exchange -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")"
docker rm -f "$NAME" >/dev/null
echo "Isolated restore OK. public tables=$TABLES"
echo "Production database was not modified."
