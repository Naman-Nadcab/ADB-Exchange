#!/usr/bin/env bash
# Restore PostgreSQL from a gzip SQL dump on VPS production stack.
#
# Usage:
#   BACKUP_FILE=./backups/exchange_db_YYYYMMDD_HHMMSS.sql.gz \
#   CONFIRM=YES_I_UNDERSTAND_DATA_LOSS \
#   bash scripts/vps-restore-db.sh
#
# Before restore: halt trading (admin UI or scripts/vps-trading-halt.sh halt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)

if [ ! -f .env ]; then
  echo "Error: .env not found." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PG_USER="${POSTGRES_USER:-exchange}"
PG_DB="${POSTGRES_DB:-exchange}"
BACKUP_FILE="${BACKUP_FILE:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: set BACKUP_FILE to an existing .sql.gz dump." >&2
  exit 1
fi

if [ "${CONFIRM:-}" != "YES_I_UNDERSTAND_DATA_LOSS" ]; then
  echo "Refusing restore without CONFIRM=YES_I_UNDERSTAND_DATA_LOSS" >&2
  echo "Steps: halt trading → stop app services → restore → migrate → restart" >&2
  exit 1
fi

echo "=== Step 1: Halt trading (Redis) ==="
bash scripts/vps-trading-halt.sh halt || true

echo "=== Step 2: Stop application services ==="
"${COMPOSE[@]}" stop backend matching-engine indexer frontend admin-panel nginx 2>/dev/null || true

echo "=== Step 3: Restore database ==="
"${COMPOSE[@]}" up -d postgres
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 60 ] && { echo "Postgres not ready" >&2; exit 1; }
  sleep 1
done

echo "Terminating active connections to $PG_DB ..."
"${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();
SQL

echo "Dropping and recreating database $PG_DB ..."
"${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${PG_DB};
CREATE DATABASE ${PG_DB} OWNER ${PG_USER};
SQL

echo "Importing $BACKUP_FILE ..."
gunzip -c "$BACKUP_FILE" | "${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -f -

echo "=== Step 4: Run idempotent migrations ==="
bash scripts/vps-migrate.sh

echo "=== Step 5: Restart stack (trading remains halted) ==="
"${COMPOSE[@]}" up -d --remove-orphans

echo ""
echo "Restore complete. Trading is still HALTED."
echo "Verify: bash scripts/vps-health-check.sh http://${VPS_PUBLIC_IP:-127.0.0.1}"
echo "Resume trading only after integrity checks: bash scripts/vps-trading-halt.sh resume"
