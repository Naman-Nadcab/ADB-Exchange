#!/usr/bin/env bash
# Seed default admin users (run once after migrations). Change passwords immediately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.production.yml)

if [ ! -f .env ]; then
  echo "Missing .env"
  exit 1
fi

echo "=== Seeding admin users ==="
"${COMPOSE[@]}" --profile tools run --rm seed-admin
echo "=== Done — change default passwords before go-live ==="
