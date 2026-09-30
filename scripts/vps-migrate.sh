#!/usr/bin/env bash
# Run DB migrations against production Postgres (Docker tools profile).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)

if [ ! -f .env ]; then
  echo "Missing .env — copy from .env.production.example and fill secrets."
  exit 1
fi

echo "=== Starting Postgres (if not running) ==="
"${COMPOSE[@]}" up -d postgres
echo "=== Waiting for Postgres ==="
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-exchange}" -d "${POSTGRES_DB:-exchange}" >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 60 ] && { echo "Postgres not ready"; exit 1; }
  sleep 1
done

echo "=== Building backend image (includes dist/database/migrate.js) ==="
"${COMPOSE[@]}" build backend

echo "=== Running migrations (node dist/database/migrate.js) ==="
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "=== Migrations complete ==="
